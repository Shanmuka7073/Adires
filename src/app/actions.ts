
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { suggestAliasTarget as suggestAliasTargetFlow } from '@/ai/flows/alias-suggester-flow';
import { z } from 'zod';

// Re-export the AI flow for client-side usage as a server action
export const suggestAliasTarget = suggestAliasTargetFlow;

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
        let llmStatus: 'Online' | 'Offline' = 'Offline';
        
        if (process.env.GEMINI_API_KEY) {
            llmStatus = 'Online';
        }

        return {
            status: 'ok',
            llmStatus,
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
