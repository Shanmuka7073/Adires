
'use server';

import { revalidatePath } from 'next/cache';
import { getIngredientsForRecipe as getIngredientsFlow } from '@/ai/flows/recipe-ingredients-flow';
import { answerGeneralQuestion as answerGeneralQuestionFlow } from '@/ai/flows/general-question-flow';
import { generatePack as generatePackFlow } from '@/ai/flows/generate-pack-flow';
import { suggestAliasTarget as suggestAliasTargetFlow } from '@/ai/flows/suggest-alias-flow';
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

export async function getSystemStatus() {
    try {
        const { db, auth } = await getAdminServices();

        // 1. Check DB connection by trying to get a non-existent document
        const testDoc = await getDoc(doc(db, 'system-test/health-check'));
        
        // 2. Check Auth connection by listing a single user
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
