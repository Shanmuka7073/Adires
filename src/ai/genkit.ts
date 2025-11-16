/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 * This ensures that Genkit is configured in a single, consistent place.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { firebase } from '@genkit-ai/firebase';

// Initialize Genkit with the Firebase and Google AI plugins.
// The firebase() plugin allows Genkit to use the application's default
// authentication credentials, which is what the "Grant Access" dialog provides.
export const ai = genkit({
  plugins: [
    firebase(),
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
