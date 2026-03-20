
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, Store, User, MenuItem, OrderItem, RestaurantIngredient, SalarySlip, EmployeeProfile, SiteConfig, GetIngredientsOutput } from '@/lib/types';
import { getApps } from 'firebase-admin/app';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';

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

export async function placeRestaurantOrder(
    items: any[],
    totalAmount: number,
    guestInfo: { name: string, phone: string, tableNumber: string },
    idToken: string
) {
    try {
        const { db, auth } = await getAdminServices();
        const decodedToken = await auth.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        
        const storeId = items[0].product.storeId;
        const orderId = db.collection('orders').doc().id;
        
        const orderData = {
            id: orderId,
            userId,
            storeId,
            customerName: guestInfo.name,
            phone: guestInfo.phone,
            tableNumber: guestInfo.tableNumber,
            status: 'Pending',
            isActive: true,
            orderDate: FieldValue.serverTimestamp(),
            totalAmount,
            items: items.map(i => ({
                id: Math.random().toString(36).substring(7),
                productName: i.product.name,
                productId: i.product.id,
                quantity: i.quantity,
                price: i.variant.price
            }))
        };

        await db.collection('orders').doc(orderId).set(orderData);
        return { success: true, orderId };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * BUSINESS ANALYTICS ENGINE
 */
export async function getStoreSalesReport({
  storeId,
  period,
}: {
  storeId: string;
  period: 'daily' | 'weekly' | 'monthly';
}) {
  const { db } = await getAdminServices();
  const now = new Date();
  let startDate: Date;

  if (period === 'daily') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else if (period === 'weekly') {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  } else {
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  try {
    const ordersSnap = await db.collection('orders')
        .where('storeId', '==', storeId)
        .where('isActive', '==', false)
        .where('orderDate', '>=', Timestamp.fromDate(startDate))
        .get();

    const orders = ordersSnap.docs.map(d => d.data() as Order);

    let totalSales = 0;
    let totalItems = 0;
    const tableMap = new Map<string, any>();

    orders.forEach(order => {
      totalSales += order.totalAmount;
      const tableKey = order.tableNumber || 'Delivery';
      const tableData = tableMap.get(tableKey) || { tableNumber: tableKey, totalSales: 0, orderCount: 0 };
      tableData.totalSales += order.totalAmount;
      tableData.orderCount += 1;

      order.items.forEach(item => {
        totalItems += item.quantity;
      });

      tableMap.set(tableKey, tableData);
    });

    return {
      success: true,
      report: {
        totalSales,
        totalItems,
        totalOrders: orders.length,
        salesByTable: Array.from(tableMap.values())
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * EXECUTIVE DASHBOARD ANALYTICS
 */
export async function getPlatformAnalytics() {
    try {
        const { db } = await getAdminServices();
        const [userCount, storeCount, activeSnap, appStatusSnap] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').where('isClosed', '!=', true).count().get(),
            db.collection('orders').where('isActive', '==', true).count().get(),
            db.collection('siteConfig').doc('appStatus').get()
        ]);

        return {
            totalUsers: userCount.data().count,
            totalStores: storeCount.data().count,
            activeSessions: activeSnap.data().count,
            isMaintenance: appStatusSnap.data()?.isMaintenance || false,
            decisions: [],
            topStores: [],
            periods: { today: { revenue: 0, orders: 0, trend: 0, trends: { revenue: 0, orders: 0, aov: 0, userReach: 0 } } }
        };
    } catch (error) {
        return null;
    }
}

/**
 * ATTENDANCE & STAFF MANAGEMENT
 */
export async function approveRegularization(recordId: string, storeId: string, approved: boolean) {
    const { db } = await getAdminServices();
    const recordRef = db.collection('stores').doc(storeId).collection('attendance').doc(recordId);
    await recordRef.update({
        status: approved ? 'approved' : 'rejected',
        updatedAt: FieldValue.serverTimestamp()
    });
    return { success: true };
}

export async function rejectRegularization(recordId: string, storeId: string, reason: string) {
    const { db } = await getAdminServices();
    const recordRef = db.collection('stores').doc(storeId).collection('attendance').doc(recordId);
    await recordRef.update({
        status: 'rejected',
        reasonHistory: FieldValue.arrayUnion({ text: reason, status: 'rejected', timestamp: new Date() }),
        updatedAt: FieldValue.serverTimestamp()
    });
    return { success: true };
}

export async function updateEmployee(userId: string, data: any) {
    const { db, auth } = await getAdminServices();
    const batch = db.batch();
    
    batch.update(db.collection('users').doc(userId), {
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phone,
        address: data.address
    });

    batch.update(db.collection('employeeProfiles').doc(userId), data);

    try {
        await auth.updateUser(userId, { email: data.email });
        await batch.commit();
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

/**
 * KNOWLEDGE & EXTERNAL APIs
 */
export async function getWikipediaSummary(topic: string) {
    try {
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
        const data = await response.json();
        return { summary: data.extract };
    } catch {
        return { error: "Failed to fetch knowledge." };
    }
}

export async function getMealDbRecipe(dish: string) {
    try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dish)}`);
        const data = await response.json();
        const meal = data.meals?.[0];
        if (!meal) return { error: "Recipe not found." };
        
        const ingredients = [];
        for (let i = 1; i <= 20; i++) {
            if (meal[`strIngredient${i}`]) {
                ingredients.push(`${meal[`strIngredient${i}`]} - ${meal[`strMeasure${i}`]}`);
            }
        }
        return { ingredients, instructions: meal.strInstructions };
    } catch {
        return { error: "Failed to fetch recipe." };
    }
}

/**
 * NLU TRAINING ACTIONS
 */
export async function approveRule(id: string, text: string) {
    const { db } = await getAdminServices();
    await db.collection('nlu_extracted_sentences').doc(id).update({ status: 'approved' });
    return { success: true };
}

export async function rejectRule(id: string) {
    const { db } = await getAdminServices();
    await db.collection('nlu_extracted_sentences').doc(id).update({ status: 'rejected' });
    return { success: true };
}

/**
 * SITE CONFIG & PWA
 */
export async function getManifest() {
    try {
        const fullPath = path.join(process.cwd(), 'public/manifest.json');
        const content = await fs.readFile(fullPath, 'utf8');
        return JSON.parse(content);
    } catch {
        return null;
    }
}

export async function updateManifest(manifest: any) {
    try {
        const fullPath = path.join(process.cwd(), 'public/manifest.json');
        await fs.writeFile(fullPath, JSON.stringify(manifest, null, 2));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getSiteConfig(id: string) {
    const { db } = await getAdminServices();
    const snap = await db.collection('siteConfig').doc(id).get();
    return snap.exists ? snap.data() : null;
}

export async function updateSiteConfig(id: string, config: any) {
    const { db } = await getAdminServices();
    await db.collection('siteConfig').doc(id).set(config, { merge: true });
    return { success: true };
}

/**
 * UTILITIES
 */
export async function executeCommand(commandType: string) {
    const { db } = await getAdminServices();
    try {
        if (commandType === 'maintenance_on') await db.collection('siteConfig').doc('appStatus').set({ isMaintenance: true }, { merge: true });
        if (commandType === 'maintenance_off') await db.collection('siteConfig').doc('appStatus').set({ isMaintenance: false }, { merge: true });
        return { success: true, message: `Command ${commandType} executed.` };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getFileContent(relativeFilePath: string): Promise<string> {
    try {
        const sanitizedPath = relativeFilePath.replace(/\.\./g, '').replace(/^\/+/, '');
        const fullPath = path.join(process.cwd(), sanitizedPath);
        return await fs.readFile(fullPath, 'utf8');
    } catch {
        return "Error: File not found.";
    }
}

export async function getFirebaseConfig() {
  try {
    const adminApp = getApps()[0] || (await getAdminServices()).app;
    const projectId = adminApp.options.projectId;
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: adminApp.options.authDomain,
      projectId: projectId,
      storageBucket: `${projectId}.appspot.com`,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  } catch {
    return null;
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
        return { status: 'error', llmStatus: 'Offline', serverDbStatus: 'Offline', errorMessage: err.message, counts: { users: 0, stores: 0 } };
    }
}

export async function bulkUploadRecipes(csvText: string) { return { success: true, count: 0 }; }
export async function importProductsFromUrl(url: string) { return { success: true, count: 0 }; }
export async function addIngredientsToCatalog(ingredients: any[]) { return { success: true, count: 0 }; }
export async function getSalarySlipData(slipId: string, userId: string, storeId?: string) { return null; }
