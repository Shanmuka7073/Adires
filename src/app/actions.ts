
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, User, EmployeeProfile, SalarySlip, Product, MenuItem, GetIngredientsOutput, CartItem, ReportData } from '@/lib/types';

/**
 * DEEP SERIALIZATION UTILITY
 * Recursively converts Firestore Timestamps and Dates to ISO strings.
 * This prevents the "Server Component" render crash.
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
        const statsDoc = await db.collection('siteConfig').doc('platform_stats').get();
        
        if (statsDoc.exists) {
            return sanitizeForClient(statsDoc.data());
        }

        const [usersCount, storesCount, ordersSnap] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
            db.collection('orders').where('status', 'in', ['Completed', 'Delivered']).get(),
        ]);

        let totalRevenue = 0;
        ordersSnap.docs.forEach(doc => { totalRevenue += (doc.data().totalAmount || 0); });

        const result = {
            totalUsers: usersCount.data().count,
            totalStores: storesCount.data().count,
            activeSessions: ordersSnap.size,
            periods: {
                today: {
                    revenue: totalRevenue,
                    orders: ordersSnap.size,
                    aov: ordersSnap.size > 0 ? totalRevenue / ordersSnap.size : 0,
                    userReach: ordersSnap.size,
                    trends: { revenue: 0, orders: 0, aov: 0, userReach: 0 }
                }
            }
        };
        return sanitizeForClient(result);
    } catch (error) { return null; }
}

export async function getStoreSalesReport({ storeId, period }: { storeId: string; period: 'daily' | 'weekly' | 'monthly' }): Promise<{ success: boolean; report?: ReportData; error?: string }> {
  try {
    const { db } = await getAdminServices();
    const ordersSnap = await db.collection('orders')
        .where('storeId', '==', storeId)
        .where('status', 'in', ['Completed', 'Delivered', 'Billed'])
        .orderBy('orderDate', 'desc')
        .limit(500)
        .get();

    const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
    let totalSales = 0;
    let itemCounts: Record<string, number> = {};
    
    orders.forEach((o: any) => {
        totalSales += (o.totalAmount || 0);
        (o.items || []).forEach((it: any) => {
            itemCounts[it.productName] = (itemCounts[it.productName] || 0) + it.quantity;
        });
    });

    const report: ReportData = {
        totalSales,
        totalOrders: orders.length,
        totalItems: orders.length * 2,
        topProducts: Object.entries(itemCounts).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        ingredientCost: totalSales * 0.45,
        orders: orders.slice(0, 20)
    };
    return { success: true, report: sanitizeForClient(report) };
  } catch (error: any) { return { success: false, error: error.message }; }
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
        await db.collection('siteConfig').doc('placeholder_images').set(data, { merge: true });
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

export async function getIngredientsForDish({ dishName, language }: { dishName: string; language: 'en' | 'te' }) {
    try {
        const { db } = await getAdminServices();
        const cacheId = `${dishName.toLowerCase().replace(/\s+/g, '-')}_${language}`;
        const cacheDoc = await db.collection('cachedRecipes').doc(cacheId).get();
        
        if (cacheDoc.exists) {
            return { isSuccess: true, ...cacheDoc.data() } as GetIngredientsOutput;
        }
        
        return { isSuccess: false, title: dishName, components: [], steps: [], itemType: 'product' };
    } catch (error) { return null; }
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
