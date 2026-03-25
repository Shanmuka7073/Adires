
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, User, EmployeeProfile, SalarySlip, Product, MenuItem, GetIngredientsOutput, CartItem, ReportData } from '@/lib/types';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';

/**
 * DEEP SERIALIZATION UTILITY
 * Recursively converts Firestore Timestamps and Dates to ISO strings.
 */
function sanitizeForClient(data: any): any {
    if (data === null || data === undefined) return data;
    if (typeof data === 'object' && 'seconds' in data && 'nanoseconds' in data) {
        return new Date(data.seconds * 1000).toISOString();
    }
    if (data instanceof Date) return data.toISOString();
    if (Array.isArray(data)) return data.map(sanitizeForClient);
    if (typeof data === 'object') {
        const cleaned: any = {};
        for (const [key, value] of Object.entries(data)) {
            cleaned[key] = sanitizeForClient(value);
        }
        return cleaned;
    }
    return data;
}

/**
 * Calculates billing speed metrics from a collection of orders.
 */
function calculateSpeedMetrics(orders: any[]) {
    const completedOrders = orders.filter(o => 
        (o.status === 'Completed' || o.status === 'Billed' || o.status === 'Delivered') && 
        o.orderDate && o.updatedAt
    );

    if (completedOrders.length === 0) {
        return { avg: 0, fastest: 0, slowest: 0 };
    }

    const durations = completedOrders.map(o => {
        const start = o.orderDate.seconds || new Date(o.orderDate).getTime() / 1000;
        const end = o.updatedAt.seconds || new Date(o.updatedAt).getTime() / 1000;
        return Math.max(0, (end - start) / 60); // duration in minutes
    });

    const sum = durations.reduce((a, b) => a + b, 0);
    return {
        avg: sum / durations.length,
        fastest: Math.min(...durations),
        slowest: Math.max(...durations)
    };
}

export async function getFirebaseConfig() {
  try {
    const { app } = await getAdminServices();
    const options = app.options as any;
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: options.authDomain || `${options.projectId}.firebaseapp.com`,
      projectId: options.projectId,
      storageBucket: options.storageBucket || `${options.projectId}.appspot.com`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
    };
  } catch (e) { return null; }
}

export async function getPlatformAnalytics() {
    try {
        const { db } = await getAdminServices();
        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfTodayTs = Timestamp.fromDate(startOfToday);

        // Fetch counts and today's orders in parallel
        const [usersCount, storesCount, ordersSnap] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
            db.collection('orders')
                .where('status', 'in', ['Completed', 'Delivered', 'Billed'])
                .where('orderDate', '>=', startOfTodayTs)
                .get(),
        ]);

        let todayRevenue = 0;
        ordersSnap.docs.forEach(doc => { 
            const data = doc.data();
            todayRevenue += (data.totalAmount || 0); 
        });

        // Calculate speed metrics separately to ensure robustness if index is still building
        let speedMetrics = { avg: 0, fastest: 0, slowest: 0 };
        try {
            const recentCompletedSnap = await db.collection('orders')
                .where('status', 'in', ['Completed', 'Delivered', 'Billed'])
                .orderBy('updatedAt', 'desc')
                .limit(100)
                .get();
            
            const recentOrders = recentCompletedSnap.docs.map(d => d.data());
            speedMetrics = calculateSpeedMetrics(recentOrders);
        } catch (e) {
            console.warn("Speed metrics calculation deferred (Index building?):", e);
        }

        const result = {
            totalUsers: usersCount.data().count,
            totalStores: storesCount.data().count,
            activeSessions: ordersSnap.size,
            avgBillingSpeed: speedMetrics.avg,
            fastestBill: speedMetrics.fastest,
            slowestBill: speedMetrics.slowest,
            periods: {
                today: {
                    revenue: todayRevenue,
                    orders: ordersSnap.size,
                    aov: ordersSnap.size > 0 ? todayRevenue / ordersSnap.size : 0,
                    userReach: ordersSnap.size,
                    trends: { revenue: 0, orders: 0, aov: 0, userReach: 0 }
                }
            }
        };
        
        return sanitizeForClient(result);
    } catch (error) { 
        console.error("Critical Platform Aggregation Failed:", error);
        return null; 
    }
}

export async function getStoreSalesReport({ storeId, period }: { storeId: string; period: 'daily' | 'weekly' | 'monthly' }): Promise<{ success: boolean; report?: ReportData; error?: string }> {
  try {
    const { db } = await getAdminServices();
    
    const now = new Date();
    let startDate: Date;
    if (period === 'daily') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Monday
        startDate = new Date(now.setDate(diff));
        startDate.setHours(0,0,0,0);
    } else { // monthly
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }
    const startTimestamp = Timestamp.fromDate(startDate);

    const ordersSnap = await db.collection('orders')
        .where('storeId', '==', storeId)
        .where('status', 'in', ['Completed', 'Delivered', 'Billed'])
        .where('orderDate', '>=', startTimestamp)
        .orderBy('orderDate', 'desc')
        .limit(500)
        .get();

    const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
    let totalSales = 0;
    let itemCounts: Record<string, number> = {};
    
    orders.forEach((o: any) => {
        totalSales += (o.totalAmount || 0);
        (o.items || []).forEach((it: any) => {
            const name = it.productName || 'Unknown Item';
            itemCounts[name] = (itemCounts[name] || 0) + (it.quantity || 1);
        });
    });

    const speedMetrics = calculateSpeedMetrics(orders);

    const report: ReportData = {
        totalSales,
        totalOrders: orders.length,
        totalItems: Object.values(itemCounts).reduce((a, b) => a + b, 0),
        topProducts: Object.entries(itemCounts)
            .sort((a,b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count })),
        ingredientCost: totalSales * 0.45,
        orders: orders.slice(0, 20),
        avgBillingSpeed: speedMetrics.avg,
        fastestBill: speedMetrics.fastest,
        slowestBill: speedMetrics.slowest
    };
    
    return { success: true, report: sanitizeForClient(report) };
  } catch (error: any) { 
      console.error("Sales Report Server Error:", error);
      return { success: false, error: error.message }; 
  }
}

export async function sendBroadcastNotification(title: string, body: string) {
    try {
        const { db, messaging } = await getAdminServices();
        const usersSnap = await db.collection('users').where('fcmToken', '!=', null).limit(500).get();
        if (usersSnap.empty) return { success: false, error: 'No recipients.' };
        const tokens = usersSnap.docs.map(doc => doc.data().fcmToken).filter(Boolean);
        
        const response = await messaging.sendEachForMulticast({
            tokens,
            notification: { title, body },
        });
        
        return { success: true, results: { totalTokens: tokens.length, successCount: response.successCount, failureCount: response.failureCount } };
    } catch (error: any) { return { success: false, error: error.message }; }
}

export async function updateEmployee(userId: string, data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('employeeProfiles').doc(userId).set(data, { merge: true });
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getSiteConfig(id: string) {
    try {
        const { db } = await getAdminServices();
        const snap = await db.collection('siteConfig').doc(id).get();
        return sanitizeForClient(snap.data() || {});
    } catch (e) { return {}; }
}

export async function updateSiteConfig(id: string, data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('siteConfig').doc(id).set(data, { merge: true });
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getSystemStatus() {
  try {
    const { db } = await getAdminServices();
    const [usersCount, storesCount] = await Promise.all([
        db.collection('users').count().get(),
        db.collection('stores').count().get()
    ]);
    return {
      status: 'ok',
      llmStatus: 'Offline',
      serverDbStatus: 'Online',
      counts: { users: usersCount.data().count, stores: storesCount.data().count }
    };
  } catch (error: any) {
    return { status: 'error', llmStatus: 'Offline', serverDbStatus: 'Offline', counts: { users: 0, stores: 0 } };
  }
}

export async function getPlaceholderImages() {
    try {
        const { db } = await getAdminServices();
        const doc = await db.collection('siteConfig').doc('placeholder_images').get();
        return { success: true, placeholderImages: doc.exists ? doc.data()?.placeholderImages || [] : [] };
    } catch (error: any) { return { success: false, error: error.message }; }
}

export async function updatePlaceholderImages(data: any) {
    try {
        const { db } = await getAdminServices();
        const doc = await db.collection('siteConfig').doc('placeholder_images').set(data, { merge: true });
        return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
}

export async function addRestaurantOrderItem({ storeId, sessionId, tableNumber, item, quantity }: { storeId: string; sessionId: string; tableNumber: string | null; item: MenuItem; quantity: number }) {
    try {
        const { db } = await getAdminServices();
        const orderId = `${storeId}_${sessionId}`;
        const orderRef = db.collection('orders').doc(orderId);

        const orderItem = {
            id: Math.random().toString(36).substring(7),
            orderId,
            productId: item.id,
            menuItemId: item.id,
            productName: item.name,
            quantity,
            price: item.price,
        };

        await orderRef.set({
            id: orderId,
            storeId,
            tableNumber,
            sessionId,
            status: 'Pending',
            isActive: true,
            orderDate: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            items: FieldValue.arrayUnion(orderItem),
            totalAmount: FieldValue.increment(item.price * quantity),
        }, { merge: true });

        return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
}

export async function placeRestaurantOrder(cartItems: CartItem[], cartTotal: number, guestInfo: { name: string, phone: string, tableNumber: string }, idToken: string) {
    try {
        const { db, auth } = await getAdminServices();
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const storeId = cartItems[0].product.storeId;
        const sessionId = cartItems[0].sessionId || `guest-${Date.now()}`;
        const orderId = `${storeId}_${sessionId}`;

        const orderData = {
            id: orderId,
            userId: uid,
            storeId,
            customerName: guestInfo.name,
            phone: guestInfo.phone,
            tableNumber: guestInfo.tableNumber,
            sessionId,
            status: 'Pending',
            isActive: true,
            orderDate: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            totalAmount: cartTotal,
            items: cartItems.map(it => ({
                id: Math.random().toString(36).substring(7),
                productName: it.product.name,
                productId: it.product.id,
                quantity: it.quantity,
                price: it.variant.price
            }))
        };

        await db.collection('orders').doc(orderId).set(orderData);
        return { success: true, orderId };
    } catch (error: any) { return { success: false, error: error.message }; }
}

/**
 * UNIFIED INGREDIENT LOOKUP
 * Standardizes the normalization and language suffixing for recipe lookups.
 */
export async function getIngredientsForDish({ dishName, language }: { dishName: string; language: 'en' | 'te' }) {
    try {
        const result = await getIngredientsForDishFlow({ dishName, language });
        return sanitizeForClient(result);
    } catch (error) { 
        return { isSuccess: false, title: dishName, components: [], steps: [], itemType: 'product' };
    }
}

export async function getSalarySlipData(slipId: string, userId: string, storeId?: string) {
  try {
    const { db } = await getAdminServices();
    const slipDoc = await db.collection('salarySlips').doc(slipId).get();
    if (!slipDoc.exists) return null;
    const slip = slipDoc.data();
    const empDoc = await db.collection('employeeProfiles').doc(userId).get();
    const userDoc = await db.collection('users').doc(userId).get();
    return sanitizeForClient({ slip, employee: { ...empDoc.data(), ...userDoc.data() }, attendance: slip?.attendance || {} });
  } catch (error: any) { throw new Error(error.message); }
}

export async function approveRegularization(attendanceId: string, storeId: string, approved: boolean) {
    try {
      const { db } = await getAdminServices();
      await db.doc(`stores/${storeId}/attendance/${attendanceId}`).update({
        status: approved ? 'approved' : 'present',
        updatedAt: Timestamp.now(),
      });
      return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
}

export async function rejectRegularization(attendanceId: string, storeId: string, reason: string) {
    try {
      const { db } = await getAdminServices();
      await db.doc(`stores/${storeId}/attendance/${attendanceId}`).update({
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: Timestamp.now(),
      });
      return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
}
