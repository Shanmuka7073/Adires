
/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 * This ensures that Genkit is configured in a single, consistent place.
 */
import 'dotenv/config'; // Import and configure dotenv at the very top.
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';


// Initialize Genkit with the Google AI plugin.
// This `ai` object is now the central point for all Genkit-related definitions.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  defaultModel: 'gemini-1.5-flash-latest',
  logLevel: 'debug',
});
