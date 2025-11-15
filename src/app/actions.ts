
'use server';

import { revalidatePath } from 'next/cache';
import { getIngredientsForRecipe as getIngredientsFlow } from '@/ai/flows/recipe-ingredients-flow';
import { answerGeneralQuestion as answerGeneralQuestionFlow } from '@/ai/flows/general-question-flow';
import { generatePack as generatePackFlow } from '@/ai/flows/generate-pack-flow';
import { suggestAliasTarget as suggestAliasTargetFlow } from '@/ai/flows/suggest-alias-flow';

import { getAdminServices } from '@/firebase/admin-init';
import { getDocs, addDoc, serverTimestamp } from 'firebase-admin/firestore';

import { ai } from '@/ai/genkit';
import { z } from 'zod';


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

export async function getSystemStatus(): Promise<{ status: 'ok' | 'error'; message: string; counts: { users: number | 'N/A'; stores: number | 'N/A' } }> {
    try {
        const { auth, db } = await getAdminServices();
        if (!auth || !db) {
            return { status: 'error', message: 'Could not initialize Firebase Admin SDK.', counts: { users: 'N/A', stores: 'N/A' } };
        }
        
        let userCount: number | 'N/A' = 'N/A';
        let storeCount: number | 'N/A' = 'N/A';

        try {
            // Using listUsers() from Auth is more efficient for just getting a count
            const listUsersResult = await auth.listUsers(1000); // Check first 1000
            userCount = listUsersResult.users.length; 
            // Note: For apps with >1000 users, you'd need to handle pagination.
            // This is sufficient for this app's current scale.
        } catch (e) {
            console.error('Failed to get user count:', e);
        }
        
        try {
            const storesSnapshot = await getDocs(db.collection('stores'));
            storeCount = storesSnapshot.size;
        } catch (e) {
            console.error('Failed to get store count:', e);
        }

        return {
            status: 'ok',
            message: 'Server-side services are responsive.',
            counts: {
                users: userCount,
                stores: storeCount
            }
        };

    } catch (e) {
        const error = e as Error;
        console.error('Critical failure in getSystemStatus:', error);
        return { 
            status: 'error', 
            message: error.message, 
            counts: { users: 'N/A', stores: 'N/A' } 
        };
    }
}

const AskAshaInputSchema = z.object({
  userMessage: z.string(),
  chatHistory: z.array(z.object({
    role: z.string(),
    text: z.string(),
  })),
});

const askAshaFlow = ai.defineFlow(
  {
    name: 'askAshaFlow',
    inputSchema: AskAshaInputSchema,
    outputSchema: z.string(),
    system: `
        You are 'Asha,' a friendly, knowledgeable, and proactive personal shopping assistant for a grocery app in India. 
        Your primary goal is to understand and respond naturally to multilingual Indian users.
        
        CRITICAL MANDATES:
        1. Multilingual & Slang: Seamlessly understand and process input in English, Hindi, Telugu, Roman Telugu (e.g., 'ullipayalu'), mixed language (e.g., 'add milk and konni onions'), and misspellings.
        2. Persona: Your tone is warm, conversational, and culturally appropriate for Kurnool, Andhra Pradesh.
        3. Context: You remember the last 5 messages.
        4. Action Handling: When the user issues a clear action (like 'add'), confirm the action conversationally (e.g., 'Done! Adding that right away.') and maintain the dialogue. Your focus is dialogue and context management, not just list management.
        
        Keep your responses concise, helpful, and focused on assisting with their shopping needs.
    `,
  },
  async ({ userMessage, chatHistory }) => {
    
    const history = chatHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.text }],
    }));
    history.push({ role: 'user', parts: [{ text: userMessage }] });

    const llm = ai.getModel('googleai/gemini-2.5-flash-preview');

    const result = await llm.generate({
      history,
    });
    
    return result.text();
  }
);


export async function askAsha(userMessage: string, chatHistory: { role: string; text: string }[]): Promise<void> {
    const { db, auth } = await getAdminServices();

    // The genkit middleware will add the user's uid to the metadata.
    const flowResult = await askAshaFlow({ userMessage, chatHistory });
    const uid = (askAshaFlow as any).getFlowState().metadata.uid;
    
    if (!uid) {
        throw new Error("User is not authenticated. Cannot save AI response.");
    }
    
    const conversationRef = db.collection(`/users/${uid}/ashaConversation`);
    await addDoc(conversationRef, {
        text: flowResult,
        role: 'model',
        timestamp: serverTimestamp()
    });
}
