/**
 * Genkit v1.x configuration file
 */

import { genkit, type Genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// The API key is now set as an environment variable in the deployment environment.
// The googleAI() plugin will automatically pick it up from process.env.GEMINI_API_KEY.
const GEMINI_API_KEY = "AIzaSyDlTc56bOOF_k_N53lRdnR7KU21e5E45Y";

// Set the API key as an environment variable for the current process
process.env.GEMINI_API_KEY = GEMINI_API_KEY;

export const ai: Genkit = genkit({
  plugins: [
    googleAI(), // Initialize without explicit apiKey parameter
  ],
});
