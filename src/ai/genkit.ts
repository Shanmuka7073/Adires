
/**
 * @fileoverview This file initializes the Genkit AI instance and exports it
 * for use in other parts of the application, such as defining flows.
 * This ensures that Genkit is configured in a single, consistent place.
 */
import 'dotenv/config'; // Import and configure dotenv at the very top.
import { genkit } from 'genkit';
// Note: The openai plugin is not used for TTS anymore, but may be used for other things.
import { openAI } from 'openai';


// Initialize Genkit with the OpenAI plugin.
// This `ai` object is now the central point for all Genkit-related definitions.
export const ai = genkit({
  plugins: [
    openAI({ apiKey: process.env.OPENAI_API_KEY }),
  ],
  defaultModel: 'gpt-4-turbo',
  logLevel: 'debug',
});
