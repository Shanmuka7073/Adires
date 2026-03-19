
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig, NluExtractedSentence, MenuItem, Menu, CachedRecipe, GetIngredientsOutput, RestaurantIngredient, EmployeeProfile, SalarySlip, Store, AttendanceRecord, User, CartItem, ReportData, Ingredient } from '@/lib/types';
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
 * HELPER: Normalizes quantities to a base unit (g or ml) for cost calculation.
 */
const convertToBaseUnit = (quantity: number, unit: string): number => {
    const u = unit?.toLowerCase().trim() || '';
    if (u === 'kg' || u === 'l' || u === 'litre' || u === 'liter') return quantity * 1000;
    if (u === 'g' || u === 'gm' || u === 'gram' || u === 'grams' || u === 'ml' || u === 'millilitre' || u === 'milliliter') return quantity;
    return quantity; // Default for pcs, packets etc
};

/**
 * Advanced Sales Reporting with Dynamic Cost Lookup.
 * Joins Order Items with Cached Recipes and Master Ingredient Costs.
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

    // 1. Parallel Fetch of Orders, Recipes (Cache), and Master Costs
    const [ordersSnapshot, recipesSnapshot, costsSnapshot] = await Promise.all([
      db.collection('orders')
        .where('storeId', '==', storeId)
        .where('status', 'in', ['Delivered', 'Completed', 'Billed'])
        .where('orderDate', '>=', startTimestamp)
        .get(),
      db.collection('cachedRecipes').get(),
      db.collection('restaurantIngredients').get()
    ]);

    const orders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    
    // 2. Build Lookup Maps
    const recipeMap = new Map<string, Ingredient[]>();
    recipesSnapshot.forEach(doc => {
        const data = doc.data();
        const components = data.components || data.ingredients || [];
        // The ID is normally "dish-name_en", so we store it keyed by slug
        const slug = doc.id.split('_')[0];
        recipeMap.set(slug, components);
    });

    const costMap = new Map<string, RestaurantIngredient>();
    costsSnapshot.forEach(doc => {
        costMap.set(doc.id.toLowerCase(), doc.data() as RestaurantIngredient);
    });

    const createSlug = (text: string) => text.toLowerCase().trim().replace(/\s+/g, '-').replace(/[^\w-]+/g, '');

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
        
        let itemCost = 0;
        
        // A. Priority: Check if order item has its own snapshot
        const recipe = item.recipeSnapshot || recipeMap.get(createSlug(item.productName));

        if (recipe) {
            recipe.forEach((ing: any) => {
                const masterCost = costMap.get(ing.name.toLowerCase());
                if (masterCost) {
                    // Normalize master cost to base unit (g or ml)
                    const masterBaseVal = convertToBaseUnit(1, masterCost.unit);
                    const costPerBase = masterCost.cost / masterBaseVal;

                    // Normalize consumption to base unit
                    const consumedBaseVal = convertToBaseUnit(ing.qty || parseFloat(ing.quantity) || 0, ing.unit || (ing.quantity?.includes('g') ? 'g' : 'kg'));
                    const ingCost = consumedBaseVal * costPerBase * item.quantity;
                    
                    itemCost += ingCost;

                    const prev = ingredientUsageMap.get(ing.name) || { quantity: 0, unit: masterCost.unit === 'kg' ? 'g' : masterCost.unit, cost: 0 };
                    ingredientUsageMap.set(ing.name, {
                        quantity: prev.quantity + (consumedBaseVal * item.quantity),
                        unit: prev.unit,
                        cost: prev.cost + ingCost
                    });
                }
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
            profitPerUnit: stat.count > 0 ? (stat.totalRevenue - stat.totalCost) / stat.count : 0,
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
    console.error("getStoreSalesReport failed:", error);
    return { success: false, error: error.message };
  }
}

export async function addIngredientsToCatalog(ingredients: Omit<RestaurantIngredient, 'id'>[]) {
    try {
        const { db } = await getAdminServices();
        const batch = db.batch();
        
        ingredients.forEach(ing => {
            const docId = ing.name.toLowerCase().trim();
            const docRef = db.collection('restaurantIngredients').doc(docId);
            batch.set(docRef, ing, { merge: true });
        });

        await batch.commit();
        return { success: true, count: ingredients.length };
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
