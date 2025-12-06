
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { getStorage } from 'firebase-admin/storage';
import { Timestamp } from 'firebase-admin/firestore';
import { collection, doc, writeBatch, serverTimestamp, getDocs, where, query, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig } from '@/lib/types';


/**
 * Safely fetch documents count from Firestore collections.
 */
async function getFirestoreCounts() {
    try {
        const { db } = await getAdminServices();

        const [users, stores, partners, commands] = await Promise.all([
            getDocs(collection(db, 'users')),
            getDocs(collection(db, 'stores')),
            getDocs(collection(db, 'deliveryPartners')),
            getDocs(collection(db, 'voiceCommands')),
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
        const batch = db.batch(); // Use the admin batch
        
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

export async function uploadPwaIcon(formData: FormData): Promise<{ success: boolean, error?: string, icon192Url?: string, icon512Url?: string }> {
    // This is a placeholder implementation.
    // In a real scenario, you would use a library like 'sharp' to resize the image.
    // For now, we will just save the original file and simulate resizing.
    const file = formData.get('file') as File;
    if (!file) {
        return { success: false, error: 'No file provided.' };
    }

    try {
        const publicDir = path.join(process.cwd(), 'public');
        const icon192Path = path.join(publicDir, 'icon-192x192.png');
        const icon512Path = path.join(publicDir, 'icon-512x512.png');

        const buffer = Buffer.from(await file.arrayBuffer());

        // In a real app, you would resize the buffer here to 192x192 and 512x512
        await fs.writeFile(icon192Path, buffer);
        await fs.writeFile(icon512Path, buffer);

        const manifestPath = getManifestPath();
        const manifest = await getManifest();
        if (!manifest) {
            throw new Error('Could not load manifest file to update icons.');
        }

        const icon192Url = '/icon-192x192.png';
        const icon512Url = '/icon-512x512.png';

        manifest.icons = [
            { src: icon192Url, sizes: '192x192', type: 'image/png' },
            { src: icon512Url, sizes: '512x512', type: 'image/png' },
        ];

        await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');

        return { success: true, icon192Url, icon512Url };

    } catch (error: any) {
        console.error('PWA Icon upload failed:', error);
        return { success: false, error: error.message || 'An unknown server error occurred.' };
    }
}


/**
 * Generates a sales report for a given period, categorized into grocery, meat, and vegetables.
 * @param period Specifies whether to generate a 'daily' or 'monthly' report.
 * @returns A promise that resolves with the sales report or an error.
 */
export async function getSalesReport(period: 'daily' | 'monthly'): Promise<{ success: boolean; report?: any; error?: string; }> {
  try {
    const { db } = await getAdminServices();

    const now = new Date();
    let startDate: Date;

    if (period === 'daily') {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else { // monthly
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    // Use the Timestamp from the Admin SDK
    const startTimestamp = Timestamp.fromDate(startDate);

    const masterStoreQuery = query(collection(db, 'stores'), where('name', '==', 'LocalBasket'));
    const masterStoreSnap = await getDocs(masterStoreQuery);
    if (masterStoreSnap.empty) throw new Error("Master 'LocalBasket' store not found.");
    const masterStoreId = masterStoreSnap.docs[0].id;
    
    const productsSnapshot = await getDocs(collection(db, 'stores', masterStoreId, 'products'));
    const productCategoryMap = new Map<string, string>();
    // Correctly map by product ID
    productsSnapshot.forEach(doc => {
      productCategoryMap.set(doc.id, doc.data().category?.toLowerCase() || 'grocery');
    });

    const ordersQuery = query(
        collection(db, 'orders'),
        where('status', 'in', ['Delivered', 'delivered', 'Completed']),
        where('orderDate', '>=', startTimestamp)
    );
    const orderSnapshot = await getDocs(ordersQuery);
    const deliveredOrders = orderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));

    const report = {
      grocery: { totalSales: 0, itemCount: 0, topProducts: new Map<string, number>() },
      meat: { totalSales: 0, itemCount: 0, topProducts: new Map<string, number>() },
      vegetable: { totalSales: 0, itemCount: 0, topProducts: new Map<string, number>() },
    };

    const meatCategories = ['fresh cut', 'meat & fish'];
    const vegetableCategories = ['vegetables'];
    
    for (const order of deliveredOrders) {
      const itemsQuery = collection(db, 'orders', order.id, 'orderItems');
      const itemsSnapshot = await getDocs(itemsQuery);
      
      if (itemsSnapshot.empty) continue; // Skip if order has no items.

      const items = itemsSnapshot.docs.map(doc => doc.data() as OrderItem);

      for (const item of items) {
        const itemTotal = item.price * item.quantity;
        // Use productId for robust mapping
        const category = productCategoryMap.get(item.productId) || 'grocery';
        
        let reportCategory: 'grocery' | 'meat' | 'vegetable';

        if (meatCategories.includes(category)) {
          reportCategory = 'meat';
        } else if (vegetableCategories.includes(category)) {
          reportCategory = 'vegetable';
        } else {
          reportCategory = 'grocery';
        }

        report[reportCategory].totalSales += itemTotal;
        report[reportCategory].itemCount += item.quantity;
        
        const currentQty = report[reportCategory].topProducts.get(item.productName) || 0;
        report[reportCategory].topProducts.set(item.productName, currentQty + item.quantity);
      }
    }

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

/**
 * Fetches all sales data from the LocalBasket store for a CSV dump.
 * @returns A promise that resolves with an array of all sale items or an error.
 */
export async function getSalesDataDump(): Promise<{ success: boolean; data?: any[]; error?: string }> {
  try {
    const { db } = await getAdminServices();

    const masterStoreQuery = query(collection(db, 'stores'), where('name', '==', 'LocalBasket'));
    const masterStoreSnap = await getDocs(masterStoreQuery);
    if (masterStoreSnap.empty) throw new Error("Master 'LocalBasket' store not found.");
    const masterStoreId = masterStoreSnap.docs[0].id;

    const ordersQuery = query(collection(db, 'orders'), where('storeId', '==', masterStoreId));
    const orderSnapshot = await getDocs(ordersQuery);
    const orders = orderSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
    
    const salesData: any[] = [];

    for (const order of orders) {
      const itemsQuery = collection(db, 'orders', order.id, 'orderItems');
      const itemsSnapshot = await getDocs(itemsQuery);
      const items = itemsSnapshot.docs.map(doc => doc.data() as OrderItem);

      for (const item of items) {
        salesData.push({
          orderId: order.id,
          orderDate: order.orderDate instanceof Timestamp ? order.orderDate.toDate().toISOString() : order.orderDate,
          orderStatus: order.status,
          customerName: order.customerName,
          customerEmail: order.email,
          deliveryAddress: order.deliveryAddress,
          productName: item.productName,
          productVariant: item.variantWeight,
          productSku: item.variantSku,
          quantity: item.quantity,
          price: item.price,
          itemTotal: item.price * item.quantity,
        });
      }
    }
    
    return { success: true, data: salesData };

  } catch (error: any) {
    console.error("Sales data download failed:", error);
    return { success: false, error: error.message || 'An unknown server error occurred.' };
  }
}

export async function approveRule(sentenceId: string, rawText: string): Promise<{ success: boolean, error?: string }> {
    // This is a placeholder. In a real application, you would:
    // 1. Mark the sentence as 'approved' in Firestore.
    // 2. Append the new rule to a `learned-rules.json` file in your source.
    console.log(`Approving rule for sentence ID: ${sentenceId}`);
    try {
        const { db } = await getAdminServices();
        const sentenceRef = doc(db, 'nlu_extracted_sentences', sentenceId);
        await updateDoc(sentenceRef, { status: 'approved' });
        
        // In a real app, you'd append to a file, but for this demo, we'll just log it.
        console.log(`ACTION: Append the following to learned-rules.json:`);
        console.log(JSON.stringify({ rawText: rawText, note: 'Learned from NLU dashboard' }));
        
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function rejectRule(sentenceId: string): Promise<{ success: boolean, error?: string }> {
    try {
        const { db } = await getAdminServices();
        const sentenceRef = doc(db, 'nlu_extracted_sentences', sentenceId);
        await updateDoc(sentenceRef, { status: 'rejected' });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}


export async function processPdfAndExtractRules(formData: FormData): Promise<{ success: boolean; sentenceCount?: number; error?: string }> {
    const file = formData.get('pdf') as File;
    if (!file) {
        return { success: false, error: 'No PDF file provided.' };
    }

    // In a real app, this is where you would send the PDF to a backend service
    // that uses a library like 'pdf-parse' to extract text, then runs your NLU engine
    // on sentences, and saves the results to Firestore.
    
    // For this demo, we will simulate this process.
    console.log(`Simulating processing for PDF: ${file.name}`);
    
    try {
        const { db } = await getAdminServices();
        const batch = db.batch();
        const sentencesRef = collection(db, 'nlu_extracted_sentences');

        // SIMULATED EXTRACTED SENTENCES
        const demoSentences = [
            "add 1kg of potatoes",
            "I need one and a half litres of milk",
            "get 250gm ginger",
            "buy 5 packs of biscuits",
            "order 2 dozen eggs",
            "three kilos of onions please",
        ];

        let sentenceCount = 0;
        for (const text of demoSentences) {
            const newDocRef = doc(sentencesRef);
            // In a real implementation, you'd run your NLU engine here
            // const nluResult = runNLU(text); 
            
            batch.set(newDocRef, {
                id: newDocRef.id,
                rawText: text,
                extractedNumbers: [], // Placeholder for actual NLU result
                confidence: Math.random(), // Simulated confidence
                status: 'pending',
                createdAt: serverTimestamp(),
            });
            sentenceCount++;
        }

        await batch.commit();

        return { success: true, sentenceCount };

    } catch (error: any) {
        console.error("PDF processing simulation failed:", error);
        return { success: false, error: error.message };
    }
}

export async function getSiteConfig(configId: string): Promise<SiteConfig | null> {
    try {
        const { db } = await getAdminServices();
        const docRef = doc(db, 'siteConfig', configId);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return docSnap.data() as SiteConfig;
        }
        return null;
    } catch (error) {
        console.error("Error fetching site config:", error);
        return null;
    }
}

export async function updateSiteConfig(configId: string, data: Partial<SiteConfig>): Promise<{ success: boolean; error?: string }> {
    try {
        const { db } = await getAdminServices();
        const docRef = doc(db, 'siteConfig', configId);
        await setDoc(docRef, data, { merge: true });
        return { success: true };
    } catch (error: any) {
        console.error("Error updating site config:", error);
        return { success: false, error: error.message };
    }
}
