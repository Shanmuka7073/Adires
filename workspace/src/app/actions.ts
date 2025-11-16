
'use server';

import { getAdminServices } from '@/firebase/admin-init';

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
