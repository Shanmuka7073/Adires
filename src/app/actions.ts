
'use server';

import { revalidatePath } from 'next/cache';
<<<<<<< HEAD
import { getIngredientsForRecipe as getIngredientsFlow } from '@/ai/flows/recipe-ingredients-flow';
import { answerGeneralQuestion as answerGeneralQuestionFlow } from '@/ai/flows/general-question-flow';
import { generatePack as generatePackFlow } from '@/ai/flows/generate-pack-flow';
import { suggestAliasTarget as suggestAliasTargetFlow } from '@/ai/flows/suggest-alias-flow';

import { getAdminServices } from '@/firebase/admin-init';

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
    const { auth, db } = await getAdminServices();
    if (!auth || !db) {
        return { status: 'error', message: 'Could not initialize Firebase Admin SDK.', counts: { users: 'N/A', stores: 'N/A' } };
    }
    
    let userCount: number | 'N/A' = 'N/A';
    let storeCount: number | 'N/A' = 'N/A';

    try {
        const usersCollectionRef = db.collection('users'); 
        const userSnapshot = await usersCollectionRef.count().get();
        userCount = userSnapshot.data().count;
    } catch (e) {
        console.error('Failed to get user count:', e);
    }
    
    try {
        const storesCollectionRef = db.collection('stores'); 
        const storeSnapshot = await storesCollectionRef.count().get();
        storeCount = storeSnapshot.data().count;
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
=======
import * as fs from 'fs/promises';
import * as path from 'path';
import { getStores, getMasterProducts } from '@/lib/data';
import { initServerApp } from '@/firebase/server-init';

const COMMANDS_FILE_PATH = path.join(process.cwd(), 'src', 'lib', 'commands.json');
const LOCALES_FILE_PATH = path.join(process.cwd(), 'src', 'lib', 'locales.json');

type CommandGroup = {
  display: string;
  reply: string;
  aliases: string[];
};

type LocaleEntry = string | string[];
type Locales = Record<string, Record<string, LocaleEntry>>;


export async function getCommands(): Promise<Record<string, CommandGroup>> {
    try {
        const fileContent = await fs.readFile(COMMANDS_FILE_PATH, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.log("commands.json not found, returning empty object.");
            return {};
        }
        console.error("Error reading commands file:", error);
        throw new Error("Could not load commands.");
    }
}

export async function saveCommands(commands: Record<string, CommandGroup>): Promise<{ success: boolean; }> {
    try {
        const jsonContent = JSON.stringify(commands, null, 2);
        await fs.writeFile(COMMANDS_FILE_PATH, jsonContent, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error("Error writing commands file:", error);
        throw new Error("Could not save commands to file.");
    }
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
}

export async function getLocales(): Promise<Locales> {
    try {
        const fileContent = await fs.readFile(LOCALES_FILE_PATH, 'utf-8');
        return JSON.parse(fileContent);
    } catch (error) {
         if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
            console.log("locales.json not found, returning empty object.");
            return {};
        }
        console.error("Error reading locales file:", error);
        throw new Error("Could not load locales.");
    }
}

export async function saveLocales(locales: Locales): Promise<{ success: boolean; }> {
     try {
        const jsonContent = JSON.stringify(locales, null, 2);
        await fs.writeFile(LOCALES_FILE_PATH, jsonContent, 'utf-8');
        return { success: true };
    } catch (error) {
        console.error("Error writing locales file:", error);
        throw new Error("Could not save locales to file.");
    }
}


export async function indexSiteContent() {
    try {
        const { firestore } = await initServerApp();
        console.log('Fetching stores and master products for indexing...');

        const stores = await getStores(firestore as any);
        const masterProducts = await getMasterProducts(firestore as any);

        console.log(`Found ${stores.length} stores.`);
        console.log(`Found ${masterProducts.length} master products.`);

        // In the future, this data can be saved to a new Firestore collection
        // for the voice commander to use.

        const indexedData = {
            stores: stores.map(s => ({ id: s.id, name: s.name, address: s.address })),
            products: masterProducts.map(p => ({ id: p.id, name: p.name, category: p.category })),
            indexedAt: new Date().toISOString(),
        };

        console.log('--- Indexed Data ---');
        console.log(JSON.stringify(indexedData, null, 2));
        console.log('--- End of Index ---');


        return {
            success: true,
            message: `Successfully indexed ${stores.length} stores and ${masterProducts.length} products. Check server console for output.`,
            storeCount: stores.length,
            productCount: masterProducts.length,
        }

    } catch (error) {
        console.error('Error indexing site content:', error);
        return {
            success: false,
            message: 'Failed to index site content. Check server logs for details.',
        };
    }
}

// This file can be extended with more server actions.
