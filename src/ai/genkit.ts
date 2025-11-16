/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import firebasePlugin from '@genkit-ai/firebase';

// Initialize Genkit with the Firebase and Google AI plugins.
export const ai = genkit({
  plugins: [
    firebasePlugin(),
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
