/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 */
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import * as firebaseModule from '@genkit-ai/firebase';

// This handles a Next.js/Webpack module resolution quirk with Genkit plugins.
const firebasePlugin = (firebaseModule as any).firebase || (firebaseModule as any).default;

// Initialize Genkit with the Firebase and Google AI plugins.
export const ai = genkit({
  plugins: [
    firebasePlugin(), // Correctly call the resolved plugin function
    googleAI(),
  ],
  logLevel: 'debug',
  enableTracingAndMetrics: true,
});
