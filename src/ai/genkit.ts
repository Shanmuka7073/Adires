/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 * This ensures that Genkit is configured in a single, consistent place.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// Initialize Genkit with the Google AI plugin.
// The plugin will automatically look for the GEMINI_API_KEY in the environment.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
