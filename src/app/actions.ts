'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, Store, User, MenuItem, OrderItem } from '@/lib/types';
import { getApps } from 'firebase-admin/app';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';

/**
 * AI INGREDIENT ANALYSIS
 * Wraps the Genkit flow for client-side use.
 */
export async function getIngredientsForDish(input: { dishName: string; language: 'en' | 'te' }) {
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
 * Atomically adds an item to a table session using the Embedded Array pattern.
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
 * EXECUTIVE DECISION ENGINE
 * Optimized to fetch multi-period analytics in a single pass.
 */
export async function getPlatformAnalytics() {
    try {
        const { db } = await getAdminServices();
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        // Multi-period anchors
        const start7d = new Date(todayStart); start7d.setDate(todayStart.getDate() - 7);
        const start14d = new Date(todayStart); start14d.setDate(todayStart.getDate() - 14);
        const start30d = new Date(todayStart); start30d.setDate(todayStart.getDate() - 30);
        const start60d = new Date(todayStart); start60d.setDate(todayStart.getDate() - 60);
        
        const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(todayStart.getDate() - 1);
        const prev7dStart = new Date(start7d); prev7dStart.setDate(prev7dStart.getDate() - 7);
        const prev14dStart = new Date(start14d); prev14dStart.setDate(prev14dStart.getDate() - 14);
        const prev30dStart = new Date(start30d); prev30dStart.setDate(prev30dStart.getDate() - 30);

        const [
            userCount, 
            storeCount, 
            recentOrdersSnap,
            activeSessionsSnap,
            deliveryPartnersSnap,
            appStatusSnap
        ] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').where('isClosed', '!=', true).count().get(),
            // Fetch 60 days for period-over-period comparison
            db.collection('orders').where('orderDate', '>=', Timestamp.fromDate(start60d)).get(),
            db.collection('orders').where('isActive', '==', true).count().get(),
            db.collection('deliveryPartners').get(),
            db.collection('siteConfig').doc('appStatus').get()
        ]);

        const allRecentOrders = recentOrdersSnap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        const partners = deliveryPartnersSnap.docs.map(d => d.data());
        const appStatus = appStatusSnap.data() || { isMaintenance: false };

        const filterOrders = (start: Date, end?: Date) => {
            return allRecentOrders.filter(o => {
                const date = o.orderDate instanceof Timestamp ? o.orderDate.toDate() : new Date(o.orderDate);
                const isAfterStart = date >= start;
                const isBeforeEnd = end ? date < end : true;
                return isAfterStart && isBeforeEnd;
            });
        };

        const successful = (orders: Order[]) => orders.filter(o => ['Delivered', 'Completed'].includes(o.status));

        const calculatePeriodMetrics = (currentOrders: Order[], prevOrders: Order[]) => {
            const currentSuccessful = successful(currentOrders);
            const prevSuccessful = successful(prevOrders);

            const currentRevenue = currentSuccessful.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
            const prevRevenue = prevSuccessful.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
            
            const currentAov = currentSuccessful.length > 0 ? currentRevenue / currentSuccessful.length : 0;
            const prevAov = prevSuccessful.length > 0 ? prevRevenue / prevSuccessful.length : 0;

            const currentUserReach = new Set(currentOrders.map(o => o.userId)).size;
            const prevUserReach = new Set(prevOrders.map(o => o.userId)).size;

            const calcTrend = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : (curr > 0 ? 100 : 0);

            return {
                revenue: currentRevenue,
                orders: currentOrders.length,
                aov: currentAov,
                userReach: currentUserReach,
                trends: {
                    revenue: calcTrend(currentRevenue, prevRevenue),
                    orders: calcTrend(currentOrders.length, prevOrders.length),
                    aov: calcTrend(currentAov, prevAov),
                    userReach: calcTrend(currentUserReach, prevUserReach)
                }
            };
        };

        // PERIOD DATA
        const periods = {
            today: calculatePeriodMetrics(filterOrders(todayStart), filterOrders(yesterdayStart, todayStart)),
            '7d': calculatePeriodMetrics(filterOrders(start7d), filterOrders(prev7dStart, start7d)),
            '14d': calculatePeriodMetrics(filterOrders(start14d), filterOrders(prev14dStart, start14d)),
            '30d': calculatePeriodMetrics(filterOrders(start30d), filterOrders(prev30dStart, start30d))
        };

        const decisions = [];
        if (appStatus.isMaintenance) {
            decisions.push({
                type: 'critical',
                title: 'Platform Halted',
                message: 'Maintenance Mode is currently ACTIVE. Standard users are locked out.',
                action: 'Maintenance Off'
            });
        }

        // Top Stores calculation (30 days)
        const storeRevenueMap = new Map<string, { revenue: number, orderCount: number, name: string, businessType: string }>();
        successful(filterOrders(start30d)).forEach(o => {
            const current = storeRevenueMap.get(o.storeId) || { revenue: 0, orderCount: 0, name: 'Verified Store', businessType: 'Retail' };
            current.revenue += o.totalAmount;
            current.orderCount += 1;
            storeRevenueMap.set(o.storeId, current);
        });

        const topStores = Array.from(storeRevenueMap.entries())
            .map(([id, stats]) => ({ id, ...stats }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 5);

        return {
            totalUsers: userCount.data().count || 0,
            totalStores: storeCount.data().count || 0,
            activeSessions: activeSessionsSnap.data().count || 0,
            fulfillmentRate: 98.4,
            isMaintenance: appStatus.isMaintenance || false,
            decisions,
            topStores,
            periods
        };
    } catch (error: any) {
        console.error("Platform Analytics failed:", error);
        return null;
    }
}

export async function executeCommand(commandType: string) {
    const { db } = await getAdminServices();
    const timestamp = Timestamp.now();

    try {
        switch (commandType) {
            case 'reward_boost':
            case 'boost_partner_rewards':
                await db.collection('siteConfig').doc('partnerRewards').set({
                    multiplier: 1.5,
                    active: true,
                    updatedAt: timestamp,
                    expiresAt: Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 60 * 1000))
                }, { merge: true });
                return { success: true, message: 'Partner rewards boosted platform-wide.' };
            
            case 'flash_promo':
            case 'trigger_flash_promo':
                await db.collection('siteConfig').doc('promotions').set({
                    title: 'Evening Rush: 10% Off',
                    active: true,
                    updatedAt: timestamp
                }, { merge: true });
                return { success: true, message: 'Flash promotion live on all storefronts.' };

            case 'maintenance_on':
            case 'maintenance_mode':
                await db.collection('siteConfig').doc('appStatus').set({ 
                    isMaintenance: true,
                    updatedAt: timestamp
                }, { merge: true });
                return { success: true, message: 'App set to Maintenance Mode.' };

            case 'maintenance_off':
                await db.collection('siteConfig').doc('appStatus').set({ 
                    isMaintenance: false,
                    updatedAt: timestamp
                }, { merge: true });
                return { success: true, message: 'App is now LIVE again.' };

            default:
                throw new Error(`Command "${commandType}" is not implemented.`);
        }
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getFileContent(relativeFilePath: string): Promise<string> {
    try {
        const sanitizedPath = relativeFilePath.replace(/\.\./g, '').replace(/^\/+/, '');
        const fullPath = path.join(process.cwd(), sanitizedPath);
        const content = await fs.readFile(fullPath, 'utf8');
        return content;
    } catch (error: any) {
        console.error("getFileContent failed:", error);
        return `Error: Could not read file at ${relativeFilePath}.`;
    }
}

export async function getFirebaseConfig() {
  try {
    const adminApp = getApps()[0] || (await getAdminServices()).app;
    const projectId = adminApp.options.projectId;
    if (!projectId) throw new Error("Project ID missing.");
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: adminApp.options.authDomain,
      projectId: projectId,
      storageBucket: `${projectId}.appspot.com`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  } catch (error: any) {
    return null;
  }
}

export async function updateStoreImageUrl(storeId: string, imageUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        await db.collection('stores').doc(storeId).update({ imageUrl });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

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
        return {
            status: 'error',
            llmStatus: 'Offline',
            serverDbStatus: 'Offline',
            errorMessage: err?.message,
            counts: { users: 0, stores: 0 },
        };
    }
}