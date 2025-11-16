/**
 * Genkit v1.x configuration file
 */

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { enableFirebaseTelemetry } from '@genkit-ai/firebase';

// IMPORT FLOWS (required for registration)
import '@/ai/flows/general-question-flow';
import '@/ai/flows/recipe-ingredients-flow';
import '@/ai/flows/generate-pack-flow';
import '@/ai/flows/suggest-alias-flow';
import '@/ai/flows/atlas-debug-flow';

const GEMINI_API_KEY = "AIzaSyDlTc56bOOF_k_N53lRdnR7KU21e5E45Y";

export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GEMINI_API_KEY,
    }),
    // Just enable telemetry — no “firebase()” plugin call
    enableFirebaseTelemetry(),
  ],
});
