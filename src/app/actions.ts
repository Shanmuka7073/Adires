
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue, Firestore, DocumentReference, doc, getDoc, collection, query, where, getDocs, writeBatch } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig, NluExtractedSentence, MenuItem, Menu, CachedRecipe, GetIngredientsOutput, RestaurantIngredient, EmployeeProfile, SalarySlip, Store, AttendanceRecord } from '@/lib/types';
import { headers } from 'next/headers';
import { getApp, getApps } from 'firebase-admin/app';
import * as pdfjs from 'pdfjs-dist';
import { v4 as uuidv4 } from 'uuid';
import { ai } from '@/ai/genkit';
import { GetIngredientsInputSchema, GetIngredientsOutputSchema } from '@/ai/flows/recipe-ingredients-types';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { googleAI } from '@genkit-ai/google-genai';


export async function getFirebaseConfig() {
  try {
    const adminApp = getApps()[0] || (await getAdminServices()).app;
    
    // The bucket URL is constructed from the projectId.
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
  } catch (error) {
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


/**
 * Safely fetch documents count from Firestore collections.
 */
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
        return {
            users: 0,
            stores: 0,
            deliveryPartners: 0,
            voiceCommands: 0,
        };
    }
}

/**
 * Main system status API
 */
export async function getSystemStatus() {
    try {
        const counts = await getFirestoreCounts();

        return {
            status: 'ok',
            llmStatus: 'Offline',   // Since AI functions are removed
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
            counts: {
                users: 0,
                stores: 0,
                deliveryPartners: 0,
                voiceCommands: 0,
            },
        };
    }
}

const createSlug = (text: string) => {
    if(!text) return '';
    return text
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
};

/**
 * Fetches a CSV file from a public URL and bulk-uploads products.
 * @param url The URL of the raw CSV file.
 * @returns An object indicating success, count, or an error message.
 */
export async function importProductsFromUrl(url: string): Promise<{ success: boolean; count?: number; error?: string; }> {
    if (!url) {
        return { success: false, error: 'URL cannot be empty.' };
    }

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch from URL: ${response.statusText}`);
        }
        const csvText = await response.text();
        const { db } = await getAdminServices();
        const batch = db.batch(); 
        
        const adminStoreQuery = db.collection('stores').where('name', '==', 'LocalBasket');
        const adminStoreSnap = await adminStoreQuery.get();
        if (adminStoreSnap.empty) {
            return { success: false, error: 'Master "LocalBasket" store not found. Please create it first.' };
        }
        const adminStoreId = adminStoreSnap.docs[0].id;

        const rows = csvText.split('\n').slice(1);
        let processedCount = 0;

        for (const row of rows) {
            if (!row.trim()) continue;
            
            const [name, category, description, imageUrl, weight, priceStr] = row.split(',').map(s => s.trim());
            const price = parseFloat(priceStr);
            
            if (!name || !category || !weight || isNaN(price)) {
                console.warn(`Skipping invalid row: ${row}`);
                continue;
            }

            const productNameLower = name.toLowerCase();
            const imageId = `prod-${createSlug(name)}`;
            const productRef = db.collection('stores').doc(adminStoreId).collection('products').doc();
            batch.set(productRef, {
                name,
                category,
                description: description || '',
                imageUrl: imageUrl || '',
                storeId: adminStoreId,
                imageId: imageId,
                imageHint: productNameLower,
            });

            const priceRef = db.collection('productPrices').doc(productNameLower);
            const newVariant = {
                weight,
                price,
                stock: 50,
                sku: `${createSlug(name)}-${createSlug(weight)}-${processedCount}`
            };
            batch.set(priceRef, { productName: productNameLower, variants: [newVariant] }, { merge: true });

            processedCount++;
        }

        if (processedCount > 0) {
            await batch.commit();
        }

        return { success: true, count: processedCount };

    } catch (error: any) {
        console.error('Product import from URL failed:', error);
        return { success: false, error: error.message || 'An unknown server error occurred.' };
    }
}


export async function getMealDbRecipe(dishName: string): Promise<{ ingredients?: string[]; instructions?: string; error?: string }> {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dishName)}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`TheMealDB API returned status ${response.status}`);
    }
    const data = await response.json();

    if (!data.meals || data.meals.length === 0) {
      return { error: `I couldn't find a recipe for "${dishName}" on TheMealDB.` };
    }

    const meal = data.meals[0];
    const ingredients: string[] = [];
    // TheMealDB has up to 20 ingredients and measures
    for (let i = 1; i <= 20; i++) {
      const ingredient = meal['strIngredient' + i];
      const measure = meal['strMeasure' + i];
      if (ingredient) {
        ingredients.push(`${measure} ${ingredient}`.trim());
      } else {
        break; // Stop when there are no more ingredients
      }
    }

    return {
      ingredients,
      instructions: meal.strInstructions,
    };
  } catch (error: any) {
    console.error("TheMealDB API fetch error:", error);
    return { error: error.message || `Failed to fetch recipe for "${dishName}".` };
  }
}

const getManifestPath = () => {
  // `process.cwd()` returns the root of your Next.js project
  return path.join(process.cwd(), 'public', 'manifest.json');
};

export async function getManifest() {
    try {
        const manifestPath = getManifestPath();
        const manifestFile = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(manifestFile);
    } catch (error) {
        console.error('Failed to read manifest file:', error);
        // If the file doesn't exist, return a default structure
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            return {
              name: "LocalBasket",
              short_name: "LocalBasket",
              icons: [],
            };
        }
        return null;
    }
}

export async function updateManifest(newData: { icons?: any[], screenshots?: any[], shortcuts?: any[] }): Promise<{ success: boolean; error?: string }> {
    try {
        const manifestPath = getManifestPath();
        const manifest = await getManifest();

        if (!manifest) {
            throw new Error('Could not load existing manifest file.');
        }

        // Update only the specified sections
        if (newData.icons) {
            manifest.icons = newData.icons;
        }
        if (newData.screenshots) {
            manifest.screenshots = newData.screenshots;
        }
        if (newData.shortcuts) {
            manifest.shortcuts = newData.shortcuts;
        }

        // Write the updated manifest back to the file
        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
        
        return { success: true };
    } catch (error: any) {
        console.error('Failed to update manifest file:', error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

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
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await getAdminServices();

    const recipeId = `${createSlug(item.name)}_en`;
    const recipeDoc = await db.collection('cachedRecipes').doc(recipeId).get();

    let recipeSnapshotData: any[] = [];
    if (recipeDoc.exists) {
      const recipe = recipeDoc.data() as CachedRecipe;
      recipeSnapshotData = (recipe.ingredients || []).map(ing => ({
        name: ing.name,
        qty: ing.baseQuantity,
        unit: ing.unit || '',
        cost: ing.cost || 0,
      }));
    } else {
      console.warn(`No cached recipe for "${item.name}".`);
    }

    const orderId = `${storeId}_${sessionId}`;
    const orderRef = db.collection('orders').doc(orderId);
    const menuItemId = item.id || `item-${createSlug(item.name)}`;

    const orderItem: OrderItem = {
      id: uuidv4(),
      orderId,
      productId: `${storeId}-${createSlug(item.name)}`,
      menuItemId: menuItemId,
      productName: item.name,
      variantSku: 'default',
      variantWeight: '1 pc',
      quantity,
      price: item.price,
      recipeSnapshot: recipeSnapshotData,
    };

    const doc = await orderRef.get();

    if (doc.exists) {
      // Document exists, so update it
      await orderRef.update({
        items: FieldValue.arrayUnion(orderItem),
        totalAmount: FieldValue.increment(orderItem.price * orderItem.quantity),
        updatedAt: FieldValue.serverTimestamp(),
        status: 'Pending',
      });
    } else {
      // Document does not exist, so create it
      const newOrder: Partial<Order> = {
        id: orderId,
        storeId,
        sessionId,
        tableNumber,
        userId: 'guest',
        customerName: `Table ${tableNumber || 'N/A'}`,
        deliveryAddress: 'In-store dining',
        totalAmount: orderItem.price * orderItem.quantity,
        status: 'Pending',
        orderDate: Timestamp.now(),
        items: [orderItem],
      };
      await orderRef.set(newOrder);
    }

    return { success: true };
  } catch (error: any) {
    console.error("addRestaurantOrderItem failed:", error);
    return { success: false, error: error.message || "An unknown server error occurred." };
  }
}


export async function getSiteConfig(configId: string): Promise<Partial<SiteConfig> | null> {
    const { db } = await getAdminServices();
    try {
        const docRef = db.collection('siteConfig').doc(configId);
        const docSnap = await docRef.get();
        if (docSnap.exists()) {
            return docSnap.data() as SiteConfig;
        }
        return null;
    } catch (error) {
        console.error("Failed to get site config:", error);
        return null;
    }
}


export async function updateSiteConfig(configId: string, data: Partial<SiteConfig>): Promise<{ success: boolean; error?: string }> {
    const { db } = await getAdminServices();
    try {
        const docRef = db.collection('siteConfig').doc(configId);
        await docRef.set(data, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error("Failed to update site config:", error);
        return { success: false, error: error.message };
    }
}

// Helper to convert units to a base unit (grams or ml)
const convertToBaseUnit = (quantity: number, unit: string) => {
    const u = unit?.toLowerCase() || '';
    if (u === 'kg' || u === 'l' || u === 'litre') return quantity * 1000;
    if (u === 'g' || u === 'gm' || u === 'ml') return quantity;
    // For 'pcs' or other units, we treat them as a base unit of 1 for aggregation
    return quantity;
};

// Helper to format the final aggregated quantity
const formatAggregatedQuantity = (quantity: number, unit: string) => {
    if ((unit === 'g' || unit === 'gm') && quantity >= 1000) {
        return { quantity: quantity / 1000, unit: 'kg' };
    }
    if (unit === 'ml' && quantity >= 1000) {
        return { quantity: quantity / 1000, unit: 'l' };
    }
    return { quantity, unit };
};


export async function getStoreSalesReport({
  storeId,
  period,
}: {
  storeId: string;
  period: 'daily' | 'weekly' | 'monthly';
}) {
  const { db } = await getAdminServices();

  if (!storeId) {
    return { success: false, error: 'Store ID is required' };
  }

  const getStartDate = (period: 'daily' | 'weekly' | 'monthly') => {
    const now = new Date();
    if (period === 'daily') return new Date(now.setHours(0, 0, 0, 0));
    if (period === 'weekly') return new Date(now.setDate(now.getDate() - 7));
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };
  const startDate = getStartDate(period);
  
  const ordersQuery = db
    .collection('orders')
    .where('storeId', '==', storeId)
    .where('status', 'in', ['Completed', 'Billed'])
    .where('orderDate', '>=', Timestamp.fromDate(startDate));

  const ordersSnapshot = await ordersQuery.get();
  const validOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

  if (validOrders.length === 0) {
    return {
      success: true,
      report: { totalSales: 0, totalOrders: 0, totalItems: 0, topProducts: [], ingredientUsage: [], ingredientCost: 0, costDrivers: [], optimizationHint: null, salesByTable: [] },
    };
  }

  let totalSales = 0;
  const productMap = new Map<string, number>();
  const ingredientMap = new Map<string, { quantity: number; unit: string; cost: number }>();
  const salesByTableMap = new Map<string, { totalSales: number; orderCount: number, totalCost: number }>();

  for (const order of validOrders) {
    totalSales += order.totalAmount;
    let orderCost = 0;
    
    for (const item of order.items || []) {
      const key = item.productName.toLowerCase().trim();
      productMap.set(key, (productMap.get(key) || 0) + item.quantity);

      for (const ing of item.recipeSnapshot || []) {
         if (!ing.name || typeof ing.qty !== 'number' || !ing.unit) continue;

        const consumed = convertToBaseUnit(ing.qty, ing.unit) * item.quantity;
        const itemIngredientCost = (ing.cost || 0) * item.quantity;
        orderCost += itemIngredientCost;

        const prev = ingredientMap.get(ing.name) || {
          quantity: 0,
          cost: 0,
          unit: ['g', 'gm', 'kg'].includes(ing.unit.toLowerCase()) ? 'g' : ['ml', 'l', 'litre'].includes(ing.unit.toLowerCase()) ? 'ml' : 'pcs',
        };

        ingredientMap.set(ing.name, {
          quantity: prev.quantity + consumed,
          cost: prev.cost + itemIngredientCost,
          unit: prev.unit,
        });
      }
    }

    if (order.tableNumber) {
        const currentTableData = salesByTableMap.get(order.tableNumber) || { totalSales: 0, orderCount: 0, totalCost: 0 };
        salesByTableMap.set(order.tableNumber, {
            totalSales: currentTableData.totalSales + order.totalAmount,
            orderCount: currentTableData.orderCount + 1,
            totalCost: currentTableData.totalCost + orderCost,
        });
    }
  }

  const totalIngredientCost = Array.from(ingredientMap.values()).reduce((acc, curr) => acc + curr.cost, 0);

  const sortedIngredients = [...ingredientMap.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const costDrivers = sortedIngredients.slice(0, 5).map(([name, data]) => ({
      name,
      cost: data.cost,
      percentage: totalIngredientCost > 0 ? (data.cost / totalIngredientCost) * 100 : 0,
  }));
  
  let optimizationHint = null;
  const oilAndGheeCost = sortedIngredients
      .filter(([name]) => name.toLowerCase().includes('oil') || name.toLowerCase().includes('ghee'))
      .reduce((acc, [, data]) => acc + data.cost, 0);
  
  if (totalIngredientCost > 0) {
    const oilGheePercentage = (oilAndGheeCost / totalIngredientCost) * 100;
    if (oilGheePercentage > 15) { // If oils are more than 15% of total cost
        optimizationHint = `Oils & Ghee make up ${oilGheePercentage.toFixed(0)}% of your costs. A 5-10% reduction in usage here could significantly boost profits.`;
    } else if (costDrivers.length > 0 && costDrivers[0].percentage > 30) {
        optimizationHint = `${costDrivers[0].name} is your biggest cost driver at ${costDrivers[0].percentage.toFixed(0)}%. Look for bulk purchase options or alternative suppliers to reduce its cost.`;
    }
  }


  return {
    success: true,
    report: {
      totalSales,
      totalOrders: validOrders.length,
      totalItems: Array.from(productMap.values()).reduce((a, b) => a + b, 0),
      topProducts: [...productMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([name, count]) => ({ name, count })),
      ingredientUsage: [...ingredientMap.entries()].map(([name, data]) => {
          const formatted = formatAggregatedQuantity(data.quantity, data.unit);
          return { name, quantity: formatted.quantity, unit: formatted.unit, cost: data.cost };
      }),
      ingredientCost: totalIngredientCost,
      costDrivers,
      optimizationHint,
      salesByTable: Array.from(salesByTableMap.entries()).map(([tableNumber, data]) => {
          const grossProfit = data.totalSales - data.totalCost;
          return {
              tableNumber,
              totalSales: data.totalSales,
              orderCount: data.orderCount,
              totalCost: data.totalCost,
              profitPerOrder: data.orderCount > 0 ? grossProfit / data.orderCount : 0,
              grossProfit: grossProfit,
              profitPercentage: data.totalSales > 0 ? (grossProfit / data.totalSales) * 100 : 0,
          };
      }),
    },
    error: null,
  };
}


export async function markSessionAsPaid(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await getAdminServices();

    const snapshot = await db
      .collection('orders')
      .where('sessionId', '==', sessionId)
      .get();

    if (snapshot.empty) {
      return { success: false, error: 'No orders found for this session' };
    }

    const batch = db.batch();

    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, {
        status: 'Completed',
        paidAt: Timestamp.now(),
        paymentMode: 'UPI',
      });
    });

    await batch.commit();

    return { success: true };
  } catch (error: any) {
    console.error('Session payment failed:', error);
    return { success: false, error: error.message };
  }
}


export async function generateDailyWhatsappMessage(storeId:string) {
  const reportData = await getStoreSalesReport({ storeId, period:'daily' });

  if (!reportData.success || !reportData.report) return null;
  const { report } = reportData;

  return `
📊 *Daily Sales Report*
Sales: ₹${report.totalSales.toFixed(0)}
Orders: ${report.totalOrders}

Top Item: ${report.topProducts[0]?.name || 'N/A'}
`;
}


export async function getIngredientsForDish(input: { dishName: string; language: 'en' | 'te', existingRecipe?: GetIngredientsOutput }): Promise<GetIngredientsOutput> {
  const { db } = await getAdminServices();
  
  const cachedData = await getCachedRecipe(db, input.dishName, input.language);
  if (cachedData) {
    return cachedData;
  }
  
  const prompt = ai.definePrompt(
    {
      name: 'recipeIngredientsPrompt',
      input: { schema: GetIngredientsInputSchema },
      output: { schema: GetIngredientsOutputSchema },
      model: googleAI.model('gemini-2.5-flash'),
      prompt: `
          You are an expert Indian chef creating a recipe for a single restaurant-style serving.
          Your primary task is to generate a list of ingredients with REALISTIC quantities and estimated COST in Indian Rupees (₹) for ONE serving. For example, a single biryani serving uses around 150-200g of chicken, not 750g.

          **Dish Name**: {{{dishName}}}
          **Desired Language**: {{{language}}}

          {{#if existingRecipe}}
          **Translate This Recipe**:
          You have been provided with an existing recipe for a single serving. Your main goal is to accurately translate its ingredients and instructions into the desired language ({{{language}}}). Do not change the quantities. You do not need to re-estimate the cost.
          {{else}}
          **Generate New Recipe (Single Serving)**:
          1.  **Analyze the Dish**: Identify the core components of "{{{dishName}}}". If the name is generic like "Juice" or "Salad", create a recipe for a common, popular version (e.g., "Fresh Orange Juice", "Garden Salad").
          2.  **Generate Ingredients**: Create a list of ingredients for a SINGLE serving. For each, provide:
              *   \`name\`: Common name of the ingredient.
              *   \`quantity\`: User-friendly quantity (e.g., "150g", "1/2 cup").
              *   \`baseQuantity\`: Numeric quantity in a base unit (e.g., for "150g", this is 150).
              *   \`unit\`: The base unit ('g', 'ml', 'pcs').
              *   \`cost\`: Estimated cost in Indian Rupees (₹) for the given single-serving quantity.
          3.  **Generate Instructions**: Provide clear, step-by-step cooking instructions.
          4.  **Estimate Nutrition**: Provide estimated calories and protein per serving.
          5.  **Success Flag**: Set 'isSuccess' to true.
          6.  **Language**: All output must be in the desired language: {{{language}}}.
          {{/if}}

          If the dish name is not valid, set 'isSuccess' to false and return empty arrays.
          `,
    }
  );

  const { output } = await prompt(input);
  
  if (output && output.isSuccess) {
    await cacheRecipe(db, input.dishName, input.language, output);
  } else if (!output) {
      return {
          isSuccess: false,
          title: input.dishName,
          ingredients: [],
          instructions: [],
          nutrition: { calories: 0, protein: 0 },
      };
  }
  
  return output;
}

export async function addIngredientsToCatalog(ingredients: Omit<RestaurantIngredient, 'id'>[]): Promise<{ success: boolean, count: number, error?: string }> {
  try {
    const { db } = await getAdminServices();
    const batch = db.batch();
    let count = 0;

    for (const ingredient of ingredients) {
      if (ingredient.name && ingredient.unit && ingredient.cost > 0) {
        const docId = createSlug(ingredient.name);
        const docRef = db.collection('restaurantIngredients').doc(docId);
        batch.set(docRef, { ...ingredient, id: docId }, { merge: true });
        count++;
      }
    }

    if (count > 0) {
      await batch.commit();
    }
    
    return { success: true, count };
  } catch (error: any) {
    console.error("Failed to add ingredients to catalog:", error);
    return { success: false, count: 0, error: error.message };
  }
}

async function getFullSlipDetails(slipData: SalarySlip, db: Firestore) {
    const [employeeSnap, attendanceSnap, storeSnap, userSnap] = await Promise.all([
        db.collection('employeeProfiles').doc(slipData.employeeId).get(),
        db.collectionGroup('attendance')
          .where('employeeId', '==', slipData.employeeId)
          .where('workDate', '>=', slipData.periodStart)
          .where('workDate', '<=', slipData.periodEnd)
          .get(),
        db.collection('stores').doc(slipData.storeId).get(),
        db.collection('users').doc(slipData.employeeId).get(),
    ]);

    if (!employeeSnap.exists() || !storeSnap.exists() || !userSnap.exists()) {
        throw new Error('Employee profile, user data, or store not found for this slip.');
    }
    const employeeData = employeeSnap.data() as EmployeeProfile;
    // Combine base user data with employee-specific data
    const fullEmployeeProfile = { ...userSnap.data(), ...employeeData } as EmployeeProfile;
    const storeData = storeSnap.data() as Store;

    const attendanceRecords = attendanceSnap.docs.map(d => d.data() as AttendanceRecord);
    const totalDaysInPeriod = Math.round((new Date(slipData.periodEnd).getTime() - new Date(slipData.periodStart).getTime()) / (1000 * 3600 * 24)) + 1;
    const presentDays = new Set(attendanceRecords.filter(r => r.status === 'present' || r.status === 'approved' || r.status === 'partially_present').map(r => r.workDate)).size;

    const attendanceSummary = {
        totalDays: totalDaysInPeriod,
        presentDays: presentDays,
        partialDays: attendanceRecords.filter(r => r.status === 'partially_present').length,
        absentDays: totalDaysInPeriod - presentDays,
    };

    const serializableSlip = {
        ...slipData,
        generatedAt: (slipData.generatedAt as Timestamp).toDate().toISOString(),
        periodStart: new Date(slipData.periodStart).toISOString(),
        periodEnd: new Date(slipData.periodEnd).toISOString(),
    };

    return {
        slip: serializableSlip as unknown as SalarySlip,
        employee: fullEmployeeProfile,
        store: storeData,
        attendance: attendanceSummary,
    };
}


export async function getSalarySlipData(slipId: string, userId: string): Promise<{ slip: SalarySlip; employee: EmployeeProfile; store: Store; attendance: any } | null> {
    const { db } = await getAdminServices();

    try {
        const slipQuery = db.collectionGroup('salarySlips').where('id', '==', slipId).limit(1);
        const slipSnapshot = await slipQuery.get();

        if (slipSnapshot.empty) {
            throw new Error("Salary slip not found.");
        }
        
        const slipDocFromQuery = slipSnapshot.docs[0];
        const slipData = slipDocFromQuery.data() as SalarySlip;

        const storeDoc = await db.collection('stores').doc(slipData.storeId).get();
        if (!storeDoc.exists()) {
            throw new Error("Store not found for this salary slip.");
        }

        if (userId !== slipData.employeeId && userId !== (storeDoc.data() as Store).ownerId) {
            throw new Error("You do not have permission to view this salary slip.");
        }

        return await getFullSlipDetails(slipData, db);

    } catch (error: any) {
        console.error("Error in getSalarySlipData:", error);
        return null;
    }
}

    