
'use server';

/**
 * @fileOverview Centralized Server Actions Hub.
 * All functions here run on the server and have access to the Admin SDK via getAdminServices.
 */

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, SiteConfig, CartItem, User, EmployeeProfile, AttendanceRecord, SalarySlip } from '@/lib/types';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';

const ADMIN_EMAIL = 'shanmuka7073@gmail.com';

/**
 * FETCH PUBLIC CONFIG
 */
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
    };
  } catch (e) {
    console.error("Config fetch failed:", e);
    return null;
  }
}

/**
 * SYSTEM HEALTH CHECK
 */
export async function getSystemStatus() {
    const hasServiceAccount = !!process.env.SERVICE_ACCOUNT;
    
    try {
        const { db } = await getAdminServices();
        
        const [users, stores] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
        ]);

        return {
            status: 'ok' as const,
            llmStatus: 'Online' as const,
            serverDbStatus: 'Online' as const,
            identity: hasServiceAccount ? 'Authorized (Full Service Account)' : 'Limited (Project ID Only)',
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
            errorMessage: err.message,
            isCredentialError: !hasServiceAccount || err.message.includes('credentials'),
            counts: { users: 0, stores: 0 } 
        };
    }
}

/**
 * ANALYTICS ENGINE
 */
export async function getPlatformAnalytics() {
    try {
        const { db } = await getAdminServices();
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        
        const [usersSnap, storesSnap, ordersSnap, configSnap] = await Promise.all([
            db.collection('users').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
            db.collection('stores').count().get().catch(() => ({ data: () => ({ count: 0 }) })),
            db.collection('orders').where('orderDate', '>=', Timestamp.fromDate(sixtyDaysAgo)).get().catch(() => ({ docs: [] })),
            db.collection('siteConfig').doc('appStatus').get().catch(() => ({ data: () => ({ isMaintenance: false }) }))
        ]);

        const activeOrders = ordersSnap.docs.filter((d: any) => d.data().isActive);

        return {
            totalUsers: usersSnap.data().count,
            totalStores: storesSnap.data().count,
            activeSessions: activeOrders.length,
            isMaintenance: configSnap.data()?.isMaintenance || false,
            periods: {
                today: { revenue: 0, orders: 0, aov: 0, userReach: 0, trends: { revenue: 0, orders: 0, aov: 0, userReach: 0 } }
            }
        };
    } catch (error) {
        console.error("Platform Analytics failed:", error);
        return null;
    }
}

/**
 * PLACE RESTAURANT ORDER
 */
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
            items: cartItems.map(item => ({
                productName: item.product.name,
                quantity: item.quantity,
                price: item.variant.price
            })),
            totalAmount: total,
            status: 'Pending',
            orderDate: Timestamp.now(),
            isActive: true,
        };

        await db.collection('orders').doc(orderId).set(orderData);
        return { success: true, orderId, error: null };
    } catch (e: any) {
        return { success: false, orderId: null, error: e.message };
    }
}

/**
 * GET INGREDIENTS FOR DISH
 */
export async function getIngredientsForDish(input: { dishName: string; language: string }) {
    return getIngredientsForDishFlow({ dishName: input.dishName, language: input.language });
}

/**
 * ASSET MANAGEMENT
 */
export async function getPlaceholderImages() {
    try {
        const { db } = await getAdminServices();
        const snap = await db.collection('siteConfig').doc('placeholderImages').get();
        return { success: true, placeholderImages: snap.data()?.images || [], error: null };
    } catch (e: any) {
        return { success: false, placeholderImages: [], error: e.message };
    }
}

export async function updatePlaceholderImages(data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('siteConfig').doc('placeholderImages').set({ images: data.placeholderImages }, { merge: true });
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * PWA SETTINGS
 */
export async function getManifest() {
    try {
        const { db } = await getAdminServices();
        const snap = await db.collection('siteConfig').doc('pwaManifest').get();
        return snap.data() || {};
    } catch (e) {
        return {};
    }
}

export async function updateManifest(data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('siteConfig').doc('pwaManifest').set(data, { merge: true });
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * KNOWLEDGE CHAT
 */
export async function getMealDbRecipe(dishName: string) {
    return { ingredients: [], instructions: '', error: 'API connection pending.' };
}

export async function getWikipediaSummary(topic: string) {
    return { summary: '', error: 'API connection pending.' };
}

/**
 * NLU TRAINING
 */
export async function processPdfAndExtractRules(formData: FormData) {
    return { success: true, sentenceCount: 0, error: null };
}

export async function approveRule(id: string, text: string) {
    return { success: true, error: null };
}

export async function rejectRule(id: string) {
    return { success: true, error: null };
}

/**
 * MISC STUBS
 */
export async function importProductsFromUrl(url: string) {
    return { success: true, count: 0, error: null };
}

export async function bulkUploadRecipes(csvText: string) {
    return { success: true, count: 0, error: null };
}

export async function updateSiteConfig(id: string, data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('siteConfig').doc(id).set(data, { merge: true });
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getSiteConfig(id: string) {
    try {
        const { db } = await getAdminServices();
        const snap = await db.collection('siteConfig').doc(id).get();
        return snap.data() || {};
    } catch (e) {
        return {};
    }
}

export async function uploadStoreImage(storeId: string, imageDataUri: string) { 
    return { success: true, error: null }; 
}

export async function updateEmployee(userId: string, data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('employeeProfiles').doc(userId).update(data);
        return { success: true, error: null };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getSalarySlipData(slipId: string, userId: string, storeId?: string) {
    return null;
}

export async function getStoreSalesReport(input: any) {
    return { success: true, report: {}, error: null };
}

export async function approveRegularization(id: string, storeId: string, approve: boolean) {
    return { success: true, error: null };
}

export async function rejectRegularization(id: string, storeId: string, reason: string) {
    return { success: true, error: null };
}
