
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { getStorage } from 'firebase-admin/storage';
import { updateDoc, doc, writeBatch, serverTimestamp, collection, getDocs, where, query, Timestamp } from 'firebase/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant } from '@/lib/types';


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
        const batch = writeBatch(db);
        
        const adminStoreQuery = query(collection(db, 'stores'), where('name', '==', 'LocalBasket'));
        const adminStoreSnap = await getDocs(adminStoreQuery);
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
            const productRef = doc(collection(db, 'stores', adminStoreId, 'products'));
            batch.set(productRef, {
                name,
                category,
                description: description || '',
                imageUrl: imageUrl || '',
                storeId: adminStoreId,
                imageId: imageId,
                imageHint: productNameLower,
            });

            const priceRef = doc(db, 'productPrices', productNameLower);
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

/**
 * Fetches a summary from Wikipedia's public API by first searching for the
 * best matching article, then fetching its summary.
 * @param topic The topic to search for.
 * @returns A promise that resolves to the summary text or an error message.
 */
export async function getWikipediaSummary(topic: string): Promise<{ summary?: string; error?: string }> {
  const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(topic)}&format=json&utf8=1`;

  try {
    // Step 1: Search for the topic to find the correct article title
    const searchResponse = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'GrozoApp/1.0 (https://grozo.com; admin@grozo.com)'
      }
    });
    
    if (!searchResponse.ok) {
        throw new Error(`Wikipedia search API returned status ${searchResponse.status}`);
    }

    const searchData = await searchResponse.json();

    if (!searchData.query.search || searchData.query.search.length === 0) {
      return { error: `I couldn't find any Wikipedia articles related to "${topic}".` };
    }

    const bestTitle = searchData.query.search[0].title;

    // Step 2: Fetch the summary for the best matching article title
    const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestTitle)}`;
    
    const summaryResponse = await fetch(summaryUrl, {
      headers: {
        'Accept': 'application/json; charset=utf-8',
        'User-Agent': 'GrozoApp/1.0 (https://grozo.com; admin@grozo.com)'
      }
    });

    if (!summaryResponse.ok) {
      throw new Error(`Wikipedia summary API returned status ${summaryResponse.status}`);
    }

    const summaryData = await summaryResponse.json();

    if (summaryData.type === 'disambiguation') {
      return { error: `The term "${topic}" is ambiguous. Please be more specific.` };
    }
    
    if (!summaryData.extract) {
      return { error: `I found an article for "${bestTitle}", but couldn't get a summary.` };
    }

    return { summary: summaryData.extract };

  } catch (error: any) {
    console.error("Wikipedia API fetch error:", error);
    return { error: error.message || `Failed to fetch information for "${topic}".` };
  }
}

/**
 * Fetches a recipe from TheMealDB API.
 * @param dishName The name of the dish to search for.
 * @returns A promise that resolves to the recipe details or an error message.
 */
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
      const ingredient = meal[`strIngredient${i}`];
      const measure = meal[`strMeasure${i}`];
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


/**
 * Uploads a store image from a base64 data URI to Firebase Storage.
 * This is a server action to keep storage credentials secure.
 * @param storeId The ID of the store to associate the image with.
 * @param dataUri The base64-encoded image data URI.
 * @returns An object with the download URL or an error message.
 */
export async function uploadStoreImage(storeId: string, dataUri: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
        const { db } = await getAdminServices();
        const storage = getStorage();
        const bucket = storage.bucket();

        // Extract mime type and base64 data
        const match = dataUri.match(/^data:(image\/[a-z]+);base64,(.*)$/);
        if (!match) {
            return { success: false, error: 'Invalid data URI format.' };
        }
        const mimeType = match[1];
        const base64Data = match[2];
        const buffer = Buffer.from(base64Data, 'base64');
        
        const fileName = `${Date.now()}_${Math.round(Math.random() * 1E9)}.jpg`;
        const filePath = `store-images/${storeId}/${fileName}`;
        const file = bucket.file(filePath);

        // Upload the file
        await file.save(buffer, {
            metadata: {
                contentType: mimeType,
            },
            public: true, // Make the file publicly readable
        });
        
        // Get the public URL
        const downloadURL = file.publicUrl();

        // Update the store document with the new image URL
        const storeRef = doc(db, 'stores', storeId);
        await updateDoc(storeRef, { imageUrl: downloadURL });

        return { success: true, url: downloadURL };
    } catch (error: any) {
        console.error('Server-side image upload failed:', error);
        return { success: false, error: error.message || 'An unknown error occurred during upload.' };
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
        return null;
    }
}

export async function updateManifest(newData: { icons?: any[], screenshots?: any[]; shortcuts?: any[] }): Promise<{ success: boolean; error?: string }> {
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

/**
 * Processes a CSV string and bulk-uploads recipes to the cachedRecipes collection.
 * @param csvText The raw string content of the CSV file.
 * @returns An object indicating success, count of uploaded recipes, or an error message.
 */
export async function bulkUploadRecipes(csvText: string): Promise<{ success: boolean; count?: number; error?: string; }> {
    if (!csvText) {
        return { success: false, error: 'CSV text cannot be empty.' };
    }

    try {
        const { db } = await getAdminServices();
        const batch = writeBatch(db);
        const rows = csvText.split('\n').slice(1); // Skip header
        let processedCount = 0;

        for (const row of rows) {
            if (!row.trim()) continue;

            const [dishName, ingredientsString] = row.split(',');
            if (!dishName || !ingredientsString) {
                console.warn(`Skipping invalid row: ${row}`);
                continue;
            }

            const ingredients = ingredientsString.split('|').map(ing => ing.trim()).filter(Boolean);
            if (ingredients.length === 0) {
                console.warn(`Skipping row with no ingredients: ${dishName}`);
                continue;
            }
            
            const normalizedId = dishName.toLowerCase().replace(/\s+/g, '-');
            const recipeRef = doc(db, 'cachedRecipes', normalizedId);

            const recipeData = {
                id: normalizedId,
                dishName: dishName.trim(),
                ingredients,
                createdAt: serverTimestamp()
            };
            batch.set(recipeRef, recipeData);
            processedCount++;
        }

        if (processedCount > 0) {
            await batch.commit();
        }

        return { success: true, count: processedCount };

    } catch (error: any) {
        console.error('Bulk recipe upload failed:', error);
        return { success: false, error: error.message || 'An unknown server error occurred.' };
    }
}

const getPlaceholderImagesPath = () => {
    return path.join(process.cwd(), 'src', 'lib', 'placeholder-images.json');
};

export async function getPlaceholderImages() {
    try {
        const imagesPath = getPlaceholderImagesPath();
        const imagesFile = await fs.readFile(imagesPath, 'utf-8');
        return JSON.parse(imagesFile);
    } catch (error) {
        console.error('Failed to read placeholder-images.json file:', error);
        return { placeholderImages: [] };
    }
}

export async function updatePlaceholderImages(newData: { placeholderImages: any[] }): Promise<{ success: boolean; error?: string }> {
    try {
        const imagesPath = getPlaceholderImagesPath();
        await fs.writeFile(imagesPath, JSON.stringify(newData, null, 2), 'utf-8');
        return { success: true };
    } catch (error: any) {
        console.error('Failed to update placeholder-images.json file:', error);
        return { success: false, error: error.message || 'An unknown error occurred.' };
    }
}

/**
 * Generates a sales report for a given period, categorized into grocery, meat, and vegetables.
 * @param period Specifies whether to generate a 'daily' or 'monthly' report.
 * @returns A promise that resolves with the sales report or an error.
 */
export async function getSalesReport(period: 'daily' | 'monthly'): Promise<{ success: boolean; report?: any; error?: string; }> {
  const { db } = await getAdminServices();

  const now = new Date();
  let startDate: Date;

  if (period === 'daily') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else { // monthly
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  const startTimestamp = Timestamp.fromDate(startDate);

  try {
    // Step 1: Fetch all products from the master 'LocalBasket' store to create a product-to-category map.
    const masterStoreQuery = query(collection(db, 'stores'), where('name', '==', 'LocalBasket'));
    const masterStoreSnap = await getDocs(masterStoreQuery);
    if (masterStoreSnap.empty) throw new Error("Master 'LocalBasket' store not found.");
    const masterStoreId = masterStoreSnap.docs[0].id;
    
    const productsSnapshot = await getDocs(collection(db, 'stores', masterStoreId, 'products'));
    // CORRECTED: Use a case-insensitive map for categories.
    const productCategoryMap = new Map<string, string>();
    productsSnapshot.forEach(doc => {
      productCategoryMap.set(doc.data().name.toLowerCase(), doc.data().category);
    });

    // Step 2: Fetch all 'Delivered' orders within the specified date range.
    const ordersQuery = query(
      collection(db, 'orders'),
      where('status', '==', 'Delivered'),
      where('orderDate', '>=', startTimestamp)
    );
    const orderSnapshot = await getDocs(ordersQuery);
    const deliveredOrders = orderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

    // Step 3: Initialize the report structure.
    const report = {
      grocery: { totalSales: 0, itemCount: 0, topProducts: new Map<string, number>() },
      meat: { totalSales: 0, itemCount: 0, topProducts: new Map<string, number>() },
      vegetable: { totalSales: 0, itemCount: 0, topProducts: new Map<string, number>() },
    };

    const meatCategories = ['fresh cut', 'meat & fish'];
    const vegetableCategories = ['vegetables'];
    
    // Step 4: Iterate through each delivered order.
    for (const order of deliveredOrders) {
      // Step 4a: Correctly query the 'orderItems' subcollection for each order.
      const itemsQuery = collection(db, 'orders', order.id, 'orderItems');
      const itemsSnapshot = await getDocs(itemsQuery);
      
      if (itemsSnapshot.empty) continue; // Skip if order has no items.

      const items = itemsSnapshot.docs.map(doc => doc.data() as OrderItem);

      // Step 4b: Process each item in the order.
      for (const item of items) {
        const itemTotal = item.price * item.quantity;
        // CORRECTED: Use case-insensitive lookup for the category.
        const category = productCategoryMap.get(item.productName.toLowerCase())?.toLowerCase() || 'grocery';
        
        let reportCategory: 'grocery' | 'meat' | 'vegetable';

        if (meatCategories.includes(category)) {
          reportCategory = 'meat';
        } else if (vegetableCategories.includes(category)) {
          reportCategory = 'vegetable';
        } else {
          reportCategory = 'grocery';
        }

        // Step 4d: Aggregate the sales data.
        report[reportCategory].totalSales += itemTotal;
        report[reportCategory].itemCount += item.quantity;
        
        const currentQty = report[reportCategory].topProducts.get(item.productName) || 0;
        report[reportCategory].topProducts.set(item.productName, currentQty + item.quantity);
      }
    }

    // Step 5: Format the top products list for the final report.
    const formatTopProducts = (topProducts: Map<string, number>) => {
        return Array.from(topProducts.entries())
          .sort((a, b) => b[1] - a[1]) // Sort by count descending
          .slice(0, 5) // Get top 5
          .map(([name, count]) => ({ name, count }));
    };

    return {
        success: true,
        report: {
            grocery: { ...report.grocery, topProducts: formatTopProducts(report.grocery.topProducts) },
            meat: { ...report.meat, topProducts: formatTopProducts(report.meat.topProducts) },
            vegetable: { ...report.vegetable, topProducts: formatTopProducts(report.vegetable.topProducts) },
        }
    };

  } catch (error: any) {
    console.error("Sales report generation failed:", error);
    return { success: false, error: error.message || 'An unknown server error occurred.' };
  }
}

    