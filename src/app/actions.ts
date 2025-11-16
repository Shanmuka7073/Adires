
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { suggestAliasTarget } from '@/ai/flows/alias-suggester-flow';

// Re-export the AI flow to be used as a Server Action in the admin panel.
export { suggestAliasTarget };


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
        // Check AI status by sending a very simple, low-cost request.
        let llmStatus: 'Online' | 'Offline' = 'Offline';
        try {
            await suggestAliasTarget({ 
                commandText: 'test', 
                language: 'en', 
                validCommands: ['test'], 
                validProducts: ['test'], 
                validStores: ['test'] 
            });
            llmStatus = 'Online';
        } catch (e) {
            console.error("LLM Health Check Failed:", e);
            llmStatus = 'Offline';
        }

        return {
            status: 'ok',
            llmStatus: llmStatus,
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
