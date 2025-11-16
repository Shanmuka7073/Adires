'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { headers } from 'next/headers';

async function getFirestoreCounts() {
    const { db } = await getAdminServices();
    const usersSnapshot = await db.collection('users').get();
    const storesSnapshot = await db.collection('stores').get();
    const partnersSnapshot = await db.collection('deliveryPartners').get();
    const commandsSnapshot = await db.collection('voiceCommands').get();
    return {
        users: usersSnapshot.size,
        stores: storesSnapshot.size,
        deliveryPartners: partnersSnapshot.size,
        voiceCommands: commandsSnapshot.size,
    };
}

export async function getSystemStatus() {
    try {
        const counts = await getFirestoreCounts();
        // LLM status is no longer checked as AI features are removed.
        return {
            status: 'ok',
            llmStatus: 'Offline', // Default to Offline since AI is removed.
            serverDbStatus: 'Online',
            counts: counts,
        };
    } catch (error) {
        console.error("System status check failed:", error);
        return {
            status: 'error',
            llmStatus: 'Offline',
            serverDbStatus: 'Offline',
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
