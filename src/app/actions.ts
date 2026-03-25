'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, User, EmployeeProfile, SalarySlip, Product } from '@/lib/types';

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

        // FALLBACK: Manual Aggregation
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

export async function getStoreSalesReport({ storeId, period }: { storeId: string; period: 'daily' | 'weekly' | 'monthly' }) {
  try {
    const { db } = await getAdminServices();
    const ordersSnap = await db.collection('orders')
        .where('storeId', '==', storeId)
        .where('status', 'in', ['Completed', 'Delivered', 'Billed'])
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

    const result = {
        totalSales,
        totalOrders: orders.length,
        topProducts: Object.entries(itemCounts).sort((a,b) => b[1] - a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
        ingredientCost: totalSales * 0.45,
        orders: orders.slice(0, 20)
    };
    return { success: true, report: sanitizeForClient(result) };
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
    const usersCount = await db.collection('users').count().get();
    const storesCount = await db.collection('stores').count().get();
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
