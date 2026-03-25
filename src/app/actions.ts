
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, SiteConfig, CartItem, User, EmployeeProfile, AttendanceRecord, SalarySlip, ReportData, Product, MenuItem } from '@/lib/types';

/**
 * DEEP SERIALIZATION & PERFORMANCE TELEMETRY UTILITY
 * Recursively converts Firestore Timestamps and Dates to ISO strings.
 */
function sanitizeForClient(data: any): any {
    if (data === null || data === undefined) return data;
    
    // Handle Firestore Timestamps
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

/**
 * RESILIENT PLATFORM ANALYTICS
 * Attempts summary read first, falls back to manual aggregation.
 */
export async function getPlatformAnalytics() {
    const start = Date.now();
    try {
        const { db } = await getAdminServices();
        
        const statsDoc = await db.collection('siteConfig').doc('platform_stats').get();
        
        if (statsDoc.exists) {
            console.log(`[PERF] Analytics Summary fetched in ${Date.now() - start}ms`);
            return sanitizeForClient(statsDoc.data());
        }

        // FALLBACK: Manual Aggregation for Today
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTs = Timestamp.fromDate(today);

        const [usersCount, storesCount, todayOrdersSnap] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
            db.collection('orders')
                .where('orderDate', '>=', todayTs)
                .where('status', 'in', ['Completed', 'Delivered', 'Billed'])
                .get(),
        ]);

        let todayRevenue = 0;
        todayOrdersSnap.docs.forEach(doc => {
            todayRevenue += (doc.data().totalAmount || 0);
        });

        const result = {
            totalUsers: usersCount.data().count,
            totalStores: storesCount.data().count,
            activeSessions: todayOrdersSnap.size,
            periods: {
                today: {
                    revenue: todayRevenue,
                    orders: todayOrdersSnap.size,
                    aov: todayOrdersSnap.size > 0 ? todayRevenue / todayOrdersSnap.size : 0,
                    userReach: todayOrdersSnap.size,
                    trends: { revenue: 0, orders: 0, aov: 0, userReach: 0 }
                }
            }
        };

        console.log(`[PERF] Analytics Fallback generated in ${Date.now() - start}ms`);
        return sanitizeForClient(result);
    } catch (error) {
        console.error("Platform analytics engine failed:", error);
        return null;
    }
}

/**
 * OPTIMIZED STORE SALES REPORT
 */
export async function getStoreSalesReport({
  storeId,
  period,
}: {
  storeId: string;
  period: 'daily' | 'weekly' | 'monthly';
}) {
  const start = Date.now();
  try {
    const { db } = await getAdminServices();
    
    const now = new Date();
    let startDate = new Date();
    if (period === 'daily') startDate.setHours(0,0,0,0);
    else if (period === 'weekly') startDate.setDate(now.getDate() - 7);
    else startDate.setDate(1);

    const ordersSnap = await db.collection('orders')
        .where('storeId', '==', storeId)
        .where('status', 'in', ['Completed', 'Delivered', 'Billed'])
        .where('orderDate', '>=', Timestamp.fromDate(startDate))
        .orderBy('orderDate', 'desc')
        .limit(500)
        .get();

    const orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    
    let totalSales = 0;
    let itemCounts: Record<string, number> = {};
    
    orders.forEach((o: any) => {
        totalSales += (o.totalAmount || 0);
        (o.items || []).forEach((it: any) => {
            itemCounts[it.productName] = (itemCounts[it.productName] || 0) + it.quantity;
        });
    });

    const topProducts = Object.entries(itemCounts)
        .sort((a,b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count }));

    const result = {
        totalSales,
        totalOrders: orders.length,
        topProducts,
        ingredientCost: totalSales * 0.45,
        orders: orders.slice(0, 20)
    };

    console.log(`[PERF] Store Report (${period}) generated in ${Date.now() - start}ms`);
    return { success: true, report: sanitizeForClient(result), error: null };
  } catch (error: any) {
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
            webpush: { 
                notification: { 
                    icon: 'https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png',
                    badge: 'https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png'
                } 
            }
        });
        
        return { 
            success: true, 
            results: { 
                totalTokens: tokens.length, 
                successCount: response.successCount, 
                failureCount: response.failureCount 
            } 
        };
    } catch (error: any) { return { success: false, error: error.message }; }
}

export async function updateEmployee(userId: string, data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('employeeProfiles').doc(userId).set(data, { merge: true });
        return { success: true, error: null };
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
        return { success: true, error: null };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function getIngredientsForDish(input: { dishName: string; language: string }) {
    const { getIngredientsForDishFlow } = await import('@/ai/flows/recipe-ingredients-flow');
    const lang = (input.language === 'te' ? 'te' : 'en') as 'en' | 'te';
    const result = await getIngredientsForDishFlow({ dishName: input.dishName, language: lang });
    return sanitizeForClient(result);
}

export async function placeRestaurantOrder(cartItems: CartItem[], total: number, guestInfo: any, idToken: string) {
    try {
        const { db, auth } = await getAdminServices();
        const decodedToken = await auth.verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const orderId = db.collection('orders').doc().id;
        const orderData = {
            id: orderId,
            userId: uid,
            customerName: guestInfo.name,
            phone: guestInfo.phone,
            tableNumber: guestInfo.tableNumber,
            storeId: cartItems[0]?.product.storeId,
            items: cartItems.map(item => ({ productName: item.product.name, quantity: item.quantity, price: item.variant.price })),
            totalAmount: total,
            status: 'Pending',
            orderDate: Timestamp.now(),
            isActive: true,
        };
        await db.collection('orders').doc(orderId).set(orderData);
        return { success: true, orderId, error: null };
    } catch (e: any) { return { success: false, orderId: null, error: e.message }; }
}

export async function approveRegularization(attendanceId: string, storeId: string, approved: boolean) {
    try {
      const { db } = await getAdminServices();
      const ref = db.doc(`stores/${storeId}/attendance/${attendanceId}`);
      await ref.update({
        status: approved ? 'approved' : 'present',
        updatedAt: Timestamp.now(),
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
  
  export async function rejectRegularization(attendanceId: string, storeId: string, reason: string) {
    try {
      const { db } = await getAdminServices();
      const ref = db.doc(`stores/${storeId}/attendance/${attendanceId}`);
      await ref.update({
        status: 'rejected',
        rejectionReason: reason,
        updatedAt: Timestamp.now(),
      });
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

export async function getPlaceholderImages(): Promise<Record<string, any>> {
    try {
      const { db } = await getAdminServices();
      const doc = await db.collection('siteConfig').doc('placeholders').get();
      return doc.exists ? doc.data() || {} : {};
    } catch (error: any) {
      return {};
    }
}

export async function updatePlaceholderImages(data: any) {
  try {
    const { db } = await getAdminServices();
    await db.collection('siteConfig').doc('placeholders').set(data, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSystemStatus() {
  try {
    const { db } = await getAdminServices();
    const usersCount = await db.collection('users').count().get();
    const storesCount = await db.collection('stores').count().get();

    return {
      status: 'ok',
      llmStatus: 'Online',
      serverDbStatus: 'Online',
      identity: 'Firebase Admin Connected',
      isCredentialError: false,
      counts: {
        users: usersCount.data().count,
        stores: storesCount.data().count
      }
    };
  } catch (error: any) {
    return {
      status: 'error',
      llmStatus: 'Offline',
      serverDbStatus: 'Offline',
      errorMessage: error.message,
      isCredentialError: true,
      counts: { users: 0, stores: 0 }
    };
  }
}

export async function getSalarySlipData(slipId: string, userId: string, storeId?: string) {
  try {
    const { db } = await getAdminServices();
    const slipDoc = await db.collection('salarySlips').doc(slipId).get();
    if (!slipDoc.exists) return null;
    const slip = slipDoc.data();
    if (slip?.userId !== userId && slip?.employeeId !== userId) return null;

    const empDoc = await db.collection('employeeProfiles').doc(userId).get();
    const employee = empDoc.data();

    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();

    let store = null;
    if (storeId) {
      const storeDoc = await db.collection('stores').doc(storeId).get();
      store = storeDoc.data();
    }

    return sanitizeForClient({
      slip,
      employee: { ...employee, ...user },
      store,
      attendance: slip?.attendance || {}
    });
  } catch (error: any) {
    throw new Error(error.message);
  }
}

export async function getManifest() {
  try {
    const { db } = await getAdminServices();
    const doc = await db.collection('config').doc('manifest').get();
    return sanitizeForClient(doc.exists ? doc.data() : {});
  } catch (error: any) {
    return {};
  }
}

export async function updateManifest(data: any) {
  try {
    const { db } = await getAdminServices();
    await db.collection('config').doc('manifest').set(data, { merge: true });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
