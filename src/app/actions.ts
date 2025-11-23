
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { getStorage } from 'firebase-admin/storage';
import { updateDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { promises as fs } from 'fs';
import path from 'path';

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

/**
 * Fetches a summary from Wikipedia's public API.
 * @param topic The topic to search for.
 * @returns A promise that resolves to the summary text or an error message.
 */
export async function getWikipediaSummary(topic: string): Promise<{ summary?: string; error?: string }> {
  const endpoint = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(topic)}`;
  
  try {
    const response = await fetch(endpoint, {
      headers: {
        'Accept': 'application/json; charset=utf-8',
        // Wikipedia's API usage policy requests a user agent.
        'User-Agent': 'LocalBasketApp/1.0 (https://localbasket.com; admin@localbasket.com)'
      }
    });

    if (!response.ok) {
      throw new Error(`Wikipedia API returned status ${response.status}`);
    }

    const data = await response.json();
    
    // Check for different types of responses from Wikipedia
    if (data.type === 'disambiguation') {
      return { error: `The term "${topic}" is ambiguous. Please be more specific.` };
    }
    
    if (!data.extract) {
      return { error: `I couldn't find any information on "${topic}".` };
    }

    return { summary: data.extract };

  } catch (error: any) {
    console.error("Wikipedia API fetch error:", error);
    return { error: error.message || `Failed to fetch information for "${topic}".` };
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
