
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig, NluExtractedSentence, MenuItem, Menu, CachedRecipe, GetIngredientsOutput, RestaurantIngredient, EmployeeProfile, SalarySlip, Store, AttendanceRecord, User, CartItem, ReportData } from '@/lib/types';
import { getApps } from 'firebase-admin/app';
import { v4 as uuidv4 } from 'uuid';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';

/**
 * Allows Asha to read the source code of the current page for analysis.
 */
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

/**
 * Advanced Sales Reporting with Profitability Analysis
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
    let totalIngredientCost = 0;
    const productStats = new Map<string, { count: number; totalRevenue: number; totalCost: number }>();
    const tableStats = new Map<string, { totalSales: number; orderCount: number; totalCost: number }>();
    const ingredientUsageMap = new Map<string, { quantity: number; unit: string; cost: number }>();

    orders.forEach(order => {
      totalSales += order.totalAmount;
      const tableKey = order.tableNumber || 'Delivery';
      const tStat = tableStats.get(tableKey) || { totalSales: 0, orderCount: 0, totalCost: 0 };
      
      tStat.totalSales += order.totalAmount;
      tStat.orderCount += 1;

      order.items.forEach(item => {
        const pStat = productStats.get(item.productName) || { count: 0, totalRevenue: 0, totalCost: 0 };
        pStat.count += item.quantity;
        pStat.totalRevenue += (item.price * item.quantity);
        
        // Calculate estimated cost if recipe snapshot exists
        let itemCost = 0;
        if (item.recipeSnapshot) {
            item.recipeSnapshot.forEach(ing => {
                const cost = (ing.cost || 0) * item.quantity;
                itemCost += cost;
                
                const prev = ingredientUsageMap.get(ing.name) || { quantity: 0, unit: ing.unit, cost: 0 };
                ingredientUsageMap.set(ing.name, {
                    quantity: prev.quantity + (ing.qty * item.quantity),
                    unit: ing.unit,
                    cost: prev.cost + cost
                });
            });
        }
        
        pStat.totalCost += itemCost;
        tStat.totalCost += itemCost;
        totalIngredientCost += itemCost;
        
        productStats.set(item.productName, pStat);
      });
      
      tableStats.set(tableKey, tStat);
    });

    const report: ReportData = {
      totalSales,
      totalItems: orders.reduce((acc, o) => acc + o.items.length, 0),
      totalOrders: orders.length,
      topProducts: Array.from(productStats.entries())
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, 5)
        .map(([name, stat]) => ({ name, count: stat.count })),
      topProfitableProducts: Array.from(productStats.entries())
        .map(([name, stat]) => ({
            name,
            totalProfit: stat.totalRevenue - stat.totalCost,
            profitPerUnit: (stat.totalRevenue - stat.totalCost) / stat.count,
            count: stat.count
        }))
        .sort((a, b) => b.totalProfit - a.totalProfit)
        .slice(0, 5),
      ingredientUsage: Array.from(ingredientUsageMap.entries()).map(([name, data]) => ({
          name,
          quantity: data.quantity,
          unit: data.unit,
          cost: data.cost
      })),
      ingredientCost: totalIngredientCost,
      costDrivers: Array.from(ingredientUsageMap.entries())
        .map(([name, data]) => ({
            name,
            cost: data.cost,
            percentage: totalIngredientCost > 0 ? (data.cost / totalIngredientCost) * 100 : 0
        }))
        .sort((a, b) => b.cost - a.cost)
        .slice(0, 5),
      optimizationHint: totalIngredientCost > (totalSales * 0.5) 
        ? "Warning: Your ingredient costs exceed 50% of revenue. Check for portion waste or consider a price review." 
        : "Healthy margin detected. Continue monitoring top cost drivers.",
      salesByTable: Array.from(tableStats.entries()).map(([table, stat]) => ({
        tableNumber: table,
        totalSales: stat.totalSales,
        orderCount: stat.orderCount,
        totalCost: stat.totalCost,
        profitPerOrder: stat.orderCount > 0 ? (stat.totalSales - stat.totalCost) / stat.orderCount : 0,
        grossProfit: stat.totalSales - stat.totalCost,
        profitPercentage: stat.totalSales > 0 ? ((stat.totalSales - stat.totalCost) / stat.totalSales) * 100 : 0,
      })),
    };

    return { success: true, report };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getIngredientsForDish(input: { dishName: string; language: 'en' | 'te', existingRecipe?: GetIngredientsOutput }) {
    try {
        return await getIngredientsForDishFlow(input);
    } catch (error: any) {
        throw error;
    }
}
