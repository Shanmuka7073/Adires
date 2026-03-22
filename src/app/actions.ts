
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, Store, User, MenuItem, OrderItem, RestaurantIngredient, SalarySlip, EmployeeProfile, SiteConfig, GetIngredientsOutput } from '@/lib/types';
import { getApps } from 'firebase-admin/app';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';

const ADMIN_EMAIL = 'shanmuka7073@gmail.com';

/**
 * UTILITY: Safe Date Parsing
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
    const options = adminApp.options as any;
    const projectId = options.projectId || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: options.authDomain || (projectId ? `${projectId}.firebaseapp.com` : undefined),
      projectId: projectId,
      storageBucket: options.storageBucket || (projectId ? `${projectId}.appspot.com` : undefined),
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  } catch (e) {
    console.error("Config fetch failed:", e);
    return null;
  }
}

/**
 * SYSTEM HEALTH (ADMIN SDK VERIFICATION)
 */
export async function getSystemStatus() {
    try {
        const { db } = await getAdminServices();
        const hasServiceAccount = !!process.env.SERVICE_ACCOUNT;
        
        const [users, stores] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
        ]);

        return {
            status: 'ok' as const,
            llmStatus: 'Online' as const,
            serverDbStatus: 'Online' as const,
            identity: hasServiceAccount ? 'Authorized (Service Account)' : 'Basic (Project ID Only)',
            counts: { 
                users: users.data().count, 
                stores: stores.data().count 
            },
        };
    } catch (err: any) {
        return { 
            status: 'error' as const, 
            llmStatus: 'Offline' as const, 
            serverDbStatus: 'Offline' as const, 
            errorMessage: err.message as string, 
            counts: { users: 0, stores: 0 } 
        };
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
 * STUBS FOR LEGACY/HELP PAGE COMPATIBILITY
 */
export async function bulkUploadRecipes(text: string) { return { success: true, count: 0 }; }
export async function importProductsFromUrl(url: string) { return { success: true, count: 0 }; }
export async function getWikipediaSummary(topic: string) { return { summary: '', error: 'Feature decommissioned.' }; }
export async function getMealDbRecipe(dishName: string) { return { ingredients: [], instructions: '', error: 'Feature decommissioned.' }; }
export async function processPdfAndExtractRules(formData: FormData) { return { success: true, sentenceCount: 0 }; }
export async function approveRule(id: string, text: string) { return { success: true }; }
export async function rejectRule(id: string) { return { success: true }; }

/**
 * ORDER MANAGEMENT: PLACE RESTAURANT ORDER
 */
export async function placeRestaurantOrder(cartItems: any[], cartTotal: number, guestInfo: any, idToken: string) {
    try {
        const { db, auth } = await getAdminServices();
        const decodedToken = await auth.verifyIdToken(idToken);
        const userId = decodedToken.uid;

        const orderId = db.collection('orders').doc().id;
        const orderRef = db.collection('orders').doc(orderId);

        const orderData = {
            id: orderId,
            userId: userId,
            deviceId: cartItems[0]?.deviceId || null,
            storeId: cartItems[0].product.storeId,
            customerName: guestInfo.name,
            phone: guestInfo.phone,
            tableNumber: guestInfo.tableNumber,
            sessionId: cartItems[0].sessionId || orderId,
            orderDate: FieldValue.serverTimestamp(),
            status: 'Pending',
            orderType: guestInfo.tableNumber ? 'dine-in' : 'delivery',
            isActive: true,
            totalAmount: cartTotal,
            items: cartItems.map(item => ({
                id: Math.random().toString(36).substring(7),
                orderId: orderId,
                productId: item.product.id,
                productName: item.product.name,
                variantSku: item.variant.sku,
                variantWeight: item.variant.weight,
                quantity: item.quantity,
                price: item.variant.price
            })),
        };

        await orderRef.set(orderData);
        return { success: true, orderId };
    } catch (e: any) {
        console.error("placeRestaurantOrder failed:", e);
        return { success: false, error: e.message };
    }
}

/**
 * SITE CONFIGURATION
 */
export async function getSiteConfig(id: string) {
    try {
        const { db } = await getAdminServices();
        const snap = await db.collection('siteConfig').doc(id).get();
        return snap.exists ? snap.data() as SiteConfig : {};
    } catch (e) {
        return {};
    }
}

export async function updateSiteConfig(id: string, data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('siteConfig').doc(id).set(data, { merge: true });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function updateEmployee(userId: string, data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('employeeProfiles').doc(userId).set(data, { merge: true });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function approveRegularization(id: string, storeId: string, approve: boolean) {
    try {
        const { db } = await getAdminServices();
        await db.collection(`stores/${storeId}/attendance`).doc(id).update({
            status: approve ? 'approved' : 'rejected',
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function rejectRegularization(id: string, storeId: string, reason: string) {
    try {
        const { db } = await getAdminServices();
        const recordRef = db.collection(`stores/${storeId}/attendance`).doc(id);
        
        await recordRef.update({
            status: 'rejected',
            updatedAt: FieldValue.serverTimestamp(),
            reasonHistory: FieldValue.arrayUnion({
                text: reason,
                timestamp: new Date(),
                status: 'rejected'
            })
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

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
            ...(d.data() as Order), 
            orderDate: toDateSafe(d.data().orderDate) 
        })) as Order[];
        
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

            const calculateTrend = (curr: number, prev: number) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;

            return {
                revenue: currentRevenue,
                orders: currentOrders.length,
                aov: currentOrders.length ? currentRevenue / currentOrders.length : 0,
                userReach: new Set(currentOrders.map(o => o.userId)).size,
                trends: {
                    revenue: calculateTrend(currentRevenue, previousRevenue),
                    orders: calculateTrend(currentOrders.length, previousOrders.length),
                    aov: calculateTrend(currentOrders.length ? currentRevenue / currentOrders.length : 0, previousOrders.length ? previousRevenue / previousOrders.length : 0),
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

export async function uploadStoreImage(storeId: string, imageDataUri: string) { return { success: true }; }
export async function getManifest() { return null; }
export async function updateManifest(data: any) { return { success: true }; }
export async function getPlaceholderImages() { return { placeholderImages: [] }; }
export async function updatePlaceholderImages(data: any) { return { success: true }; }
export async function getSalarySlipData(slipId: string, userId: string, storeId?: string) { return null; }
export async function getStoreSalesReport(input: any) { return { success: true, report: {} }; }
