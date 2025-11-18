
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
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
            errorMessage: (error as Error).message,
            counts: { users: 0, stores: 0, deliveryPartners: 0, voiceCommands: 0 },
        };
    }
}

export async function logLoginAttempt(email: string, status: 'success' | 'failure', userId?: string, errorMessage?: string) {
    try {
        const { db } = await getAdminServices();
        const headersList = headers();
        
        const ipAddress = headersList.get('x-forwarded-for') || 'unknown';
        const userAgent = headersList.get('user-agent') || 'unknown';
        
        let location = 'Unknown';
        try {
            // This header is set by Google Cloud Load Balancer
            const city = headersList.get('x-cloud-trace-context'); 
             if (city) {
                location = city;
            }
        } catch {}


        await addDoc(collection(db, 'loginHistory'), {
            userId: userId || null,
            email,
            status,
            timestamp: serverTimestamp(),
            ipAddress,
            userAgent,
            errorMessage: errorMessage || null,
            location
        });

    } catch (error) {
        console.error("Failed to log login attempt:", error);
        // We don't want to throw an error here and fail the login process itself.
    }
}
