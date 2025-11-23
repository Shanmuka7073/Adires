
/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 * This ensures that Genkit is configured in a single, consistent place.
 */
import 'dotenv/config'; // Import and configure dotenv at the very top.
import { genkit } from 'genkit';
import { openai } from 'genkit/openai';
import { googleAI } from '@genkit-ai/google-genai';

// The plugins will now automatically pick up the API keys
// from the process.env environment variables.
export const ai = genkit({
  plugins: [
    googleAI(),
    openai({
      apiKey: process.env.OPENAI_API_KEY,
    }),
  ],
});
