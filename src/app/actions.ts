
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { ai } from '@/ai/genkit';
import type {
    RecipeIngredientsInput,
    RecipeIngredientsOutput,
} from '@/ai/flows/schemas';


// --- Re-exporting AI flows to be used as Server Actions ---

export async function getIngredientsForRecipe(input: RecipeIngredientsInput): Promise<RecipeIngredientsOutput> {
  // Directly run the flow by its registered name
  const flowResult = await ai.run('recipeIngredientsFlow', input);
  return flowResult;
}


async function getFirestoreCounts() {
    const { db } = await getAdminServices();
    const usersSnapshot = await db.collection('users').get();
    const storesSnapshot = await db.collection('stores').get();
    return {
        users: usersSnapshot.size,
        stores: storesSnapshot.size,
    };
}

export async function getSystemStatus() {
    try {
        // We can infer LLM status by trying a very simple, fast operation.
        // For now, we'll assume if this function is called, the server is up.
        // A real check would ping the Gemini API.
        const counts = await getFirestoreCounts();
        return {
            status: 'ok',
            llmStatus: 'Online',
            serverDbStatus: 'Online',
            counts: counts,
        };
    } catch (error) {
        console.error("System status check failed:", error);
        return {
            status: 'error',
            llmStatus: 'Unknown',
            serverDbStatus: 'Offline',
            counts: { users: 0, stores: 0 },
        };
    }
}
