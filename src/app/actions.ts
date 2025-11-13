
'use server';

import { revalidatePath } from 'next/cache';
import { getIngredientsForRecipe as getIngredientsFlow } from '@/ai/flows/recipe-ingredients-flow';
import { answerGeneralQuestion as answerGeneralQuestionFlow } from '@/ai/flows/general-question-flow';
import { generatePack as generatePackFlow } from '@/ai/flows/generate-pack-flow';
import { suggestAliasTarget as suggestAliasTargetFlow } from '@/ai/flows/suggest-alias-flow';

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

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

// Self-contained admin initialization for authentication
function getAdminAuth() {
    const apps = getApps();
    const adminApp = apps.find(app => app?.name === 'firebase-admin-app-auth');
    if (adminApp) {
        return getAuth(adminApp);
    }
    
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
        console.error('Required Firebase Admin environment variables for auth are not set.');
        return null;
    }
    
    try {
        const newAdminApp = initializeApp({
            credential: cert({
                projectId,
                clientEmail,
                privateKey: privateKey.replace(/\\n/g, '\n'),
            }),
        }, 'firebase-admin-app-auth');
        return getAuth(newAdminApp);
    } catch(e: any) {
        console.error("Failed to initialize admin auth in actions.ts:", e.message);
        return null;
    }
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

// The client is now responsible for checking if the feature is enabled.
export async function getIngredientsForRecipe(input: RecipeIngredientsInput): Promise<RecipeIngredientsOutput> {
    return withRetries(getIngredientsFlow, input);
}

// The client is now responsible for checking if the feature is enabled.
export async function answerGeneralQuestion(input: GeneralQuestionInput): Promise<GeneralQuestionOutput> {
    return withRetries(answerGeneralQuestionFlow, input);
}

// The client is now responsible for checking if the feature is enabled.
export async function generatePack(input: GeneratePackInput): Promise<GeneratePackOutput> {
    return withRetries(generatePackFlow, input);
}

// The client is now responsible for checking if the feature is enabled.
export async function suggestAliasTarget(input: AliasTargetSuggestionInput): Promise<AliasTargetSuggestionOutput> {
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

export async function getSystemStatus(): Promise<{ status: 'ok' | 'error'; message: string }> {
    const auth = getAdminAuth();
    if (!auth) {
        return { status: 'error', message: 'Could not initialize Firebase Admin for authentication.' };
    }
    
    try {
        const userRecords = await auth.listUsers();
        const userCount = userRecords.users.length;
        return {
            status: 'ok',
            message: `Server is responsive. User count: ${userCount}`,
        };
    } catch (error) {
        console.error("System Status Check Failed:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';
        return {
            status: 'error',
            message: `Could not connect to backend services: ${errorMessage}`,
        };
    }
}
