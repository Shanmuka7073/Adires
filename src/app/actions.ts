'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { collection, serverTimestamp, addDoc } from 'firebase/firestore';
import { headers } from 'next/headers';

async function getFirestoreCounts() {
    const { db } = await getAdminServices();
    // This is an expensive operation that is not needed for a simple status check.
    // We will get the counts from the client-side where they are often already loaded.
    // For a simple health check, we just need to know the service is reachable.
    const usersSnapshot = await db.collection('users').limit(1).get();
    const storesSnapshot = await db.collection('stores').limit(1).get();
    
    // The sizes here are not the total count, but that's okay for a health check.
    // A real production app would use a more sophisticated method for counts,
    // like a counter updated with Cloud Functions, to avoid full collection scans.
    return {
        users: usersSnapshot.size >= 0 ? 'ok' : 'error',
        stores: storesSnapshot.size >= 0 ? 'ok' : 'error',
    };
}

export async function getSystemStatus() {
    try {
        await getFirestoreCounts();
        // LLM status is no longer checked as AI features are removed.
        return {
            status: 'ok',
            llmStatus: 'Offline', // Default to Offline since AI is removed.
            serverDbStatus: 'Online',
            errorMessage: null,
            // We no longer return counts from the server to save on reads.
            counts: { users: 0, stores: 0, deliveryPartners: 0, voiceCommands: 0 },
        };
    } catch (error: any) {
        console.error("System status check failed:", error);
        return {
            status: 'error',
            llmStatus: 'Offline',
            serverDbStatus: 'Unavailable',
            errorMessage: error.message || 'An unknown error occurred during server initialization.',
            counts: { users: 0, stores: 0, deliveryPartners: 0, voiceCommands: 0 },
        };
    }
}


export async function logLoginAttempt(email: string, status: 'success' | 'failure', userId?: string, errorMessage?: string) {
    try {
        const { db } = await getAdminServices();
        const headersList = headers();
        const ipAddress = headersList.get('x-forwarded-for') || 'Unknown';
        const userAgent = headersList.get('user-agent') || 'Unknown';

        const logData: any = {
            email,
            status,
            timestamp: serverTimestamp(),
            ipAddress,
            userAgent,
            userId: userId || null,
            errorMessage: errorMessage || null,
        };
        
        if (ipAddress !== 'Unknown') {
            try {
                // Vercel provides geo-location headers
                const city = headersList.get('x-vercel-ip-city');
                const country = headersList.get('x-vercel-ip-country');
                 if (city && country) {
                    logData.location = `${city}, ${country}`;
                 }
            } catch (e) {
                console.warn("Could not determine location from IP:", e);
            }
        }


        await addDoc(collection(db, 'loginHistory'), logData);

    } catch (error) {
        // We log the error but don't re-throw it, as failing to log a login attempt
        // should not prevent the user from actually logging in.
        console.error("Failed to log login attempt:", error);
    }
}
