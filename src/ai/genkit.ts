
/**
 * Genkit v1.x configuration file
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';
import { defineGeneralQuestionFlow } from '@/ai/flows/general-question-flow';
import { defineRecipeIngredientsFlow } from '@/ai/flows/recipe-ingredients-flow';
import { defineGeneratePackFlow } from '@/ai/flows/generate-pack-flow';
import { defineSuggestAliasTargetFlow } from '@/ai/flows/suggest-alias-flow';
import { runAtlasDebugFlow } from '@/ai/flows/atlas-debug-flow';

const GEMINI_API_KEY = "AIzaSyDlTc56bOOF_k_N53lRdnR7KU21e5E45Y";

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GEMINI_API_KEY,
    }),
    enableFirebaseTelemetry(),
  ],
});

// Initialize flows by passing the 'ai' object
defineGeneralQuestionFlow(ai);
defineRecipeIngredientsFlow(ai);
defineGeneratePackFlow(ai);
defineSuggestAliasTargetFlow(ai);
runAtlasDebugFlow(ai);
