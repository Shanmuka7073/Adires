
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { getStorage } from 'firebase-admin/storage';
import { Timestamp } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig, CartItem } from '@/lib/types';
import { headers } from 'next/headers';
import { getApp, getApps } from 'firebase-admin/app';

/**
 * NEW: Server action to securely provide the client-side Firebase config.
 * This ensures client and server are always in sync.
 */
export async function getFirebaseConfig() {
  try {
    const adminApp = getApps()[0] || (await getAdminServices()).app;
    // The client SDK needs the API key, which isn't in the default app options.
    // This is a simplified way to expose it. In a real production app,
    // this might come from a more secure config source.
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
      authDomain: adminApp.options.authDomain,
      projectId: adminApp.options.projectId,
      storageBucket: adminApp.options.storageBucket,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  } catch (error) {
    console.error("Failed to get Firebase config:", error);
    return null;
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
        'User-Agent': 'LocalBasket/1.0 (https://localbasket.com; admin@localbasket.com)'
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
        'User-Agent': 'LocalBasket/1.0 (https://localbasket.com; admin@localbasket.com)'
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
        const storeRef = db.collection('stores').doc(storeId);
        await storeRef.update({ imageUrl: downloadURL });

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
        const batch = db.batch();
        const rows = csvText.split('\n').slice(1); // Skip header
        let processedCount = 0;

        for (const row of rows) {
            if (!row.trim()) continue;

            const [dishName, ingredientsString, instructionsString] = row.split(',');
            if (!dishName || !ingredientsString) {
                console.warn(`Skipping invalid row: ${row}`);
                continue;
            }
            
            const ingredients = ingredientsString.split('|').map(ing => {
                const parts = ing.trim().split(';');
                return { name: parts[1] || '', quantity: parts[0] || '' };
            }).filter(ing => ing.name && ing.quantity);

            const instructions = instructionsString ? instructionsString.split('|').map(step => {
                 const [title, ...actions] = step.split(';');
                 return { title: title.trim(), actions: actions.map(a => a.trim()) };
            }) : [];
            
            const normalizedId = dishName.toLowerCase().replace(/\s+/g, '-');
            const recipeRef = db.collection('cachedRecipes').doc(normalizedId);

            const recipeData = {
                id: normalizedId,
                dishName: dishName.trim(),
                ingredients,
                instructions,
                createdAt: Timestamp.now()
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

export async function placeRestaurantOrder(
    cartItems: CartItem[], 
    cartTotal: number, 
    guestInfo: {name: string, phone: string},
    idToken: string | null
): Promise<{ success: boolean; orderId?: string; error?: string; }> {
    try {
        const { db, auth: adminAuth } = await getAdminServices();
        
        if (!idToken) {
            return { success: false, error: 'Authentication token is required.' };
        }
        
        const decodedToken = await adminAuth.verifyIdToken(idToken);
        const userId = decodedToken.uid;
        
        let customerName = guestInfo.name;
        let customerPhone = guestInfo.phone;
        let customerEmail: string | undefined;
        let userDocData: any = {};
        
        // This logic correctly handles both anonymous and registered users.
        // If the user is not anonymous, we try to fetch their profile details.
        if (!decodedToken.isAnonymous) {
            const userDoc = await db.collection('users').doc(userId).get();
            if (userDoc.exists) {
                userDocData = userDoc.data();
                customerName = `${userDocData?.firstName} ${userDocData?.lastName}`;
                customerPhone = userDocData?.phoneNumber || 'N/A';
                customerEmail = userDocData?.email;
            }
        }
        
        if (cartItems.length === 0) {
            return { success: false, error: 'Cart is empty.' };
        }
        
        const firstItem = cartItems[0];
        const storeId = firstItem.product.storeId;
        if (!storeId) {
             return { success: false, error: 'Store ID is missing from cart items.' };
        }

        const orderRef = db.collection('orders').doc();
        const orderData: Order = {
            id: orderRef.id,
            userId,
            storeId: storeId, 
            customerName,
            deliveryAddress: userDocData?.address || 'In-store pickup',
            phone: customerPhone,
            email: customerEmail,
            orderDate: Timestamp.now(),
            status: 'Pending',
            totalAmount: cartTotal,
            items: cartItems.map(item => ({
                productId: item.product.id,
                productName: item.product.name,
                variantSku: item.variant.sku,
                variantWeight: item.variant.weight,
                quantity: item.quantity,
                price: item.variant.price
            }))
        };

        await orderRef.set(orderData);
        
        return { success: true, orderId: orderRef.id };

    } catch (error: any) {
        console.error("placeRestaurantOrder failed:", error);
        return { success: false, error: error.message || "An unknown server error occurred." };
    }
}
