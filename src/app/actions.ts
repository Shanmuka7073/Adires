
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
    AliasTargetSuggestionOutput
} from '@/ai/flows/schemas';


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
      
      // Check for the specific 503 error message
      if (errorString.includes('[503 Service Unavailable]') && attempt < MAX_RETRIES - 1) {
        
        // Calculate exponential backoff time
        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt);
        const jitter = Math.random() * 500; // Add some randomness
        const waitTime = backoffTime + jitter;

        console.warn(`Attempt ${attempt + 1} failed (503). Retrying in ${Math.round(waitTime / 1000)}s...`);
        await delay(waitTime); // Wait before the next attempt

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
    return withRetries(getIngredientsFlow, input);
}

export async function answerGeneralQuestion(input: GeneralQuestionInput): Promise<GeneralQuestionOutput> {
    return withRetries(answerGeneralQuestionFlow, input);
}

export async function generatePack(input: GeneratePackInput): Promise<GeneratePackOutput> {
    return withRetries(generatePackFlow, input);
}

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
