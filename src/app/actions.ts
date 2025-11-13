
'use server';

import { revalidatePath } from 'next/cache';
import { getIngredientsForRecipe as getIngredientsFlow } from '@/ai/flows/recipe-ingredients-flow';
import { answerGeneralQuestion as answerGeneralQuestionFlow } from '@/ai/flows/general-question-flow';
import { generatePack as generatePackFlow } from '@/ai/flows/generate-pack-flow';
import { suggestAliasTarget as suggestAliasTargetFlow } from '@/ai/flows/suggest-alias-flow';

import type { 
    RecipeIngredientsInput, 
    RecipeIngredientsOutput, 
    GeneralQuestionInput, 
    GeneralQuestionOutput,
    GeneratePackInput,
    GeneratePackOutput,
    AliasTargetSuggestionInput,
    AliasTargetSuggestionOutput,
    SiteConfig
} from '@/lib/types';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, getDoc } from 'firebase/firestore';
import { firebaseConfig } from '@/firebase/config';

// --- Server-side Firestore Admin Initialization ---

// This function is no longer needed for getAiConfig but may be used by other server actions.
function getAdminApp() {
    if (getApps().length) {
        return getApp();
    }
    return initializeApp(firebaseConfig, 'server-admin-app');
}


/**
 * Fetches the global AI feature configuration from Firestore.
 * This function is designed to run on the server and guarantees a fresh read
 * by using the client SDK in a server context, bypassing any server-side caching issues.
 * @returns The SiteConfig object with AI feature flags.
 */
export async function getAiConfig(): Promise<SiteConfig> {
    try {
        // Use client SDK for a guaranteed fresh read to bypass server caching
        const serverApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
        const db = getFirestore(serverApp);
        const configDocRef = doc(db, 'siteConfig', 'aiFeatures');
        const configDoc = await getDoc(configDocRef);

        if (configDoc.exists()) {
            return configDoc.data() as SiteConfig;
        }
    } catch (error) {
        console.error("Failed to fetch AI config:", error);
    }
    
    // Default to all features being disabled if the config doc doesn't exist or an error occurs.
    return {
        isPackGeneratorEnabled: false,
        isRecipeApiEnabled: false,
        isGeneralQuestionApiEnabled: false,
        isAliasSuggesterEnabled: false,
    };
}


// A helper function to check if a specific AI feature is enabled
async function isAiFeatureEnabled(feature: keyof SiteConfig): Promise<boolean> {
    const config = await getAiConfig();
    return config[feature] ?? false; // Default to false if not set
}


const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000; // Start with 1 second
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


async function withRetries<T, U>(flowFunction: (input: T) => Promise<U>, input: T): Promise<U> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // Attempt to run the Genkit flow
      const response = await flowFunction(input);
      // Success! Return the response immediately
      return response;
    } catch (error) {
      const errorString = error instanceof Error ? error.message : String(error);
      
      // Check for 503 OR 429 error messages
      if ((errorString.includes('[503 Service Unavailable]') || errorString.includes('[429 Too Many Requests]')) && attempt < MAX_RETRIES - 1) {
        
        // Use a longer backoff time for 429 errors
        let backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);

        // CRITICAL: If it's a 429 error, enforce a minimum 30-second wait on the first few attempts
        if (errorString.includes('[429 Too Many Requests]')) {
             backoffTime = Math.max(backoffTime, 30000); // Wait at least 30 seconds
        }

        const jitter = Math.random() * 500;
        const waitTime = backoffTime + jitter;

        console.warn(`Attempt ${attempt + 1} failed (${errorString.includes('429') ? '429 Quota' : '503'}). Retrying in ${Math.round(waitTime / 1000)}s...`);
        await delay(waitTime);

      } else {
        // Final attempt failed OR it's a non-retryable error
        console.error(`Final flow attempt failed on attempt ${attempt + 1} or received a non-retryable error:`, error);
        throw new Error('AI service failed after multiple retries. Please try again later.');
      }
    }
  }
  // This should be unreachable if MAX_RETRIES > 0, but included for type safety
  throw new Error('Failed to connect to AI service.');
}

export async function getIngredientsForRecipe(input: RecipeIngredientsInput): Promise<RecipeIngredientsOutput> {
    if (!await isAiFeatureEnabled('isRecipeApiEnabled')) {
        throw new Error('Recipe AI is currently disabled by the admin.');
    }
    return withRetries(getIngredientsFlow, input);
}

export async function answerGeneralQuestion(input: GeneralQuestionInput): Promise<GeneralQuestionOutput> {
    if (!await isAiFeatureEnabled('isGeneralQuestionApiEnabled')) {
        throw new Error('General Q&A AI is currently disabled by the admin.');
    }
    return withRetries(answerGeneralQuestionFlow, input);
}

export async function generatePack(input: GeneratePackInput): Promise<GeneratePackOutput> {
    if (!await isAiFeatureEnabled('isPackGeneratorEnabled')) {
        throw new Error('Pack Generator AI is currently disabled by the admin.');
    }
    return withRetries(generatePackFlow, input);
}

export async function suggestAliasTarget(input: AliasTargetSuggestionInput): Promise<AliasTargetSuggestionOutput> {
    if (!await isAiFeatureEnabled('isAliasSuggesterEnabled')) {
        console.warn("Alias Suggester AI is disabled by admin. Returning empty suggestion.");
        return { suggestedTargetKey: undefined };
    }
    // This flow is for suggestions, so we don't need aggressive retries. A single attempt is fine.
    return suggestAliasTargetFlow(input);
}


// This function is for demonstration and does not use Firebase.
export async function indexSiteContent() {
    try {
        console.log('This function is for demonstration and does not perform a real search index.');
        return {
            success: true,
            message: `Demonstration of site indexing complete.`,
        }

    } catch (error) {
        console.error('Error indexing site content:', error);
        return {
            success: false,
            message: 'Failed to index site content. Check server logs for details.',
        };
    }
}

// This function is a placeholder as Admin SDK is no longer used.
export async function getSystemStatus(): Promise<{ userCount: number, status: 'ok' | 'error' }> {
    try {
        // Since we removed the Admin SDK, we can't get the user count from the server.
        // We will return a placeholder value. A real implementation might call a
        // secure cloud function if this count was still needed.
        return {
            status: 'ok',
            userCount: 0, // Placeholder
        };
    } catch (error) {
        console.error("System Status Check Failed:", error);
        return {
            status: 'error',
            userCount: 0,
        };
    }
}
