'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, Store, User, MenuItem, OrderItem, RestaurantIngredient, SalarySlip, EmployeeProfile, SiteConfig } from '@/lib/types';
import { getApps } from 'firebase-admin/app';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';

/**
 * AI INGREDIENT ANALYSIS
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
    const [ordersSnap, ingredientsSnap] = await Promise.all([
      db.collection('orders')
        .where('storeId', '==', storeId)
        .where('isActive', '==', false)
        .where('orderDate', '>=', Timestamp.fromDate(startDate))
        .get(),
      db.collection('restaurantIngredients').get()
    ]);

    const orders = ordersSnap.docs.map(d => d.data() as Order);
    const ingredientCosts = new Map(ingredientsSnap.docs.map(d => [d.id, d.data() as RestaurantIngredient]));

    let totalSales = 0;
    let totalItems = 0;
    let ingredientCost = 0;
    const tableMap = new Map<string, any>();
    const itemProfitMap = new Map<string, any>();
    const categoryCostMap = new Map<string, number>();

    orders.forEach(order => {
      totalSales += order.totalAmount;
      const tableKey = order.tableNumber || 'Delivery';
      const tableData = tableMap.get(tableKey) || { tableNumber: tableKey, totalSales: 0, orderCount: 0, totalCost: 0 };
      tableData.totalSales += order.totalAmount;
      tableData.orderCount += 1;

      order.items.forEach(item => {
        totalItems += item.quantity;
        let itemCost = 0;
        
        // Simplified cost calculation for demonstration
        // In a real app, you'd iterate through item.recipeSnapshot
        const baseCost = ingredientCosts.get(item.productName.toLowerCase())?.cost || (item.price * 0.3);
        itemCost = baseCost * item.quantity;
        
        tableData.totalCost += itemCost;
        ingredientCost += itemCost;

        const pData = itemProfitMap.get(item.productName) || { name: item.productName, count: 0, totalProfit: 0 };
        pData.count += item.quantity;
        pData.totalProfit += (item.price * item.quantity) - itemCost;
        itemProfitMap.set(item.productName, pData);
      });

      tableMap.set(tableKey, tableData);
    });

    const salesByTable = Array.from(tableMap.values()).map(t => ({
        ...t,
        profitPerOrder: t.orderCount > 0 ? (t.totalSales - t.totalCost) / t.orderCount : 0,
        grossProfit: t.totalSales - t.totalCost,
        profitPercentage: t.totalSales > 0 ? ((t.totalSales - t.totalCost) / t.totalSales) * 100 : 0
    }));

    const topProfitableProducts = Array.from(itemProfitMap.values())
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 5);

    return {
      success: true,
      report: {
        totalSales,
        totalItems,
        totalOrders: orders.length,
        ingredientCost,
        salesByTable,
        topProfitableProducts,
        optimizationHint: ingredientCost > (totalSales * 0.45) 
            ? "Your ingredient costs are above 45%. Consider adjusting portions or prices." 
            : "Margins are healthy. Keep monitoring seasonal price shifts."
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
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const start30d = new Date(todayStart); start30d.setDate(todayStart.getDate() - 30);
        const start60d = new Date(todayStart); start60d.setDate(todayStart.getDate() - 60);

        const [userCount, storeCount, ordersSnap, activeSnap, appStatusSnap] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').where('isClosed', '!=', true).count().get(),
            db.collection('orders').where('orderDate', '>=', Timestamp.fromDate(start60d)).get(),
            db.collection('orders').where('isActive', '==', true).count().get(),
            db.collection('siteConfig').doc('appStatus').get()
        ]);

        const allOrders = ordersSnap.docs.map(d => d.data() as Order);
        const appStatus = appStatusSnap.data() || { isMaintenance: false };

        const filterOrders = (start: Date, end?: Date) => {
            return allOrders.filter(o => {
                const d = o.orderDate instanceof Timestamp ? o.orderDate.toDate() : new Date(o.orderDate);
                return d >= start && (end ? d < end : true);
            });
        };

        const calcMetrics = (current: Order[], prev: Order[]) => {
            const currRev = current.reduce((acc, o) => acc + o.totalAmount, 0);
            const prevRev = prev.reduce((acc, o) => acc + o.totalAmount, 0);
            const trend = prevRev > 0 ? ((currRev - prevRev) / prevRev) * 100 : 0;
            return { revenue: currRev, orders: current.length, trend };
        };

        const todayOrders = filterOrders(todayStart);
        const yesterdayOrders = filterOrders(new Date(todayStart.getTime() - 86400000), todayStart);

        return {
            totalUsers: userCount.data().count,
            totalStores: storeCount.data().count,
            activeSessions: activeSnap.data().count,
            isMaintenance: appStatus.isMaintenance,
            decisions: appStatus.isMaintenance ? [{ type: 'critical', title: 'Maintenance Active', message: 'Platform is locked.', action: 'Maintenance Off' }] : [],
            topStores: [],
            periods: {
                today: calcMetrics(todayOrders, yesterdayOrders)
            }
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

export async function updateStoreImageUrl(storeId: string, imageUrl: string) {
    const { db } = await getAdminServices();
    await db.collection('stores').doc(storeId).update({ imageUrl });
    return { success: true };
}

export async function updateUserProfileImage(userId: string, imageUrl: string) {
    const { db } = await getAdminServices();
    await db.collection('users').doc(userId).update({ imageUrl });
    return { success: true };
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
            llmStatus: 'Offline',
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
