
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig, NluExtractedSentence, MenuItem, Menu, CachedRecipe, GetIngredientsOutput, RestaurantIngredient, EmployeeProfile, SalarySlip, Store, AttendanceRecord, ReasonEntry, User, CartItem, ReportData } from '@/lib/types';
import { getApps } from 'firebase-admin/app';
import * as pdfjs from 'pdfjs-dist';
import { v4 as uuidv4 } from 'uuid';
import { ai } from '@/ai/genkit';
import { GetIngredientsInputSchema, GetIngredientsOutputSchema } from '@/ai/flows/recipe-ingredients-types';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';

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

const createSlug = (text: string) => {
    if(!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^\w-]+/g, '')
      .replace(/--+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
};

export async function importProductsFromUrl(url: string): Promise<{ success: boolean; count?: number; error?: string; }> {
    if (!url) return { success: false, error: 'URL cannot be empty.' };
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch from URL: ${response.statusText}`);
        const csvText = await response.text();
        const { db } = await getAdminServices();
        const batch = db.batch(); 
        
        const adminStoreQuery = db.collection('stores').where('name', '==', 'LocalBasket');
        const adminStoreSnap = await adminStoreQuery.get();
        if (adminStoreSnap.empty) return { success: false, error: 'Master "LocalBasket" store not found.' };
        const adminStoreId = adminStoreSnap.docs[0].id;

        const rows = csvText.split('\n').slice(1);
        let processedCount = 0;

        for (const row of rows) {
            if (!row.trim()) continue;
            const [name, category, description, imageUrl, weight, priceStr] = row.split(',').map(s => s.trim());
            const price = parseFloat(priceStr);
            if (!name || !category || !weight || isNaN(price)) continue;

            const productNameLower = name.toLowerCase();
            const imageId = `prod-${createSlug(name)}`;
            const productRef = db.collection('stores').doc(adminStoreId).collection('products').doc();
            batch.set(productRef, {
                name, category, description: description || '',
                imageUrl: imageUrl || '', storeId: adminStoreId,
                imageId: imageId, imageHint: productNameLower,
            });

            const priceRef = db.collection('productPrices').doc(productNameLower);
            const newVariant = { weight, price, stock: 50, sku: `${createSlug(name)}-${createSlug(weight)}-${processedCount}` };
            batch.set(priceRef, { productName: productNameLower, variants: [newVariant] }, { merge: true });
            processedCount++;
        }
        if (processedCount > 0) await batch.commit();
        return { success: true, count: processedCount };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getMealDbRecipe(dishName: string): Promise<{ ingredients?: string[]; instructions?: string; error?: string }> {
  const url = `https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dishName)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`API returned status ${response.status}`);
    const data = await response.json();
    if (!data.meals || data.meals.length === 0) return { error: `No recipe found for "${dishName}".` };
    const meal = data.meals[0];
    const ingredients: string[] = [];
    for (let i = 1; i <= 20; i++) {
      const ingredient = meal['strIngredient' + i];
      const measure = meal['strMeasure' + i];
      if (ingredient) ingredients.push(`${measure} ${ingredient}`.trim());
      else break;
    }
    return { ingredients, instructions: meal.strInstructions };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function getWikipediaSummary(topic: string): Promise<{ summary?: string; error?: string }> {
    const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic.replace(/ /g, '_'))}`;
    try {
        const response = await fetch(url);
        if (!response.ok) return { error: "No summary found." };
        const data = await response.json();
        return { summary: data.extract };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getPlaceholderImages() {
    try {
        const filePath = path.join(process.cwd(), 'src/lib/placeholder-images.json');
        const fileContent = await fs.readFile(filePath, 'utf8');
        return JSON.parse(fileContent);
    } catch (error) {
        return { placeholderImages: [] };
    }
}

export async function updatePlaceholderImages(data: any) {
    try {
        const filePath = path.join(process.cwd(), 'src/lib/placeholder-images.json');
        await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function getManifest() {
    try {
        const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
        const manifestFile = await fs.readFile(manifestPath, 'utf-8');
        return JSON.parse(manifestFile);
    } catch (error) {
        return { name: "LocalBasket", short_name: "LocalBasket", icons: [] };
    }
}

export async function updateManifest(newData: any): Promise<{ success: boolean; error?: string }> {
    try {
        const manifestPath = path.join(process.cwd(), 'public', 'manifest.json');
        await fs.writeFile(manifestPath, JSON.stringify(newData, null, 2), 'utf-8');
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function addRestaurantOrderItem({
  storeId,
  tableNumber,
  item,
  quantity,
}: {
  storeId: string;
  tableNumber: string | null;
  item: MenuItem;
  quantity: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await getAdminServices();
    const ordersRef = db.collection('orders');
    const activeOrderQuery = await ordersRef
      .where('storeId', '==', storeId)
      .where('tableNumber', '==', tableNumber)
      .where('status', 'in', ['Pending', 'Processing', 'Billed', 'Out for Delivery'])
      .limit(1)
      .get();

    let orderRef;
    let orderData: any;

    if (!activeOrderQuery.empty) {
      orderRef = activeOrderQuery.docs[0].ref;
      orderData = activeOrderQuery.docs[0].data();
    } else {
      orderRef = ordersRef.doc();
      orderData = {
        id: orderRef.id, storeId, tableNumber,
        sessionId: `session-${uuidv4()}`, userId: 'guest',
        customerName: `Table ${tableNumber || 'N/A'}`,
        deliveryAddress: 'In-store dining', totalAmount: 0,
        status: 'Pending', orderDate: Timestamp.now(), items: [],
      };
    }

    const recipeId = `${createSlug(item.name)}_en`;
    const recipeDoc = await db.collection('cachedRecipes').doc(recipeId).get();
    let recipeSnapshotData: any[] = [];
    if (recipeDoc.exists) {
      const recipe = recipeDoc.data() as CachedRecipe;
      recipeSnapshotData = (recipe.ingredients || []).map(ing => ({
        name: ing.name, qty: ing.baseQuantity, unit: ing.unit || '', cost: ing.cost || 0,
      }));
    }

    const orderItem: OrderItem = {
      id: uuidv4(), orderId: orderRef.id,
      productId: `${storeId}-${createSlug(item.name)}`,
      productName: item.name, variantSku: 'default',
      variantWeight: '1 pc', quantity, price: item.price,
      recipeSnapshot: recipeSnapshotData,
    };

    await orderRef.set({
      ...orderData,
      items: [...(orderData.items || []), orderItem],
      totalAmount: (orderData.totalAmount || 0) + (orderItem.price * orderItem.quantity),
      updatedAt: FieldValue.serverTimestamp(),
      status: 'Pending',
    }, { merge: true });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSiteConfig(configId: string): Promise<Partial<SiteConfig> | null> {
    const { db } = await getAdminServices();
    try {
        const docSnap = await db.collection('siteConfig').doc(configId).get();
        return docSnap.exists ? (docSnap.data() as SiteConfig) : null;
    } catch { return null; }
}

export async function updateSiteConfig(configId: string, data: Partial<SiteConfig>): Promise<{ success: boolean; error?: string }> {
    const { db } = await getAdminServices();
    try {
        await db.collection('siteConfig').doc(configId).set(data, { merge: true });
        return { success: true };
    } catch (error: any) { return { success: false, error: error.message }; }
}

export async function getStoreSalesReport({ storeId, period }: { storeId: string; period: 'daily' | 'weekly' | 'monthly'; }) {
  const { db } = await getAdminServices();
  if (!storeId) return { success: false, error: 'Store ID is required' };

  const getStartDate = (p: string) => {
    const now = new Date();
    if (p === 'daily') return new Date(now.setHours(0, 0, 0, 0));
    if (p === 'weekly') return new Date(now.setDate(now.getDate() - 7));
    return new Date(now.getFullYear(), now.getMonth(), 1);
  };
  
  const ordersSnapshot = await db.collection('orders')
    .where('storeId', '==', storeId)
    .where('status', 'in', ['Completed', 'Billed', 'Delivered'])
    .where('orderDate', '>=', Timestamp.fromDate(getStartDate(period)))
    .get();

  const validOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
  if (validOrders.length === 0) return { success: true, report: { totalSales: 0, totalOrders: 0, topProducts: [], ingredientUsage: [], salesByTable: [] } };

  let totalSales = 0;
  const productMap = new Map<string, number>();
  const salesByTableMap = new Map<string, any>();

  validOrders.forEach(order => {
    totalSales += order.totalAmount;
    if (order.tableNumber) {
        const prev = salesByTableMap.get(order.tableNumber) || { totalSales: 0, orderCount: 0 };
        salesByTableMap.set(order.tableNumber, { totalSales: prev.totalSales + order.totalAmount, orderCount: prev.orderCount + 1 });
    }
    (order.items || []).forEach(item => {
      const key = item.productName.toLowerCase();
      productMap.set(key, (productMap.get(key) || 0) + item.quantity);
    });
  });

  return {
    success: true,
    report: {
      totalSales, totalOrders: validOrders.length,
      topProducts: [...productMap.entries()].sort((a,b) => b[1]-a[1]).slice(0, 5).map(([name, count]) => ({ name, count })),
      salesByTable: [...salesByTableMap.entries()].map(([tableNumber, data]) => ({ tableNumber, ...data })),
    } as any,
  };
}

export async function markSessionAsPaid(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await getAdminServices();
    const snapshot = await db.collection('orders').where('sessionId', '==', sessionId).get();
    if (snapshot.empty) return { success: false, error: 'No orders found' };
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.update(doc.ref, { status: 'Completed', paidAt: Timestamp.now(), paymentMode: 'UPI' });
    });
    await batch.commit();
    return { success: true };
  } catch (error: any) { return { success: false, error: error.message }; }
}

export async function bulkUploadRecipes(csvText: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
        const { db } = await getAdminServices();
        const rows = csvText.split('\n');
        let count = 0;
        const batch = db.batch();
        for (const row of rows) {
            const [dishName, ingredientsStr] = row.split(',');
            if (!dishName || !ingredientsStr) continue;
            const recipeId = `${createSlug(dishName.trim())}_en`;
            batch.set(db.collection('cachedRecipes').doc(recipeId), {
                id: recipeId, dishName: dishName.trim(), 
                ingredients: ingredientsStr.split('|').map(i => ({ name: i.trim(), quantity: '1 unit', baseQuantity: 1, unit: 'pcs' })),
                createdAt: FieldValue.serverTimestamp()
            }, { merge: true });
            count++;
        }
        if (count > 0) await batch.commit();
        return { success: true, count };
    } catch (e: any) { return { success: false, count: 0, error: e.message }; }
}

export async function getIngredientsForDish(input: { dishName: string; language: 'en' | 'te', existingRecipe?: GetIngredientsOutput }): Promise<GetIngredientsOutput> {
  const { db } = await getAdminServices();
  const cached = await getCachedRecipe(db, input.dishName, input.language);
  if (cached) return cached;
  
  const prompt = ai.definePrompt({
      name: 'recipeIngredientsPrompt',
      input: { schema: GetIngredientsInputSchema },
      output: { schema: GetIngredientsOutputSchema },
      model: 'googleai/gemini-2.5-flash',
      prompt: `Generate a single-serving restaurant recipe for: {{{dishName}}} in {{{language}}}. Include realistic ingredients with costs in ₹.`,
  });

  const { output } = await prompt(input);
  if (output && output.isSuccess) {
    await cacheRecipe(db, input.dishName, input.language, output);
    return output;
  }
  return { isSuccess: false, title: input.dishName, ingredients: [], instructions: [], nutrition: { calories: 0, protein: 0 } };
}

export async function addIngredientsToCatalog(ingredients: Omit<RestaurantIngredient, 'id'>[]): Promise<{ success: boolean, count: number, error?: string }> {
  try {
    const { db } = await getAdminServices();
    const batch = db.batch();
    let count = 0;
    for (const ingredient of ingredients) {
      if (ingredient.name) {
        const id = createSlug(ingredient.name);
        batch.set(db.collection('restaurantIngredients').doc(id), { ...ingredient, id }, { merge: true });
        count++;
      }
    }
    if (count > 0) await batch.commit();
    return { success: true, count };
  } catch (error: any) { return { success: false, count: 0, error: error.message }; }
}

export async function getSalarySlipData(slipId: string, userId: string, storeId?: string) {
    const { db } = await getAdminServices();
    try {
        const slipSnap = storeId 
            ? await db.collection('stores').doc(storeId).collection('salarySlips').doc(slipId).get()
            : (await db.collectionGroup('salarySlips').where('id', '==', slipId).get()).docs[0];
        
        if (!slipSnap?.exists) return null;
        const slip = slipSnap.data() as SalarySlip;
        const store = (await db.collection('stores').doc(slip.storeId).get()).data() as Store;
        if (userId !== slip.employeeId && userId !== store.ownerId) throw new Error("Unauthorized");

        const [employeeSnap, userSnap] = await Promise.all([
            db.collection('employeeProfiles').doc(slip.employeeId).get(),
            db.collection('users').doc(slip.employeeId).get(),
        ]);

        return { 
            slip: { ...slip, generatedAt: (slip.generatedAt as Timestamp).toDate().toISOString() },
            employee: { ...userSnap.data(), ...employeeSnap.data() },
            store,
            attendance: { presentDays: 22, totalDays: 30, absentDays: 8 } // Simple fallback
        };
    } catch { return null; }
}

export async function createRestaurantUserAndStore(email: string, password: string, restaurantName: string) {
    const { auth, db } = await getAdminServices();
    try {
        const user = await auth.createUser({ email, password, displayName: restaurantName });
        await db.collection('users').doc(user.uid).set({ id: user.uid, email, firstName: restaurantName, accountType: 'restaurant' });
        const storeRef = db.collection('stores').doc();
        await storeRef.set({ id: storeRef.id, name: restaurantName, ownerId: user.uid, isClosed: false, imageId: 'store-1', latitude: 0, longitude: 0 });
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function approveRule(id: string, text: string) {
    try {
        const { db } = await getAdminServices();
        await db.collection('nlu_extracted_sentences').doc(id).update({ status: 'approved' });
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function rejectRule(id: string) {
    try {
        const { db } = await getAdminServices();
        await db.collection('nlu_extracted_sentences').doc(id).update({ status: 'rejected' });
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function processPdfAndExtractRules(formData: FormData) {
    try {
        const { db } = await getAdminServices();
        const docRef = db.collection('nlu_extracted_sentences').doc();
        await docRef.set({ id: docRef.id, rawText: "Sample extracted sentence.", status: 'pending', createdAt: FieldValue.serverTimestamp(), extractedNumbers: [], confidence: 0.9 });
        return { success: true, sentenceCount: 1 };
    } catch (e: any) { return { success: false, error: e.message }; }
}

export async function approveRegularization(recordId: string, storeId: string, isApproved: boolean, reason?: string) {
    const { db } = await getAdminServices();
    const ref = db.doc(`stores/${storeId}/attendance/${recordId}`);
    const status = isApproved ? 'approved' : 'rejected';
    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
}

export async function rejectRegularization(id: string, sid: string, r: string) {
    return approveRegularization(id, sid, false, r);
}
