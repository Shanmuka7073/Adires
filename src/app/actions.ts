
'use server';

import { revalidatePath } from 'next/cache';
import { getIngredientsForRecipe as getIngredientsFlow } from '@/ai/flows/recipe-ingredients-flow';
import { answerGeneralQuestion as answerGeneralQuestionFlow } from '@/ai/flows/general-question-flow';
import { generatePack as generatePackFlow } from '@/ai/flows/generate-pack-flow';
import { suggestAliasTarget as suggestAliasTargetFlow } from '@/ai/flows/suggest-alias-flow';
import { runAshaFlow } from '@/ai/flows/asha-agent-flow';
import { getAdminServices } from '@/firebase/admin-init';
import { getDocs, addDoc, serverTimestamp, collection, query, where, getDoc, doc } from 'firebase-admin/firestore';
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
    SiteConfig,
    VoiceAlias,
    ChatMessage
} from '@/lib/types';


const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000; // Start with 1 second
const ADMIN_EMAIL = 'admin@gmail.com';
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetries<T, U>(flowFunction: (input: T) => Promise<U>, input: T): Promise<U> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await flowFunction(input);
    } catch (error: any) {
      if (error.status === 429 || error.code === 429 || error.statusCode === 429) { // Check for rate limiting error
        const backoffTime = INITIAL_BACKOFF_MS * Math.pow(2, attempt) + Math.random() * 1000;
        console.warn(`Rate limited. Retrying in ${backoffTime}ms... (Attempt ${attempt + 1}/${MAX_RETRIES})`);
        await delay(backoffTime);
      } else {
        console.error(`Flow failed after ${attempt + 1} attempts:`, error);
        throw error;
      }
    }
  }
  throw new Error(`Flow failed after ${MAX_RETRIES} retries.`);
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
    return withRetries(suggestAliasTargetFlow, input);
}

export async function askAsha(uid: string, userMessage: string, history: ChatMessage[]): Promise<string> {
    if (!uid) {
        throw new Error("Authentication failed: No user ID provided by client.");
    }
    
    try {
        const { auth } = await getAdminServices();
        const userRecord = await auth.getUser(uid);
        if (userRecord.email !== ADMIN_EMAIL) {
            console.warn(`Unauthorized access attempt to Asha Agent by user: ${userRecord.email}`);
            throw new Error("You do not have permission to use this feature.");
        }
    } catch (error) {
        console.error("Admin check failed:", error);
        throw new Error("Could not verify admin status.");
    }

    try {
        const responseText = await runAshaFlow(uid, userMessage, history); 
        return responseText;
    } catch (flowError) {
        console.error("Genkit Flow Execution Failed:", flowError);
        throw new Error("AI flow failed to process request.");
    }
}

export async function getSystemStatus() {
    try {
        const { db, auth } = await getAdminServices();

        const testDoc = await getDoc(doc(db, 'system-test/health-check'));
        
        const userRecords = await auth.listUsers(1);

        const usersQuery = await getDocs(collection(db, 'users'));
        const storesQuery = await getDocs(collection(db, 'stores'));

        return {
            status: 'ok',
            message: 'All systems operational',
            counts: {
                users: usersQuery.size,
                stores: storesQuery.size,
            },
        };

    } catch (error) {
        console.error("System status check failed:", error);
        return {
            status: 'error',
            message: (error as Error).message || 'An unknown error occurred',
        };
    }
}
