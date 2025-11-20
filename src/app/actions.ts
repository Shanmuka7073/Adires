'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { getStorage } from 'firebase-admin/storage';
import { updateDoc, doc } from 'firebase/firestore';

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
