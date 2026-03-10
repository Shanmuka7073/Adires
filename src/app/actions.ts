
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue, Firestore, DocumentReference } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig, NluExtractedSentence, MenuItem, Menu, CachedRecipe, GetIngredientsOutput, RestaurantIngredient, EmployeeProfile, SalarySlip, Store, AttendanceRecord, ReasonEntry, User, CartItem, ReportData } from '@/lib/types';
import { headers } from 'next/headers';
import { getApp, getApps } from 'firebase-admin/app';
import * as pdfjs from 'pdfjs-dist';
import { v4 as uuidv4 } from 'uuid';
import { ai } from '@/ai/genkit';
import { GetIngredientsInputSchema, GetIngredientsOutputSchema } from '@/ai/flows/recipe-ingredients-types';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { getAuth } from 'firebase-admin/auth';
import { generateSalarySlipDoc } from '@/lib/generateSalarySlipDoc';


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
 TableNumber,
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
      report: { totalSales: 0, totalOrders: 0, totalItems: 0, topProducts: [], topProfitableProducts: [], ingredientUsage: [], ingredientCost: 0, costDrivers: [], optimizationHint: null, salesByTable: [] },
    };
  }

  let totalSales = 0;
  const productMap = new Map<string, number>();
  const productProfitMap = new Map<string, { totalProfit: number, count: number }>();
  const ingredientMap = new Map<string, { quantity: number; unit: string; cost: number }>();
  const salesByTableMap = new Map<string, { totalSales: number; orderCount: number, totalCost: number }>();

  for (const order of validOrders) {
    totalSales += order.totalAmount;
    let orderCost = 0;
    
    for (const item of order.items || []) {
      const key = item.productName.toLowerCase().trim();
      productMap.set(key, (productMap.get(key) || 0) + item.quantity);

      let itemTotalCost = 0;
      for (const ing of item.recipeSnapshot || []) {
         if (!ing.name || typeof ing.qty !== 'number' || !ing.unit) continue;

        const consumed = convertToBaseUnit(ing.qty, ing.unit) * item.quantity;
        const itemIngredientCost = (ing.cost || 0) * item.quantity;
        itemTotalCost += itemIngredientCost;
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

      // Profit calculation for the specific dish
      const itemProfit = (item.price * item.quantity) - itemTotalCost;
      const profitEntry = productProfitMap.get(item.productName) || { totalProfit: 0, count: 0 };
      productProfitMap.set(item.productName, {
          totalProfit: profitEntry.totalProfit + itemProfit,
          count: profitEntry.count + item.quantity
      });
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
  
  const topProfitableProducts = [...productProfitMap.entries()]
    .map(([name, data]) => ({
        name,
        totalProfit: data.totalProfit,
        profitPerUnit: data.totalProfit / data.count,
        count: data.count
    }))
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 5);

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
      topProfitableProducts,
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
    } as ReportData,
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
      model: 'googleai/gemini-2.5-flash',
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

async function getFullSlipDetails(slipData: SalarySlip, db: Firestore): Promise<{ slip: SalarySlip; employee: EmployeeProfile & User; store: Store; attendance: any } | null> {
    const [employeeSnap, userSnap, storeSnap] = await Promise.all([
        db.collection('employeeProfiles').doc(slipData.employeeId).get(),
        db.collection('users').doc(slipData.employeeId).get(),
        db.collection('stores').doc(slipData.storeId).get(),
    ]);

    if (!employeeSnap.exists() || !userSnap.exists() || !storeSnap.exists()) {
        console.error(`Data missing for slip ${slipData.id}. Employee: ${employeeSnap.exists()}, User: ${userSnap.exists()}, Store: ${storeSnap.exists()}`);
        return null;
    }
    
    // FETCH ATTENDANCE WITH ROBUST ERROR HANDLING
    let attendanceSummary = {
        totalDays: 30, // Fallback
        presentDays: 0,
        partialDays: 0,
        absentDays: 0,
    };

    try {
        const attendanceSnap = await db
            .collection('stores')
            .doc(slipData.storeId)
            .collection('attendance')
            .where('employeeId', '==', slipData.employeeId)
            .where('workDate', '>=', Timestamp.fromDate(new Date(slipData.periodStart)))
            .where('workDate', '<=', Timestamp.fromDate(new Date(slipData.periodEnd)))
            .get();

        const attendanceRecords = attendanceSnap.docs.map(d => d.data() as AttendanceRecord);
        const totalDaysInPeriod = Math.round((new Date(slipData.periodEnd).getTime() - new Date(slipData.periodStart).getTime()) / (1000 * 3600 * 24)) + 1;
        const presentDays = new Set(attendanceRecords.filter(r => ['present', 'approved', 'partially_present'].includes(r.status)).map(r => (r.workDate as Timestamp).toDate().toISOString().split('T')[0])).size;

        attendanceSummary = {
            totalDays: totalDaysInPeriod,
            presentDays: presentDays,
            partialDays: attendanceRecords.filter(r => r.status === 'partially_present').length,
            absentDays: totalDaysInPeriod - presentDays,
        };
    } catch (e) {
        console.warn("Attendance summary fetch failed (likely missing index). Using simplified summary.");
    }

    const employeeData = employeeSnap.data() as EmployeeProfile;
    const userData = userSnap.data() as User;
    const fullEmployeeProfile = { ...userData, ...employeeData };
    const storeData = storeSnap.data() as Store;

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


export async function getSalarySlipData(slipId: string, userId: string, storeId?: string): Promise<{ slip: SalarySlip; employee: EmployeeProfile & User; store: Store; attendance: any } | null> {
    const { db } = await getAdminServices();

    try {
        let slipData: SalarySlip | null = null;

        if (storeId) {
            // Direct fetch is preferred and faster
            const docSnap = await db.collection('stores').doc(storeId).collection('salarySlips').doc(slipId).get();
            if (docSnap.exists) {
                slipData = docSnap.data() as SalarySlip;
            }
        }

        if (!slipData) {
            // Fallback to collection group if storeId is missing
            const slipQuery = db.collectionGroup('salarySlips').where('id', '==', slipId).limit(1);
            const slipSnapshot = await slipQuery.get();
            if (!slipSnapshot.empty) {
                slipData = slipSnapshot.docs[0].data() as SalarySlip;
            }
        }

        if (!slipData) {
            throw new Error("Salary slip not found.");
        }

        const storeDoc = await db.collection('stores').doc(slipData.storeId).get();
        if (!storeDoc.exists()) {
            throw new Error("Store not found for this salary slip.");
        }
        
        const storeOwnerId = (storeDoc.data() as Store).ownerId;
        const employeeId = slipData.employeeId;

        // Security check: ensure the requester is either the employee or the store owner.
        if (userId !== employeeId && userId !== storeOwnerId) {
            throw new Error("You do not have permission to view this salary slip.");
        }

        return await getFullSlipDetails(slipData, db);

    } catch (error: any) {
        console.error("Error in getSalarySlipData:", error);
        return null;
    }
}
    
export async function createRestaurantUserAndStore(email: string, password: string, restaurantName: string): Promise<{ success: boolean, userId?: string, storeId?: string, error?: string }> {
    const { auth, db } = await getAdminServices();
    
    try {
        // 1. Create the user
        const userRecord = await auth.createUser({
            email: email,
            password: password,
            displayName: restaurantName,
        });
        const userId = userRecord.uid;

        // 2. Create the user profile document
        const userProfile: Partial<User> = {
            id: userId,
            email: email,
            firstName: restaurantName,
            lastName: 'Owner',
            accountType: 'restaurant',
            address: '',
            phoneNumber: '',
        };
        await db.collection('users').doc(userId).set(userProfile);
        
        // 3. Create the store document
        const storeRef = db.collection('stores').doc(); // Auto-generate ID
        const storeData: Omit<Store, 'id'> = {
            name: restaurantName,
            ownerId: userId,
            description: `Welcome to ${restaurantName}`,
            address: 'To be updated',
            latitude: 0,
            longitude: 0,
            imageId: 'store-1', // Default image
            isClosed: false,
        };
        await storeRef.set(storeData);

        return { success: true, userId: userId, storeId: storeRef.id };

    } catch (error: any) {
        console.error("Failed to create restaurant user and store:", error);
        return { success: false, error: error.message };
    }
}

export async function approveRule(sentenceId: string, rawText: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        const sentenceRef = db.collection('nlu_extracted_sentences').doc(sentenceId);
        
        // In a real app, you would generate a proper grammar rule here.
        // For this demo, we'll just mark it as approved and log it.
        const learnedRule = `LEARNED: "${rawText}"`;
        console.log("Adding new learned rule:", learnedRule);
        
        // Here you would append to a "learned-rules.json" file or similar.
        // For simplicity, we just update the status in Firestore.
        
        await sentenceRef.update({ status: 'approved' });

        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function rejectRule(sentenceId: string): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        const sentenceRef = db.collection('nlu_extracted_sentences').doc(sentenceId);
        await sentenceRef.update({ status: 'rejected' });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function processPdfAndExtractRules(formData: FormData): Promise<{ success: boolean; sentenceCount?: number; error?: string }> {
    try {
        const pdfFile = formData.get('pdf') as File;
        if (!pdfFile) {
            return { success: false, error: 'No PDF file found in form data.' };
        }
        
        const fileBuffer = Buffer.from(await pdfFile.arrayBuffer());
        const data = await pdfjs.getDocument({ data: fileBuffer }).promise;
        const numPages = data.numPages;
        let fullText = '';

        for (let i = 1; i <= numPages; i++) {
            const page = await data.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
            fullText += pageText + ' ';
        }

        const sentences = fullText.match(/[^.!?]+[.!?]+/g) || [];
        const { db } = await getAdminServices();
        const batch = db.batch();
        let sentenceCount = 0;

        for (const sentence of sentences) {
            const trimmed = sentence.trim();
            if (trimmed.length > 10) { // Basic filter for meaningful sentences
                // In a real app, run NLU here to get extractedNumbers and confidence
                const docRef = db.collection('nlu_extracted_sentences').doc();
                batch.set(docRef, {
                    id: docRef.id,
                    rawText: trimmed,
                    extractedNumbers: [], // Placeholder
                    confidence: Math.random(), // Placeholder
                    status: 'pending',
                    createdAt: FieldValue.serverTimestamp(),
                });
                sentenceCount++;
            }
        }
        
        if (sentenceCount > 0) {
            await batch.commit();
        }

        return { success: true, sentenceCount };

    } catch (e: any) {
        console.error("PDF Processing Error:", e);
        return { success: false, error: e.message };
    }
}

export async function approveRegularization(recordId: string, storeId: string, isApproved: boolean, rejectionReason?: string) {
    const { db } = await getAdminServices();
    const recordRef = db.doc(`stores/${storeId}/attendance/${recordId}`);

    const recordSnap = await recordRef.get();
    if (!recordSnap.exists) {
        throw new Error("Attendance record not found.");
    }
    const record = recordSnap.data() as AttendanceRecord;
    
    const newStatus = isApproved ? 'approved' : 'rejected';
    const lastReasonIndex = (record.reasonHistory?.length || 0) - 1;
    const updatedReasonHistory = record.reasonHistory ? [...record.reasonHistory] : [];
    if (lastReasonIndex >= 0) {
        updatedReasonHistory[lastReasonIndex].status = newStatus;
        if (!isApproved) {
            updatedReasonHistory[lastReasonIndex].rejectionReason = rejectionReason;
        }
    }

    const updateData: Partial<AttendanceRecord> = {
        status: newStatus,
        reasonHistory: updatedReasonHistory,
    };
    
    if (isApproved && record.workHours === 0) {
        updateData.workHours = 8;
    }

    await recordRef.update(updateData);
}

export async function rejectRegularization(recordId: string, storeId: string, reason: string) {
    return await approveRegularization(recordId, storeId, false, reason);
}
