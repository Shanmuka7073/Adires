
'use server';

import { runAtlasDebugFlow } from '@/ai/flows/atlas-debug-flow';
import { getAdminServices } from '@/firebase/admin-init';
import { generatePack, type GeneratePackInput, type GeneratePackOutput } from '@/ai/flows/generate-pack-flow';
import { getIngredientsForRecipe, type RecipeIngredientsInput, type RecipeIngredientsOutput } from '@/ai/flows/recipe-ingredients-flow';
import { answerGeneralQuestion, type GeneralQuestionInput, type GeneralQuestionOutput } from '@/ai/flows/general-question-flow';
import { suggestAliasTarget, type AliasTargetSuggestionInput, type AliasTargetSuggestionOutput } from '@/ai/flows/suggest-alias-flow';
import { listSupportedModels } from '@/ai/flows/list-models-flow';

type DebugReport = {
    report: string;
    fixInstructions: string;
};

/**
 * Atlas Debug Action: Analyzes a system error and generates a report.
 * @param {string} userQuery - The user's query (or error details).
 * @param {string} failedFunction - Context for the AI.
 * @param {string} idToken - The user's Firebase ID token for verification.
 * @returns {Promise<DebugReport>} A structured report and fix instructions from Atlas.
 */
export async function debugAtlasAction(userQuery: string, failedFunction: string, idToken: string): Promise<DebugReport> {

    if (!idToken) {
        return {
            report: "Authentication Failed.",
            fixInstructions: "No Firebase ID token was provided in the request. The client must include a valid 'Authorization: Bearer <token>' header."
        };
    }
    
    try {
        const { auth } = await getAdminServices();
        const decodedToken = await auth.verifyIdToken(idToken);
        
        // The user is authenticated. Now, run the Genkit flow.
        const report = await runAtlasDebugFlow({ errorDetails: userQuery, failedFunction: failedFunction });
        return report;

    } catch (error: any) {
        console.error("ATLAS Flow Execution or Auth FAILED:", error);
        
        if (error.code === 'auth/id-token-expired' || error.code === 'auth/argument-error') {
             return {
                report: "Firebase ID Token Invalid or Expired.",
                fixInstructions: `The provided ID token could not be verified. This can happen if the token is old or malformed.\n\nError: ${error.message}`
            };
        }

        // Fallback for Genkit or other errors
        return {
            report: "Atlas execution failed.",
            fixInstructions: `CRITICAL: The Genkit flow failed to execute. This is typically caused by:
1. Invalid or expired GEMINI_API_KEY in your Genkit config.
2. A firewall preventing the server from connecting to Google's API.
3. A fundamental issue with the Genkit import/export in 'src/app/actions.ts'.
Error details: ${error.message}`
        };
    }
}

// Re-exporting AI flows to be used as Server Actions
export { 
    generatePack, 
    getIngredientsForRecipe, 
    answerGeneralQuestion, 
    suggestAliasTarget,
    listSupportedModels
};
export type { 
    GeneratePackInput, 
    GeneratePackOutput,
    RecipeIngredientsInput,
    RecipeIngredientsOutput,
    GeneralQuestionInput,
    GeneralQuestionOutput,
    AliasTargetSuggestionInput,
    AliasTargetSuggestionOutput,
};

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
