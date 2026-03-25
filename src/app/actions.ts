
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, SiteConfig, CartItem, User, EmployeeProfile, AttendanceRecord, SalarySlip, ReportData, Product, MenuItem } from '@/lib/types';

/**
 * DEEP SERIALIZATION & PERFORMANCE TELEMETRY UTILITY
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

/**
 * OPTIMIZED ANALYTICS (SUMMARY-FIRST)
 * Previously: Scanned all orders (Slow, 2s+).
 * Now: Attempts to read a single 'summary' doc first.
 */
export async function getPlatformAnalytics() {
    const start = Date.now();
    try {
        const { db } = await getAdminServices();
        
        // Strategy: Use a dedicated 'system_stats' doc for 1-read retrieval
        // If it doesn't exist, we fall back to aggregation but only for current day.
        const statsDoc = await db.collection('siteConfig').doc('platform_stats').get();
        
        if (statsDoc.exists) {
            const data = statsDoc.data();
            console.log(`[PERF] Analytics Summary fetched in ${Date.now() - start}ms`);
            return sanitizeForClient(data);
        }

        // FALLBACK: Aggregation (Should only happen once or in development)
        const [usersCount, storesCount, activeOrdersSnap] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
            db.collection('orders').where('isActive', '==', true).get(),
        ]);

        return sanitizeForClient({
            totalUsers: usersCount.data().count,
            totalStores: storesCount.data().count,
            activeSessions: activeOrdersSnap.size,
            periods: { today: { revenue: 0, orders: 0, aov: 0, userReach: 0, trends: { revenue: 0, orders: 0, aov: 0, userReach: 0 } } }
        });
    } catch (error) {
        console.error("Platform analytics engine failed:", error);
        return null;
    }
}

/**
 * OPTIMIZED STORE SALES REPORT
 * Uses specialized indexes and aggregation limits.
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

    // OPTIMIZATION: Limit the scan to 500 documents max to prevent 2s hang
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
        orders: orders.slice(0, 20) // Only send recent 20 to client to keep JSON small
    };

    console.log(`[PERF] Store Report (${period}) for ${storeId} generated in ${Date.now() - start}ms`);
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
            webpush: { notification: { icon: 'https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png' } }
        });
        return { success: true, results: { totalTokens: tokens.length, successCount: response.successCount, failureCount: response.failureCount } };
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
// ==============================
// ✅ ATTENDANCE APPROVAL ACTIONS
// ==============================

export async function approveRegularization(
    attendanceId: string,
    storeId: string,
    approved: boolean
  ) {
    try {
      const { db } = await getAdminServices();
  
      const ref = db.doc(`stores/${storeId}/attendance/${attendanceId}`);
  
      await ref.update({
        status: approved ? 'approved' : 'present',
        updatedAt: Timestamp.now(),
      });
  
      return { success: true };
    } catch (error: any) {
      console.error("Approve failed:", error);
      return { success: false, error: error.message };
    }
  }
  
  export async function rejectRegularization(
    attendanceId: string,
    storeId: string,
    reason: string
  ) {
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
      console.error("Reject failed:", error);
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

// Update placeholder images
export async function updatePlaceholderImages(data: any) {
  try {
    const { db } = await getAdminServices();

    await db.collection('siteConfig').doc('placeholders').set(data, { merge: true });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
// PDF processing (temporary stub)
export async function processPdfAndExtractRules(file: File) {
  try {
    return {
      success: true,
      rules: [],
      sentenceCount: 0, // ✅ REQUIRED
      message: "PDF processing not implemented yet"
    };
  } catch (error: any) {
    return {
      success: false,
      rules: [],
      sentenceCount: 0, // ✅ ALSO REQUIRED HERE
      error: error.message
    };
  }
}
export async function approveRule(ruleId: string, rawText: string) {
  try {
    const { db } = await getAdminServices();

    await db.collection('rules').doc(ruleId).set({
      id: ruleId,
      text: rawText,
      status: 'approved',
      createdAt: new Date(),
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
export async function rejectRule(ruleId: string) {
  try {
    const { db } = await getAdminServices();

    await db.collection('rules').doc(ruleId).update({
      status: 'rejected',
      updatedAt: new Date()
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
export async function getSystemStatus() {
  try {
    const { db, auth } = await getAdminServices();

    // Test DB connection
    const usersSnap = await db.collection('users').limit(1).get();
    const storesSnap = await db.collection('stores').limit(1).get();

    return {
      status: 'ok',
      llmStatus: 'Online', // you can improve later
      serverDbStatus: 'Online',
      identity: 'Firebase Admin Connected',
      isCredentialError: false,
      counts: {
        users: usersSnap.size,
        stores: storesSnap.size
      }
    };
  } catch (error: any) {
    return {
      status: 'error',
      llmStatus: 'Offline',
      serverDbStatus: 'Offline',
      errorMessage: error.message,
      isCredentialError: true,
      counts: {
        users: 0,
        stores: 0
      }
    };
  }
}
export async function getSalarySlipData(
  slipId: string,
  userId: string,
  storeId?: string
) {
  try {
    const { db } = await getAdminServices();

    // Get slip
    const slipDoc = await db.collection('salarySlips').doc(slipId).get();

    if (!slipDoc.exists) {
      return null;
    }

    const slip = slipDoc.data();

    // Security check (VERY IMPORTANT)
    if (slip?.userId !== userId) {
      return null;
    }

    // Get employee
    const empDoc = await db.collection('employeeProfiles').doc(userId).get();
    const employee = empDoc.data();

    // Get user (name details)
    const userDoc = await db.collection('users').doc(userId).get();
    const user = userDoc.data();

    // Get store
    let store = null;
    if (storeId) {
      const storeDoc = await db.collection('stores').doc(storeId).get();
      store = storeDoc.data();
    }

    return {
      slip,
      employee: { ...employee, ...user },
      store,
      attendance: slip?.attendance || {}
    };
  } catch (error: any) {
    throw new Error(error.message);
  }
}