'use server';
/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 * This ensures that Genkit is configured in a single, consistent place.
 */
import 'dotenv/config'; // Import and configure dotenv at the very top.
import { genkit } from 'genkit/index';
import { googleAI } from '@genkit-ai/google-genai';
// FIX: Using * as firebasePlugin to force correct module loading and resolve bundling issues.
import * as firebasePlugin from '@genkit-ai/firebase';

// The googleAI() plugin will now automatically pick up the API key
// from the process.env.GEMINI_API_KEY environment variable.
// This is automatically handled by the Firebase App Hosting environment.

// Initialize Genkit with the Google AI plugin.
// This `ai` object is now the central point for all Genkit-related definitions.
export const ai = genkit({
  plugins: [
    googleAI(),
    // FIX: Accessing the function via the imported object's 'firebase' property.
    (firebasePlugin as any).firebase(),
  ],
});
