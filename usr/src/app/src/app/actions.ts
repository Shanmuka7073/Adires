
'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { getIngredientsForRecipe } from '@/ai/flows/recipe-ingredients-flow';
import type {
    RecipeIngredientsInput,
    RecipeIngredientsOutput,
    GeneralQuestionInput,
    GeneralQuestionOutput,
    GeneratePackInput,
    GeneratePackOutput,
    AliasTargetSuggestionInput,
    AliasTargetSuggestionOutput,
} from '@/lib/types';


// --- Re-exporting AI flows to be used as Server Actions ---
// This now correctly re-exports the async wrapper function.
export { getIngredientsForRecipe };


// These are placeholders for other AI flows that will be created.
// Adding them here prevents future "not found" errors.
export async function getGeneralQuestionAnswer(input: GeneralQuestionInput): Promise<GeneralQuestionOutput> {
    // Placeholder implementation
    return { answer: "This feature is not yet implemented." };
}

export async function generatePack(input: GeneratePackInput): Promise<GeneratePackOutput> {
    // Placeholder implementation
    return { items: [{ name: "Generated Item", quantity: "1" }] };
}

export async function suggestAliasTarget(input: AliasTargetSuggestionInput): Promise<AliasTargetSuggestionOutput> {
    // Placeholder implementation
    return { reasoning: "AI suggester not implemented." };
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
