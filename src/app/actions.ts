
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject } from 'firebase-admin/storage';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';
import { promises as fs } from 'fs';
import path from 'path';
import type { Order, OrderItem, Product, ProductPrice, ProductVariant, SiteConfig, CartItem, NluExtractedSentence, MenuItem } from '@/lib/types';
import { headers } from 'next/headers';
import { getApp, getApps } from 'firebase-admin/app';
import * as pdfjs from 'pdfjs-dist';

/**
 * NEW: Server action to securely provide the client-side Firebase config.
 * This ensures client and server are always in sync.
 */
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

/**
 * Server action to upload a base64 data URI to Firebase Storage.
 * This is more secure as it doesn't expose storage rules to the client.
 */
export async function uploadStoreImage(storeId: string, dataUri: string): Promise<{ success: boolean; imageUrl?: string; error?: string }> {
  try {
    const { db } = await getAdminServices();
    const { bucket } = getStorage().app.options;

    if (!bucket) {
      throw new Error("Firebase Storage bucket name not configured on the server.");
    }

    // Split the data URI to get the mime type and the base64 data
    const matches = dataUri.match(/^data:(.+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return { success: false, error: 'Invalid data URI format.' };
    }
    
    const mimeType = matches[1];
    const base64Data = matches[2];

    const buffer = Buffer.from(base64Data, 'base64');
    const filePath = `store-images/${storeId}/${Date.now()}.jpg`; // Use JPG for simplicity
    const fileRef = storageRef(getStorage(), filePath);
    
    await uploadString(fileRef, dataUri, 'data_url');
    const downloadURL = await getDownloadURL(fileRef);

    // Update the store document in Firestore with the new image URL
    const storeDocRef = db.collection('stores').doc(storeId);
    await storeDocRef.update({ imageUrl: downloadURL });

    return { success: true, imageUrl: downloadURL };

  } catch (error: any) {
    console.error('Server-side image upload failed:', error);
    return { success: false, error: error.message || 'An unknown error occurred during upload.' };
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
      productId: `${storeId}-${item.name.replace(/\s+/g, '-')}`,
      productName: item.name,
      variantSku: 'default',
      variantWeight: '1 pc',
      quantity,
      price: item.price,
    };

    const doc = await orderRef.get();

    if (!doc.exists) {
      const newOrder: Order = {
        id: orderId,
        storeId,
        sessionId,
        tableNumber,
        userId: 'guest',
        customerName: `Table ${tableNumber || 'N/A'}`,
        deliveryAddress: "In-store dining",
        deliveryLat: 0,
        deliveryLng: 0,
        phone: 'N/A',
        email: 'N/A',
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
        updatedAt: Timestamp.now(),
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

// A simplified function to extract sentences from a PDF buffer.
async function extractSentencesFromPdf(pdfBuffer: Buffer): Promise<string[]> {
    const data = new Uint8Array(pdfBuffer);
    const pdf = await pdfjs.getDocument(data).promise;
    const sentences: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => ('str' in item ? item.str : '')).join(' ');
        // Simple sentence splitting by period, question mark, or exclamation mark.
        const pageSentences = pageText.match(/[^.!?]+[.!?]+/g) || [];
        sentences.push(...pageSentences.map(s => s.trim()));
    }
    return sentences;
}

export async function processPdfAndExtractRules(formData: FormData): Promise<{ success: boolean, sentenceCount?: number, error?: string }> {
    const { db } = await getAdminServices();
    const pdfFile = formData.get('pdf') as File;

    if (!pdfFile) {
        return { success: false, error: 'No PDF file provided.' };
    }

    try {
        const pdfBuffer = Buffer.from(await pdfFile.arrayBuffer());
        const sentences = await extractSentencesFromPdf(pdfBuffer);
        
        if (sentences.length === 0) {
            return { success: false, error: 'Could not extract any text from the PDF.' };
        }

        const batch = db.batch();
        let addedCount = 0;

        for (const sentence of sentences) {
            if (sentence.length < 10 || sentence.length > 300) continue; // Skip very short/long sentences
            const docRef = db.collection('nlu_extracted_sentences').doc();
            
            // This is a placeholder for a real NLU analysis.
            const extractedNumbers = (sentence.match(/\d+/g) || []).map(num => ({ raw: num, normalizedValue: parseInt(num, 10), meaningType: 'number' }));

            const data: NluExtractedSentence = {
                id: docRef.id,
                rawText: sentence,
                extractedNumbers: extractedNumbers,
                confidence: Math.random() * 0.5 + 0.4, // Assign random confidence for demo
                status: 'pending',
                createdAt: Timestamp.now(),
            };
            batch.set(docRef, data);
            addedCount++;
        }

        await batch.commit();
        return { success: true, sentenceCount: addedCount };

    } catch (error: any) {
        console.error('PDF processing failed:', error);
        return { success: false, error: error.message || 'An unknown server error occurred.' };
    }
}


export async function approveRule(sentenceId: string, ruleText: string): Promise<{ success: boolean; error?: string }> {
    const { db } = await getAdminServices();
    try {
        // In a real app, you would parse `ruleText` and add it to a structured ruleset.
        // For this demo, we'll just update the status.
        const ruleRef = db.collection('nlu_extracted_sentences').doc(sentenceId);
        await ruleRef.update({ status: 'approved' });

        // Placeholder for appending to a learned-rules.json file
        console.log(`[Server Action] Approved rule: "${ruleText}". This would be appended to a rules file.`);

        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

export async function rejectRule(sentenceId: string): Promise<{ success: boolean; error?: string }> {
    const { db } = await getAdminServices();
    try {
        const ruleRef = db.collection('nlu_extracted_sentences').doc(sentenceId);
        await ruleRef.update({ status: 'rejected' });
        return { success: true };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
