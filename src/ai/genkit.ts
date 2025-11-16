
/**
 * @fileOverview Genkit configuration file.
 * This file sets up the core Genkit environment, loads plugins, and initializes flows.
 * This structure is mandatory for Genkit to work correctly within a Next.js environment.
 */
import { defineGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
// CRITICAL FIX: Use the correct default import for the Firebase plugin.
import firebase from '@genkit-ai/firebase'; 

// Dynamically import all flows to be registered
import { answerGeneralQuestion } from '@/ai/flows/general-question-flow';
import { getIngredientsForRecipe } from '@/ai/flows/recipe-ingredients-flow';
import { generatePack } from '@/ai/flows/generate-pack-flow';
import { suggestAliasTarget } from '@/ai/flows/suggest-alias-flow';
import { runAtlasDebugFlow } from '@/ai/flows/atlas-debug-flow';

// IMPORTANT: Using the API Key provided by the user directly.
const GEMINI_API_KEY = "AIzaSyDlTc56bOOF_k_N53lRdnR7KU21e5E45Y";

// Define the core Genkit configuration using modern imports
const ai = defineGenkit({
  // 1. Plugins: Load required Genkit plugins
  plugins: [
    // Configure the Google Gen AI plugin
    googleAI({ 
      apiKey: GEMINI_API_KEY, 
    }), 
    
    // Initialize the Firebase plugin
    firebase(),
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
