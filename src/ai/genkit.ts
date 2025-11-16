/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 * This ensures that Genkit is configured in a single, consistent place.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import 'dotenv/config'; // Make sure to install dotenv: npm install dotenv

// IMPORTANT: Declare the global API key variable which is required for Genkit to initialize correctly.
// This is typically read from the environment variables (process.env.GEMINI_API_KEY).
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

// Initialize Genkit with the Google AI plugin.
// This `ai` object is now the central point for all Genkit-related definitions.
export const ai = genkit({
  plugins: [
    googleAI({
      apiKey: GEMINI_API_KEY,
    }),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
