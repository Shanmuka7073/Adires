
/**
 * @fileOverview Genkit configuration file.
 * This file sets up the core Genkit environment, loads plugins, and initializes flows.
 * This structure is mandatory for Genkit to work correctly within a Next.js environment.
 */
import { defineGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
// CRITICAL FIX: Use a wildcard import to robustly handle module resolution in Next.js.
import * as firebaseModule from '@genkit-ai/firebase'; 

// Dynamically import all flows to be registered
import { answerGeneralQuestion } from '@/ai/flows/general-question-flow';
import { getIngredientsForRecipe } from '@/ai/flows/recipe-ingredients-flow';
import { generatePack } from '@/ai/flows/generate-pack-flow';
import { suggestAliasTarget } from '@/ai/flows/suggest-alias-flow';
import { runAtlasDebugFlow } from '@/ai/flows/atlas-debug-flow';

// Extract the callable firebase function from the module object to handle Webpack quirks.
const firebasePluginFunction = firebaseModule.default || firebaseModule.firebase;

// IMPORTANT: Using the API Key provided by the user directly.
const GEMINI_API_KEY = "AIzaSyDlTc56bOOF_k_N53lRdnR7KU21e5E45Y";

// Define the core Genkit configuration using modern imports (defineGenkit/googleGenai)
const ai = defineGenkit({
  // 1. Plugins: Load required Genkit plugins
  plugins: [
    // Configure the Google Gen AI plugin
    googleAI({ 
      apiKey: GEMINI_API_KEY, 
      // Set the default model for stability.
      defaultModel: 'gemini-2.5-flash',
    }), 
    
    // Initialize the Firebase plugin using the extracted, resolved function
    firebasePluginFunction(),
  ],
  
  // 2. Logging: Set log level and enable tracing
  logLevel: 'debug',
  enableTracingAndMetrics: true,
  
  // 3. The flows block is mandatory for registering all your AI agents.
  flows: [
      answerGeneralQuestion,
      getIngredientsForRecipe,
      generatePack,
      suggestAliasTarget,
      runAtlasDebugFlow,
  ],
});

// Export the initialized Genkit instance for use in Server Actions
export { ai };
