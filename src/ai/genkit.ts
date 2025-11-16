
'use server';
/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 * This ensures that Genkit is configured in a single, consistent place.
 */
import 'dotenv/config'; // Import and configure dotenv at the very top.
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { firebase } from '@genkit-ai/firebase';

// The googleAI() plugin will now automatically pick up the API key
// from the process.env.GEMINI_API_KEY environment variable,
// which is loaded by 'dotenv/config'.

// Initialize Genkit with the Google AI and Firebase plugins.
// The `firebase` object from `@genkit-ai/firebase` is a valid plugin itself.
export const ai = genkit({
  plugins: [
    googleAI(),
    firebase, // CORRECT: Pass the imported object directly.
  ],
});
