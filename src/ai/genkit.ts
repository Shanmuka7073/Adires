
/**
 * Genkit v1.x configuration file
 */

import { genkit, type Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { defineRecipeIngredientsFlow } from '@/ai/flows/recipe-ingredients-flow';

const GEMINI_API_KEY = "AIzaSyDlTc56bOOF_k_N53lRdnR7KU21e5E45Y";

export const ai: Genkit = genkit({
  plugins: [
    googleAI({
      apiKey: GEMINI_API_KEY,
    }),
  ],
});

// Enable Firebase telemetry by calling this function separately.
enableFirebaseTelemetry();

// Initialize flows by passing the 'ai' object
defineRecipeIngredientsFlow(ai);
