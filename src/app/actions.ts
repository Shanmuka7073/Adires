
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig, NluExtractedSentence, MenuItem, Menu, CachedRecipe, GetIngredientsOutput, RestaurantIngredient, EmployeeProfile, SalarySlip, Store, AttendanceRecord, User, CartItem, ReportData } from '@/lib/types';
import { getApps } from 'firebase-admin/app';
import { v4 as uuidv4 } from 'uuid';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';

export async function getFirebaseConfig() {
  try {
    const adminApp = getApps()[0] || (await getAdminServices()).app;
    
    const projectId = adminApp.options.projectId;
    if (!projectId) {
      throw new Error("Firebase Project ID is not available in the admin config.");
    }
    const bucket = `${projectId}.appspot.com`;

    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: adminApp.options.authDomain,
      projectId: projectId,
      storageBucket: bucket,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  } catch (error: any) {
    console.error("Failed to get Firebase config:", error);
    return null;
  }
}

export async function updateUserProfileImage(userId: string, imageUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        const userDocRef = db.collection('users').doc(userId);
        await userDocRef.update({ imageUrl });
        return { success: true };
    } catch (error: any) {
        console.error('Server-side profile image URL update failed:', error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

export async function updateStoreImageUrl(storeId: string, imageUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        const storeDocRef = db.collection('stores').doc(storeId);
        await storeDocRef.update({ imageUrl });
        return { success: true };
    } catch (error: any) {
        console.error('Server-side image URL update failed:', error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

async function getFirestoreCounts() {
    try {
        const { db } = await getAdminServices();

        const [users, stores, partners, commands] = await Promise.all([
            db.collection('users').get(),
            db.collection('stores').get(),
            db.collection('deliveryPartners').get(),
            db.collection('voiceCommands').get(),
        ]);

        return {
            users: users.size,
            stores: stores.size,
            deliveryPartners: partners.size,
            voiceCommands: commands.size,
        };
    } catch (err) {
        console.error("Firestore count error:", err);
        return { users: 0, stores: 0, deliveryPartners: 0, voiceCommands: 0 };
    }
}

export async function getSystemStatus() {
    try {
        const counts = await getFirestoreCounts();
        return {
            status: 'ok',
            llmStatus: 'Online',
            serverDbStatus: 'Online',
            counts,
        };
    } catch (err: any) {
        console.error("System status check failed:", err);
        return {
            status: 'error',
            llmStatus: 'Offline',
            serverDbStatus: 'Offline',
            errorMessage: err?.message || 'Unknown server error',
            counts: { users: 0, stores: 0, deliveryPartners: 0, voiceCommands: 0 },
        };
    }
}

export async function addRestaurantOrderItem({
  storeId,
  tableNumber,
  sessionId,
  items,
  deliveryAddress,
  customerName,
  phone,
  deliveryLat,
  deliveryLng,
  zoneId,
  status = 'Pending',
}: {
  storeId: string;
  tableNumber: string | null;
  sessionId: string;
  items: CartItem[];
  deliveryAddress?: string;
  customerName?: string;
  phone?: string;
  deliveryLat?: number;
  deliveryLng?: number;
  zoneId?: string;
  status?: Order['status'];
}): Promise<{ success: boolean; error?: string; orderId?: string }> {
  try {
    const { db } = await getAdminServices();
    
    const orderDocRef = db.collection('orders').doc();
    const orderId = orderDocRef.id;

    const orderItems: OrderItem[] = items.map(item => ({
      id: uuidv4(), 
      orderId: orderId,
      productId: item.product.id,
      menuItemId: item.product.id, 
      productName: item.product.name, 
      variantSku: item.variant.sku,
      variantWeight: item.variant.weight, 
      quantity: item.quantity, 
      price: item.variant.price,
    }));

    const totalAmount = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    let orderType: Order['orderType'] = tableNumber === 'Counter' ? 'counter' : (tableNumber ? 'dine-in' : (deliveryAddress ? 'delivery' : 'takeaway'));

    const orderData = {
      id: orderId, 
      storeId: storeId, 
      tableNumber: tableNumber ? String(tableNumber) : null,
      sessionId: sessionId,
      userId: 'guest',
      customerName: customerName || (tableNumber === 'Counter' ? 'Walk-in Guest' : (tableNumber ? `Table ${tableNumber}` : 'Guest')),
      deliveryAddress: deliveryAddress || (tableNumber ? 'In-store dining' : 'TBD'),
      deliveryLat: deliveryLat || 0,
      deliveryLng: deliveryLng || 0,
      zoneId: zoneId || 'local-service',
      phone: phone || '',
      status: status,
      orderType: orderType,
      isActive: true, 
      orderDate: FieldValue.serverTimestamp(), 
      updatedAt: FieldValue.serverTimestamp(),
      items: orderItems,
      totalAmount: totalAmount,
    };

    await orderDocRef.set(orderData);

    return { success: true, orderId };
  } catch (error: any) {
    console.error("Robust POS add failed:", error);
    return { success: false, error: error.message };
  }
}

export async function updateOrderStatus(orderId: string, status: Order['status']): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        const isActive = !['Delivered', 'Completed', 'Cancelled'].includes(status);
        await db.collection('orders').doc(orderId).update({
            status,
            isActive,
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function confirmOrderSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await getAdminServices();
    const snapshot = await db.collection('orders').where('sessionId', '==', sessionId).where('isActive', '==', true).get();
    
    if (snapshot.empty) return { success: false, error: 'No active orders found.' };
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { 
          status: 'Billed', 
          updatedAt: FieldValue.serverTimestamp() 
      });
    });
    
    await batch.commit();
    return { success: true };
  } catch (error: any) { 
      return { success: false, error: error.message }; 
  }
}

export async function markSessionAsPaid(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await getAdminServices();
    const snapshot = await db.collection('orders').where('sessionId', '==', sessionId).where('isActive', '==', true).get();
    if (snapshot.empty) return { success: true };
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'Completed', isActive: false, paidAt: Timestamp.now() });
    });
    await batch.commit();
    return { success: true };
  } catch (error: any) { return { success: false, error: error.message }; }
}

export async function requestTableService(sessionId: string, type: string = 'assistance'): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        const snapshot = await db.collection('orders').where('sessionId', '==', sessionId).where('isActive', '==', true).limit(1).get();
        
        if (snapshot.empty) return { success: false, error: 'No active session found.' };
        
        const orderRef = snapshot.docs[0].ref;
        await orderRef.update({ 
            needsService: true, 
            serviceType: type,
            updatedAt: FieldValue.serverTimestamp() 
        });
        
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function dismissTableService(orderId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        await db.collection('orders').doc(orderId).update({
            needsService: false,
            serviceType: null,
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getIngredientsForDish(input: { dishName: string; language: 'en' | 'te', existingRecipe?: GetIngredientsOutput }) {
    try {
        return await getIngredientsForDishFlow(input);
    } catch (error: any) {
        console.error("Action error: getIngredientsForDish:", error);
        throw error;
    }
}

export async function getSiteConfig(configId: string): Promise<SiteConfig | null> {
    try {
        const { db } = await getAdminServices();
        const docSnap = await db.collection('siteConfig').doc(configId).get();
        if (docSnap.exists) {
            return docSnap.data() as SiteConfig;
        }
        return null;
    } catch (error) {
        console.error("Error getting site config:", error);
        return null;
    }
}

export async function updateSiteConfig(configId: string, data: Partial<SiteConfig>): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        await db.collection('siteConfig').doc(configId).set(data, { merge: true });
        return { success: true };
    } catch (error) {
        console.error("Error updating site config:", error);
        return { success: false, error: error.message };
    }
}

export async function getMealDbRecipe(dishName: string): Promise<{ ingredients?: string[]; instructions?: string[]; error?: string }> {
    try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dishName)}`);
        const data = await response.json();
        if (data.meals && data.meals.length > 0) {
            const meal = data.meals[0];
            const ingredients: string[] = [];
            for (let i = 1; i <= 20; i++) {
                const ingredient = meal[`strIngredient${i}`];
                const measure = meal[`strMeasure${i}`];
                if (ingredient && ingredient.trim()) {
                    ingredients.push(`${measure} ${ingredient}`.trim());
                }
            }
            return {
                ingredients,
                instructions: meal.strInstructions.split('\r\n').filter((s: string) => s.trim())
            };
        }
        return { error: "Recipe not found." };
    } catch (e: any) {
        return { error: e.message };
    }
}

/**
 * Robust Sales Reporting Logic
 */
export async function getStoreSalesReport({
  storeId,
  period,
}: {
  storeId: string;
  period: 'daily' | 'weekly' | 'monthly';
}): Promise<{ success: boolean; report?: ReportData; error?: string }> {
  try {
    const { db } = await getAdminServices();
    const now = new Date();
    let startDate: Date;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      startDate = new Date(now.setDate(now.getDate() - 7));
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const startTimestamp = Timestamp.fromDate(startDate);

    const ordersSnapshot = await db.collection('orders')
      .where('storeId', '==', storeId)
      .where('status', 'in', ['Delivered', 'Completed'])
      .where('orderDate', '>=', startTimestamp)
      .get();

    const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

    let totalSales = 0;
    let totalItems = 0;
    const productStats = new Map<string, { count: number; totalRevenue: number }>();
    const tableStats = new Map<string, { totalSales: number; orderCount: number }>();

    orders.forEach(order => {
      totalSales += order.totalAmount;
      const tableKey = order.tableNumber || 'Delivery';
      const tStat = tableStats.get(tableKey) || { totalSales: 0, orderCount: 0 };
      tStat.totalSales += order.totalAmount;
      tStat.orderCount += 1;
      tableStats.set(tableKey, tStat);

      order.items.forEach(item => {
        totalItems += item.quantity;
        const pStat = productStats.get(item.productName) || { count: 0, totalRevenue: 0 };
        pStat.count += item.quantity;
        pStat.totalRevenue += (item.price * item.quantity);
        productStats.set(item.productName, pStat);
      });
    });

    const report: ReportData = {
      totalSales,
      totalItems,
      totalOrders: orders.length,
      topProducts: Array.from(productStats.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, stat]) => ({ name, count: stat.count })),
      topProfitableProducts: Array.from(productStats.entries())
        .sort((a, b) => b[1].totalRevenue - a[1].totalRevenue)
        .slice(0, 5)
        .map(([name, stat]) => ({ name, totalProfit: stat.totalRevenue, profitPerUnit: stat.totalRevenue / stat.count, count: stat.count })),
      ingredientUsage: [], // Requires recipe snapshots which might not be in every order yet
      ingredientCost: 0,
      costDrivers: [],
      optimizationHint: null,
      salesByTable: Array.from(tableStats.entries()).map(([table, stat]) => ({
        tableNumber: table,
        totalSales: stat.totalSales,
        orderCount: stat.orderCount,
        totalCost: 0,
        profitPerOrder: stat.totalSales / stat.orderCount,
        grossProfit: stat.totalSales,
        profitPercentage: 100,
      })),
    };

    return { success: true, report };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
