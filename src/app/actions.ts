
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig, NluExtractedSentence, MenuItem, Menu, CachedRecipe, GetIngredientsOutput, RestaurantIngredient, EmployeeProfile, SalarySlip, Store, AttendanceRecord, ReasonEntry, User, CartItem } from '@/lib/types';
import { getApps } from 'firebase-admin/app';
import { v4 as uuidv4 } from 'uuid';
import { ai } from '@/ai/genkit';
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
    } catch (error) {
        return { success: false, error: (error as Error).message };
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

/**
 * Places a batch of items as a distinct order within a restaurant session.
 */
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
}): Promise<{ success: boolean; error?: string; orderId?: string }> {
  try {
    const { db } = await getAdminServices();
    
    // Each distinct "Place Order" click creates a unique order document.
    // They are linked via the sessionId.
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

    await orderDocRef.set({
      id: orderId, 
      storeId: storeId, 
      tableNumber: tableNumber ? String(tableNumber) : null,
      sessionId: sessionId,
      userId: 'guest',
      customerName: customerName || (tableNumber ? `Table ${tableNumber}` : 'Guest'),
      deliveryAddress: deliveryAddress || (tableNumber ? 'In-store dining' : 'TBD'),
      deliveryLat: deliveryLat || 0,
      deliveryLng: deliveryLng || 0,
      zoneId: zoneId || 'local-service',
      phone: phone || '',
      status: 'Pending', // New orders go straight to Pending
      isActive: true, 
      orderDate: FieldValue.serverTimestamp(), 
      updatedAt: FieldValue.serverTimestamp(),
      items: orderItems,
      totalAmount: totalAmount,
    });

    return { success: true, orderId };
  } catch (error: any) {
    console.error("Robust POS add failed:", error);
    return { success: false, error: error.message };
  }
}

/**
 * Finalizes all active orders in a session for payment.
 */
export async function confirmOrderSession(sessionId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { db } = await getAdminServices();
    const snapshot = await db.collection('orders').where('sessionId', '==', sessionId).where('isActive', '==', true).get();
    
    if (snapshot.empty) return { success: false, error: 'No active orders found for this session.' };
    
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
      batch.update(doc.ref, { status: 'Completed', isActive: false, paidAt: Timestamp.now(), paymentMode: 'UPI' });
    });
    await batch.commit();
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
  const startTimestamp = Timestamp.fromDate(getStartDate(period));
  try {
    const [ordersSnapshot, ingredientsSnapshot] = await Promise.all([
        db.collection('orders').where('storeId', '==', storeId).where('status', 'in', ['Completed', 'Billed', 'Delivered']).where('orderDate', '>=', startTimestamp).get(),
        db.collection('restaurantIngredients').get()
    ]);
    const validOrders = ordersSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    if (validOrders.length === 0) return { success: true, report: { totalSales: 0, totalOrders: 0, totalItems: 0, topProducts: [], topProfitableProducts: [], ingredientUsage: [], ingredientCost: 0, costDrivers: [], optimizationHint: null, salesByTable: [] } };
    let totalSales = 0; let totalIngredientCost = 0;
    const productMap = new Map<string, any>(); const ingredientUsageMap = new Map<string, any>(); const salesByTableMap = new Map<string, any>();
    for (const order of validOrders) {
      totalSales += order.totalAmount;
      const tableNumber = order.tableNumber || 'Delivery';
      if (!salesByTableMap.has(tableNumber)) salesByTableMap.set(tableNumber, { tableNumber, totalSales: 0, orderCount: 0, totalCost: 0 });
      const tableStats = salesByTableMap.get(tableNumber);
      tableStats.totalSales += order.totalAmount; tableStats.orderCount += 1;
      for (const item of order.items || []) {
        const key = item.productName.toLowerCase();
        const productStat = productMap.get(key) || { count: 0, totalProfit: 0, revenue: 0 };
        productStat.count += item.quantity; productStat.revenue += item.price * item.quantity;
        let itemCost = 0;
        for (const ing of item.recipeSnapshot || []) {
            const cost = (ing.cost || 0) * item.quantity; itemCost += cost;
            const prevUsage = ingredientUsageMap.get(ing.name) || { quantity: 0, cost: 0 };
            ingredientUsageMap.set(ing.name, { quantity: prevUsage.quantity + (ing.qty * item.quantity), cost: prevUsage.cost + cost });
        }
        totalIngredientCost += itemCost; tableStats.totalCost += itemCost;
        productStat.totalProfit += (item.price * item.quantity) - itemCost;
        productMap.set(key, productStat);
      }
    }
    const salesByTable = Array.from(salesByTableMap.values()).map(table => ({ ...table, grossProfit: table.totalSales - table.totalCost, profitPerOrder: table.orderCount > 0 ? (table.totalSales - table.totalCost) / table.orderCount : 0, profitPercentage: table.totalSales > 0 ? ((table.totalSales - table.totalCost) / table.totalSales) * 100 : 0 }));
    const costDrivers = Array.from(ingredientUsageMap.entries()).map(([name, data]) => ({ name, cost: data.cost, percentage: totalIngredientCost > 0 ? (data.cost / totalIngredientCost) * 100 : 0 })).sort((a,b) => b.cost - a.cost);
    return { success: true, report: { totalSales, totalOrders: validOrders.length, totalItems: Array.from(productMap.values()).reduce((acc, s) => acc + s.count, 0), topProducts: Array.from(productMap.entries()).map(([name, stat]) => ({ name, count: stat.count })).sort((a,b) => b.count - a.count).slice(0, 5), topProfitableProducts: Array.from(productMap.entries()).map(([name, stat]) => ({ name, totalProfit: stat.totalProfit, profitPerUnit: stat.count > 0 ? stat.totalProfit / stat.count : 0, count: stat.count })).sort((a,b) => b.totalProfit - a.totalProfit).slice(0, 10), ingredientUsage: Array.from(ingredientUsageMap.entries()).map(([name, data]) => ({ name, cost: data.cost, quantity: data.quantity, unit: 'base' })), ingredientCost: totalIngredientCost, costDrivers, optimizationHint: costDrivers.length > 0 ? `Your biggest cost driver is "${costDrivers[0].name}" at ${costDrivers[0].percentage.toFixed(1)}% of total cost.` : null, salesByTable } };
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
                itemType: 'food',
                components: ingredientsStr.split('|').map(i => ({ name: i.trim(), quantity: '1 unit', baseQuantity: 1, unit: 'pcs' })),
                steps: [],
                nutrition: { calories: 0, protein: 0 },
                createdAt: FieldValue.serverTimestamp()
            }, { merge: true });
            count++;
        }
        if (count > 0) await batch.commit();
        return { success: true, count };
    } catch (e: any) { return { success: false, count: 0, error: e.message }; }
}

export async function getIngredientsForDish(input: { dishName: string; language: 'en' | 'te', existingRecipe?: GetIngredientsOutput }): Promise<GetIngredientsOutput> {
  return getIngredientsForDishFlow(input);
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
        const [employeeSnap, userSnap] = await Promise.all([db.collection('employeeProfiles').doc(slip.employeeId).get(), db.collection('users').doc(slip.employeeId).get()]);
        return { slip: { ...slip, generatedAt: (slip.generatedAt as Timestamp).toDate().toISOString() }, employee: { ...userSnap.data(), ...employeeSnap.data() }, store, attendance: { presentDays: 22, totalDays: 30, absentDays: 8 } };
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

export async function approveRegularization(recordId: string, storeId: string, isApproved: boolean, reason?: string) {
    const { db } = await getAdminServices();
    const ref = db.doc(`stores/${storeId}/attendance/${recordId}`);
    const status = isApproved ? 'approved' : 'rejected';
    await ref.update({ status, updatedAt: FieldValue.serverTimestamp() });
}

export async function rejectRegularization(id: string, sid: string, r: string) {
    return approveRegularization(id, sid, false, r);
}

export async function updateEmployee(userId: string, data: any): Promise<{ success: boolean; error?: string }> {
    const { auth, db } = await getAdminServices();
    try {
        if (data.email) await auth.updateUser(userId, { email: data.email });
        const batch = db.batch();
        const userRef = db.collection('users').doc(userId);
        batch.update(userRef, { firstName: data.firstName, lastName: data.lastName, phoneNumber: data.phone, address: data.address, email: data.email });
        const profileRef = db.collection('employeeProfiles').doc(userId);
        batch.update(profileRef, { firstName: data.firstName, lastName: data.lastName, phone: data.phone, address: data.address, role: data.role, salaryRate: data.salaryRate, salaryType: data.salaryType, payoutMethod: data.payoutMethod, reportingTo: data.reportingTo, email: data.email, upiId: data.payoutMethod === 'upi' ? data.upiId : null, bankDetails: data.payoutMethod === 'bank' ? { accountHolderName: data.accountHolderName || '', accountNumber: data.accountNumber || '', ifscCode: data.ifscCode || '' } : null });
        await batch.commit();
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message || "Unknown server error" }; }
}
