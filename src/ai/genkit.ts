'use server';
/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 * This ensures that Genkit is configured in a single, consistent place.
 */
import 'dotenv/config'; // Import and configure dotenv.
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

// The googleAI() plugin will now automatically pick up the API key
// from the process.env.GEMINI_API_KEY environment variable.
// This is loaded from the .env file at the root of the project.

// Initialize Genkit with the Google AI plugin.
// This `ai` object is now the central point for all Genkit-related definitions.
export const ai = genkit({
  plugins: [
    googleAI(),
  ],
});
