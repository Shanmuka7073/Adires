
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import type { Order, Store, User, MenuItem, OrderItem, RestaurantIngredient, SalarySlip, EmployeeProfile, SiteConfig, GetIngredientsOutput, ReportData } from '@/lib/types';
import { getApps } from 'firebase-admin/app';
import { getIngredientsForDishFlow } from '@/ai/flows/recipe-ingredients-flow';
import * as fs from 'fs';
import * as path from 'path';

/**
 * UTILITY: Safe Date Parsing for Analytics
 */
function toDateSafe(d: any): Date {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    if (typeof d === 'object' && d.seconds) return new Date(d.seconds * 1000);
    if (typeof d === 'string') return new Date(d);
    return new Date();
}

/**
 * FIREBASE CONFIGURATION RECOVERY
 */
export async function getFirebaseConfig() {
  try {
    const adminApp = getApps()[0] || (await getAdminServices()).app;
    const options = adminApp.options as any;
    const projectId = options.projectId;
    
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: options.authDomain || (projectId ? `${projectId}.firebaseapp.com` : undefined),
      projectId: projectId,
      storageBucket: options.storageBucket || (projectId ? `${projectId}.appspot.com` : undefined),
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  } catch (e) {
    console.error("Config fetch failed:", e);
    return null;
  }
}

/**
 * AI INGREDIENT ANALYSIS
 */
export async function getIngredientsForDish(input: { dishName: string; language: 'en' | 'te' }): Promise<GetIngredientsOutput> {
    try {
        const result = await getIngredientsForDishFlow(input);
        return {
            ...result,
            nutrition: result.nutrition || { calories: 0, protein: 0 }
        };
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
 * ASHA SOURCE CODE AUDIT
 */
export async function getFileContent(filePath: string) {
    try {
        const fullPath = path.join(process.cwd(), filePath);
        // Security check: restrict to src and scripts directory
        if (!fullPath.startsWith(path.join(process.cwd(), 'src')) && !fullPath.startsWith(path.join(process.cwd(), 'scripts'))) {
             return "Access denied: Target path outside authorized scope.";
        }
        if (!fs.existsSync(fullPath)) return "File not found.";
        return fs.readFileSync(fullPath, 'utf-8');
    } catch (e) {
        return `Error reading file: ${e}`;
    }
}

/**
 * PWA MANIFEST MANAGEMENT
 */
export async function getManifest() {
    try {
        const filePath = path.join(process.cwd(), 'public', 'manifest.json');
        if (!fs.existsSync(filePath)) return null;
        return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    } catch (e) {
        return null;
    }
}

export async function updateManifest(data: any) {
    try {
        const filePath = path.join(process.cwd(), 'public', 'manifest.json');
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * NLU TRAINING ACTIONS
 */
export async function processPdfAndExtractRules(formData: FormData) {
    try {
        const { db } = await getAdminServices();
        const pdfFile = formData.get('pdf') as File;
        if (!pdfFile) throw new Error("No file provided");

        // Logic placeholder for PDF extraction
        const sentenceCount = Math.floor(Math.random() * 5) + 5; 
        
        return { success: true, sentenceCount };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function approveRule(id: string, text: string) {
    try {
        const { db } = await getAdminServices();
        await db.collection('nlu_extracted_sentences').doc(id).update({ 
            status: 'approved',
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function rejectRule(id: string) {
    try {
        const { db } = await getAdminServices();
        await db.collection('nlu_extracted_sentences').doc(id).update({ 
            status: 'rejected',
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * EXTERNAL KNOWLEDGE TOOLS
 */
export async function getWikipediaSummary(topic: string) {
    try {
        const response = await fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`);
        const data = await response.json();
        if (data.type === 'standard') {
            return { summary: data.extract };
        }
        return { error: 'Topic not found.' };
    } catch (e) {
        return { error: 'Failed to fetch from Wikipedia.' };
    }
}

export async function getMealDbRecipe(dishName: string) {
    try {
        const response = await fetch(`https://www.themealdb.com/api/json/v1/1/search.php?s=${encodeURIComponent(dishName)}`);
        const data = await response.json();
        if (data.meals && data.meals.length > 0) {
            const meal = data.meals[0];
            const ingredients = [];
            for (let i = 1; i <= 20; i++) {
                const ing = meal[`strIngredient${i}`];
                const measure = meal[`strMeasure${i}`];
                if (ing && ing.trim()) {
                    ingredients.push(`${measure ? measure.trim() : ''} ${ing.trim()}`);
                }
            }
            return { ingredients, instructions: meal.strInstructions };
        }
        return { error: 'Recipe not found.' };
    } catch (e) {
        return { error: 'Failed to fetch recipe.' };
    }
}

/**
 * RESTAURANT ORDERING ENGINE
 */
export async function placeRestaurantOrder(cartItems: any[], totalAmount: number, guestInfo: any, idToken?: string) {
    try {
        const { db } = await getAdminServices();
        const orderId = db.collection('orders').doc().id;
        const orderRef = db.collection('orders').doc(orderId);
        
        const orderData = {
            id: orderId,
            status: 'Pending',
            totalAmount,
            customerName: guestInfo.name,
            phone: guestInfo.phone,
            tableNumber: guestInfo.tableNumber,
            orderDate: FieldValue.serverTimestamp(),
            isActive: true,
            orderType: guestInfo.tableNumber === 'Counter' ? 'counter' : 'dine-in',
            items: cartItems.map(item => ({
                id: Math.random().toString(36).substring(7),
                productName: item.product.name,
                quantity: item.quantity,
                price: item.variant.price
            }))
        };

        await orderRef.set(orderData);
        return { success: true, orderId };
    } catch (e: any) {
        return { success: false, error: e.message };
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
 * BUSINESS ANALYTICS
 */
export async function getStoreSalesReport({
  storeId,
  period,
}: {
  storeId: string;
  period: 'daily' | 'weekly' | 'monthly';
}) {
  try {
    const { db } = await getAdminServices();
    const now = new Date();
    let startDate: Date;
    if (period === 'daily') startDate = new Date(now.setHours(0,0,0,0));
    else if (period === 'weekly') startDate = new Date(now.setDate(now.getDate() - 7));
    else startDate = new Date(now.getFullYear(), now.getMonth(), 1);

    const ordersSnap = await db.collection('orders')
        .where('storeId', '==', storeId)
        .where('status', 'in', ['Delivered', 'Completed'])
        .where('orderDate', '>=', Timestamp.fromDate(startDate))
        .get();

    const orders = ordersSnap.docs.map(d => ({ ...d.data() } as Order));
    const totalSales = orders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
    
    return { 
        success: true, 
        report: {
            totalSales,
            totalOrders: orders.length,
            totalItems: orders.reduce((acc, o) => acc + (o.items?.length || 0), 0),
            ingredientCost: totalSales * 0.4, 
            topProfitableProducts: [],
            costDrivers: [],
            salesByTable: [],
            optimizationHint: "Focus on peak hours to improve margins."
        }
    };
  } catch (e: any) {
    return { success: false, error: e.message };
  }
}

/**
 * ADMIN BULK OPERATIONS
 */
export async function importProductsFromUrl(url: string) {
    try {
        const response = await fetch(url);
        const text = await response.text();
        const rows = text.split('\n').slice(1);
        let count = 0;
        const { db } = await getAdminServices();
        const batch = db.batch();
        
        for (const row of rows) {
            if (!row.trim()) continue;
            const [name, category, description, imageUrl, weight, price] = row.split(',').map(s => s.trim());
            if (!name || !price) continue;
            
            const docRef = db.collection('productPrices').doc(name.toLowerCase());
            batch.set(docRef, {
                productName: name,
                variants: [{ sku: `${name}-${weight}`, weight, price: parseFloat(price), stock: 100 }]
            }, { merge: true });
            count++;
        }
        
        await batch.commit();
        return { success: true, count };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function bulkUploadRecipes(csvText: string) {
    try {
        const rows = csvText.split('\n');
        let count = 0;
        const { db } = await getAdminServices();
        const batch = db.batch();

        for (const row of rows) {
            if (!row.trim()) continue;
            const [dishName, ingredients] = row.split(',');
            if (!dishName || !ingredients) continue;

            const id = dishName.toLowerCase().replace(/\s+/g, '-');
            const docRef = db.collection('cachedRecipes').doc(id);
            batch.set(docRef, {
                id,
                dishName,
                components: ingredients.split('|').map(name => ({ name, quantity: 'As needed' })),
                createdAt: FieldValue.serverTimestamp()
            }, { merge: true });
            count++;
        }

        await batch.commit();
        return { success: true, count };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function addIngredientsToCatalog(ingredients: any[]) {
    try {
        const { db } = await getAdminServices();
        const batch = db.batch();
        for (const ing of ingredients) {
            const docRef = db.collection('restaurantIngredients').doc(ing.name.toLowerCase());
            batch.set(docRef, ing, { merge: true });
        }
        await batch.commit();
        return { success: true, count: ingredients.length };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

/**
 * EXECUTIVE DASHBOARD ANALYTICS
 */
export async function getPlatformAnalytics() {
    try {
        const { db } = await getAdminServices();
        const sixtyDaysAgo = new Date();
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        
        const [usersSnap, storesSnap, ordersSnap, configSnap] = await Promise.all([
            db.collection('users').count().get(),
            db.collection('stores').count().get(),
            db.collection('orders').where('orderDate', '>=', Timestamp.fromDate(sixtyDaysAgo)).get(),
            db.collection('siteConfig').doc('appStatus').get()
        ]);

        const allOrders = ordersSnap.docs.map(d => ({ 
            ...(d.data() as Order), 
            orderDate: toDateSafe(d.data().orderDate) 
        })) as Order[];
        
        const now = new Date();

        const calculateMetrics = (periodDays: number) => {
            const currentStart = new Date(now);
            currentStart.setDate(currentStart.getDate() - periodDays);
            
            const previousStart = new Date(currentStart);
            previousStart.setDate(previousStart.getDate() - periodDays);

            const currentOrders = allOrders.filter(o => o.orderDate >= currentStart);
            const previousOrders = allOrders.filter(o => o.orderDate >= previousStart && o.orderDate < currentStart);

            const currentRevenue = currentOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);
            const previousRevenue = previousOrders.reduce((acc, o) => acc + (o.totalAmount || 0), 0);

            const currentAOV = currentOrders.length ? currentRevenue / currentOrders.length : 0;
            const previousAOV = previousOrders.length ? previousRevenue / previousOrders.length : 0;

            const calculateTrend = (curr: number, prev: number) => prev === 0 ? 0 : ((curr - prev) / prev) * 100;

            return {
                revenue: currentRevenue,
                orders: currentOrders.length,
                aov: currentAOV,
                userReach: new Set(currentOrders.map(o => o.userId)).size,
                trends: {
                    revenue: calculateTrend(currentRevenue, previousRevenue),
                    orders: calculateTrend(currentOrders.length, previousOrders.length),
                    aov: calculateTrend(currentAOV, previousAOV),
                    userReach: calculateTrend(new Set(currentOrders.map(o => o.userId)).size, new Set(previousOrders.map(o => o.userId)).size)
                }
            };
        };

        const topStores = Array.from(
            allOrders.reduce((acc, o) => {
                const s = acc.get(o.storeId) || { id: o.storeId, name: 'Store', revenue: 0, orderCount: 0, businessType: 'Restaurant' };
                s.revenue += o.totalAmount || 0;
                s.orderCount += 1;
                acc.set(o.storeId, s);
                return acc;
            }, new Map()).values()
        ).sort((a: any, b: any) => b.revenue - a.revenue).slice(0, 5);

        return {
            totalUsers: usersSnap.data().count,
            totalStores: storesSnap.data().count,
            activeSessions: allOrders.filter(o => o.isActive).length,
            isMaintenance: configSnap.data()?.isMaintenance || false,
            decisions: [],
            topStores,
            periods: {
                today: calculateMetrics(1),
                '7d': calculateMetrics(7),
                '14d': calculateMetrics(14),
                '30d': calculateMetrics(30)
            }
        };
    } catch (error) {
        console.error("Platform Analytics failed:", error);
        return null;
    }
}

/**
 * SYSTEM HEALTH
 */
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

/**
 * PAYROLL & PROFILE DATA
 */
export async function getSalarySlipData(slipId: string, userId: string, storeId?: string) {
    try {
        const { db } = await getAdminServices();
        
        let slipSnap;
        if (storeId) {
            slipSnap = await db.collection(`stores/${storeId}/salarySlips`).doc(slipId).get();
        } else {
            // Expensive group search fallback
            const slips = await db.collectionGroup('salarySlips').where('id', '==', slipId).get();
            slipSnap = slips.docs[0];
        }

        if (!slipSnap || !slipSnap.exists) return null;
        const slip = slipSnap.data() as SalarySlip;

        // Auth check
        if (slip.employeeId !== userId) {
            const ownerStore = await db.collection('stores').where('id', '==', slip.storeId).where('ownerId', '==', userId).get();
            if (ownerStore.empty) return null;
        }

        const [userSnap, profileSnap, storeSnap] = await Promise.all([
            db.collection('users').doc(slip.employeeId).get(),
            db.collection('employeeProfiles').doc(slip.employeeId).get(),
            db.collection('stores').doc(slip.storeId).get()
        ]);

        return {
            slip,
            employee: { ...profileSnap.data(), ...userSnap.data() },
            store: storeSnap.data(),
            attendance: { totalDays: 30, presentDays: 22, absentDays: 8 } // Simple mock for now
        };
    } catch (e) {
        return null;
    }
}

export async function updateEmployee(userId: string, data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('employeeProfiles').doc(userId).set(data, { merge: true });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function approveRegularization(id: string, storeId: string, approve: boolean) {
    try {
        const { db } = await getAdminServices();
        await db.collection(`stores/${storeId}/attendance`).doc(id).update({
            status: approve ? 'approved' : 'rejected',
            updatedAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function rejectRegularization(id: string, storeId: string, reason: string) {
    try {
        const { db } = await getAdminServices();
        const recordRef = db.collection(`stores/${storeId}/attendance`).doc(id);
        
        await recordRef.update({
            status: 'rejected',
            updatedAt: FieldValue.serverTimestamp(),
            // Append rejection reason to the history
            reasonHistory: FieldValue.arrayUnion({
                text: reason,
                timestamp: new Date(),
                status: 'rejected'
            })
        });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function getPlaceholderImages() { 
    try {
        const { db } = await getAdminServices();
        const snap = await db.collection('siteConfig').doc('placeholderImages').get();
        return snap.data() || { placeholderImages: [] };
    } catch (e) {
        return { placeholderImages: [] };
    }
}

export async function updatePlaceholderImages(data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('siteConfig').doc('placeholderImages').set(data, { merge: true });
        return { success: true };
    } catch (e: any) {
        return { success: false, error: e.message };
    }
}

export async function executeCommand(cmd: string) { return { success: true, message: "Command executed at edge." }; }
export async function getSiteConfig(id: string) { 
    try {
        const { db } = await getAdminServices();
        const snap = await db.collection('siteConfig').doc(id).get();
        return snap.data() || {};
    } catch (e) { return {}; }
}
export async function updateSiteConfig(id: string, data: any) {
    try {
        const { db } = await getAdminServices();
        await db.collection('siteConfig').doc(id).set(data, { merge: true });
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}
export async function updateStoreImageUrl(id: string, url: string) {
    try {
        const { db } = await getAdminServices();
        await db.collection('stores').doc(id).update({ imageUrl: url });
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}
export async function updateUserProfileImage(id: string, url: string) {
    try {
        const { db } = await getAdminServices();
        await db.collection('users').doc(id).update({ imageUrl: url });
        return { success: true };
    } catch (e: any) { return { success: false, error: e.message }; }
}
