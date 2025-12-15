
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { getStorage } from 'firebase-admin/storage';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig, CartItem, NluExtractedSentence, MenuItem } from '@/lib/types';
import { headers } from 'next/headers';
import { getApp, getApps } from 'firebase-admin/app';
import * as pdfjs from 'pdfjs-dist';

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
  quantity
}: {
  storeId: string;
  sessionId: string;
  tableNumber: string | null;
  item: MenuItem;
  quantity: number;
}): Promise<{ success: boolean, error?: string }> {
  try {
    const { db } = await getAdminServices();
    const orderId = `${storeId}_${sessionId}`;
    const orderRef = db.collection('orders').doc(orderId);
    
    const orderItem: OrderItem = {
      id: `${item.name.replace(/\s+/g, '-')}-${Date.now()}`,
      orderId,
      productId: `${storeId}-${item.name.replace(/\s/g, '-')}`,
      productName: item.name,
      variantSku: 'default',
      variantWeight: '1 pc',
      quantity,
      price: item.price,
      ingredients: item.ingredients || [],
    };

    const doc = await orderRef.get();

    if (!doc.exists) {
      const newOrder: Partial<Order> = {
        id: orderId,
        storeId,
        sessionId,
        tableNumber,
        userId: 'guest',
        customerName: `Table ${tableNumber || 'N/A'}`,
        deliveryAddress: "In-store dining",
        items: [orderItem],
        totalAmount: orderItem.price * orderItem.quantity,
        status: 'Pending',
        orderDate: Timestamp.now(),
      };
      await orderRef.set(newOrder);
    } else {
      await orderRef.update({
        items: FieldValue.arrayUnion(orderItem),
        totalAmount: FieldValue.increment(orderItem.price * orderItem.quantity),
        updatedAt: FieldValue.serverTimestamp(),
        status: 'Pending' // Revert to pending if they add more items
      });
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


export async function getStoreSalesReport({
  storeId,
  period,
}: {
  storeId: string;
  period: 'daily' | 'weekly' | 'monthly';
}) {
  try {
    const { db } = await getAdminServices();

    if (!storeId) {
      return { success: false, error: 'Store ID is required' };
    }

    const now = new Date();
    let startDate: Date;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - now.getDay());
      startDate.setHours(0, 0, 0, 0);
    } else {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const snapshot = await db
      .collection('orders')
      .where('storeId', '==', storeId)
      .where('status', 'in', ['Completed', 'Billed'])
      .get();
    
    const validOrders = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as Order))
      .filter(order => {
        const orderDate = (order.orderDate as Timestamp).toDate();
        return orderDate >= startDate;
      });

    if (validOrders.length === 0) {
      return {
        success: true,
        report: {
          totalSales: 0,
          totalItems: 0,
          totalOrders: 0,
          topProducts: [],
          totalCost: 0,
          profit: 0,
          ingredientUsage: [],
        },
      };
    }

    let totalSales = 0;
    let totalCost = 0;
    const productMap = new Map<string, number>();
    const ingredientMap = new Map<string, { quantity: number; unit: string }>();

    for (const order of validOrders) {
      totalSales += order.totalAmount;
      const itemsSnapshot = await db.collection('orders', order.id, 'items').get();
      
      const items: OrderItem[] = itemsSnapshot.docs.map(d => d.data() as OrderItem);

      for (const item of items) {
        productMap.set(
          item.productName,
          (productMap.get(item.productName) || 0) + item.quantity
        );

        if (item.ingredients) {
          item.ingredients.forEach(ing => {
            totalCost += (ing.costPerUnit || 0) * ing.quantity * item.quantity;
            
            const currentUsage = ingredientMap.get(ing.name) || { quantity: 0, unit: ing.unit };
            ingredientMap.set(ing.name, {
              quantity: currentUsage.quantity + (ing.quantity * item.quantity),
              unit: ing.unit,
            });
          });
        }
      }
    }

    return {
      success: true,
      report: {
        totalSales,
        totalCost,
        profit: totalSales - totalCost,
        totalOrders: validOrders.length,
        totalItems: Array.from(productMap.values()).reduce((a, b) => a + b, 0),
        topProducts: [...productMap.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([name, count]) => ({ name, count })),
        ingredientUsage: [...ingredientMap.entries()].map(([name, data]) => ({
          name,
          quantity: data.quantity,
          unit: data.unit,
        })),
      },
    };
  } catch (error: any) {
    console.error('Sales report error:', error);
    return { success: false, error: error.message };
  }
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
Cost: ₹${report.totalCost.toFixed(0)}
Profit: ₹${report.profit.toFixed(0)}
Orders: ${report.totalOrders}

Top Item: ${report.topProducts[0]?.name || 'N/A'}
`;
}
    


    
