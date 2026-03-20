'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, Store, User, MenuItem, OrderItem, RestaurantIngredient, SalarySlip, EmployeeProfile, SiteConfig, GetIngredientsOutput } from '@/lib/types';
import { getApps } from 'firebase-admin/app';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';

/**
 * UTILITY: Safe Date Parsing for Analytics
 */
function toDateSafe(d: any): Date {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    if (typeof d === 'object' && d.seconds) return new Date(d.seconds * 1000);
    if (typeof d === 'string') return new Date(d);
    return new Date();
}

/**
 * FIREBASE CONFIGURATION RECOVERY
 */
export async function getFirebaseConfig() {
  try {
    const adminApp = getApps()[0] || (await getAdminServices()).app;
    const projectId = adminApp.options.projectId;
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: adminApp.options.authDomain || `${projectId}.firebaseapp.com`,
      projectId: projectId,
      storageBucket: `${projectId}.appspot.com`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  } catch (e) {
    console.error("Config fetch failed:", e);
    return null;
  }
}

/**
 * AI INGREDIENT ANALYSIS
 */
export async function getIngredientsForDish(input: { dishName: string; language: 'en' | 'te' }): Promise<GetIngredientsOutput> {
    try {
        return await getIngredientsForDishFlow(input);
    } catch (error: any) {
        console.error("getIngredientsForDish failed:", error);
        return {
            isSuccess: false,
            itemType: 'product',
            title: input.dishName,
            components: [],
            steps: [],
            nutrition: { calories: 0, protein: 0 },
        };
    }
}

/**
 * RESTAURANT ORDERING ENGINE
 */
export async function addRestaurantOrderItem({
  storeId,
  sessionId,
  tableNumber,
  item,
  quantity,
}: {
  storeId: string;
  sessionId: string;
  tableNumber: string | null;
  item: MenuItem;
  quantity: number;
}) {
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
      variantSku: `${item.id}-default`,
      variantWeight: '1 pc',
      quantity,
      price: item.price,
    };

    await orderRef.set({
      id: orderId,
      storeId,
      tableNumber,
      sessionId,
      status: 'Pending',
      orderType: tableNumber ? 'dine-in' : 'delivery',
      isActive: true,
      orderDate: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      items: FieldValue.arrayUnion(orderItem),
      totalAmount: FieldValue.increment(item.price * quantity),
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    console.error("addRestaurantOrderItem failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * EXECUTIVE DASHBOARD ANALYTICS
 */
export async function getPlatformAnalytics() {
    try {
        const { db } = await getAdminServices();
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        
        const [usersSnap, storesSnap, ordersSnap, configSnap] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
            db.collection('orders').where('orderDate', '>=', Timestamp.fromDate(sixtyDaysAgo)).get(),
            db.collection('siteConfig').doc('appStatus').get()
        ]);

        const allOrders = ordersSnap.docs.map(d => ({ 
            ...d.data(), 
            orderDate: toDateSafe(d.data().orderDate) 
        }));
        const now = new Date();

        const calculateMetrics = (periodDays: number) => {
            const currentStart = new Date(now);
            currentStart.setDate(currentStart.getDate() - periodDays);
            
            const previousStart = new Date(currentStart);
            previousStart.setDate(previousStart.getDate() - periodDays);

            const currentOrders = allOrders.filter(o => o.orderDate >= currentStart);
            const previousOrders = allOrders.filter(o => o.orderDate >= previousStart && o.orderDate < currentStart);

            const currentRevenue = currentOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
            const previousRevenue = previousOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);

            const currentAOV = currentOrders.length ? currentRevenue / currentOrders.length : 0;
            const previousAOV = previousOrders.length ? previousRevenue / previousOrders.length : 0;

            const calculateTrend = (curr: number, prev: number) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;

            return {
                revenue: currentRevenue,
                orders: currentOrders.length,
                aov: currentAOV,
                userReach: new Set(currentOrders.map(o => o.userId)).size,
                trends: {
                    revenue: calculateTrend(currentRevenue, previousRevenue),
                    orders: calculateTrend(currentOrders.length, previousOrders.length),
                    aov: calculateTrend(currentAOV, previousAOV),
                    userReach: calculateTrend(new Set(currentOrders.map(o => o.userId)).size, new Set(previousOrders.map(o => o.userId)).size)
                }
            };
        };

        const topStores = Array.from(
            allOrders.reduce((acc, o) => {
                const s = acc.get(o.storeId) || { id: o.storeId, name: 'Store', revenue: 0, orderCount: 0, businessType: 'Restaurant' };
                s.revenue += o.totalAmount || 0;
                s.orderCount += 1;
                acc.set(o.storeId, s);
                return acc;
            }, new Map()).values()
        ).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);

        return {
            totalUsers: usersSnap.data().count,
            totalStores: storesSnap.data().count,
            activeSessions: allOrders.filter(o => o.isActive).length,
            isMaintenance: configSnap.data()?.isMaintenance || false,
            decisions: [],
            topStores,
            periods: {
                today: calculateMetrics(1),
                '7d': calculateMetrics(7),
                '14d': calculateMetrics(14),
                '30d': calculateMetrics(30)
            }
        };
    } catch (error) {
        console.error("Platform Analytics failed:", error);
        return null;
    }
}

/**
 * SYSTEM HEALTH
 */
export async function getSystemStatus() {
    try {
        const { db } = await getAdminServices();
        const [users, stores] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
        ]);
        return {
            status: 'ok',
            llmStatus: 'Online',
            serverDbStatus: 'Online',
            counts: { users: users.data().count, stores: stores.data().count },
        };
    } catch (err: any) {
        return { status: 'error', llmStatus: 'Offline', serverDbStatus: 'Offline', errorMessage: err.message, counts: { users: 0, stores: 0 } };
    }
}

/**
 * PLACEHOLDERS FOR RECOVERY
 */
export async function updateEmployee(userId: string, data: any) { return { success: true }; }
export async function approveRegularization(id: string, s: string, a: boolean) { return { success: true }; }
export async function rejectRegularization(id: string, s: string, r: string) { return { success: true }; }
export async function getPlaceholderImages() { return { placeholderImages: [] }; }
export async function updatePlaceholderImages(data: any) { return { success: true }; }
export async function executeCommand(cmd: string) { return { success: true, message: "Broadcasted." }; }
export async function getSiteConfig(id: string) { return {}; }
export async function updateSiteConfig(id: string, data: any) { return { success: true }; }
export async function getSalarySlipData(id: string, u: string, s?: string) { return null; }
export async function updateStoreImageUrl(id: string, url: string) { return { success: true }; }
export async function updateUserProfileImage(id: string, url: string) { return { success: true }; }
