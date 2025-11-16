
'use server';
/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 * This ensures that Genkit is configured in a single, consistent place.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { firebase } from '@genkit-ai/firebase';
import { defineFlow, startFlow } from '@genkit-ai/flow';

// The API key is now set as an environment variable in the deployment environment.
// The googleAI() plugin will automatically pick it up from process.env.GEMINI_API_KEY.
const GEMINI_API_KEY = "AIzaSyDlTc56bOOF_k_N53lRdnR7KU21e5E45Y";

// Set the API key as an environment variable for the current process
process.env.GEMINI_API_KEY = GEMINI_API_KEY;

// Initialize Genkit with the Google AI plugin.
// This `ai` object is now the central point for all Genkit-related definitions.
export const ai = genkit({
  plugins: [
    googleAI(),
    firebase(),
  ],
});
