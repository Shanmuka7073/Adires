/**
 * @fileOverview Genkit configuration file.
 * This file sets up the core Genkit environment, loads plugins, and initializes flows.
 * This structure is mandatory for Genkit to work correctly within a Next.js environment.
 */
import { genkit, defineGenkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
// CRITICAL FIX: Use a wildcard import to robustly handle module resolution in Next.js.
import * as firebaseModule from '@genkit-ai/firebase';

// Extract the callable firebase function from the module object to handle Webpack quirks.
const firebasePlugin = (firebaseModule as any).firebase || firebaseModule.default;

// IMPORTANT: Using the API Key provided by the user directly.
const GEMINI_API_KEY = "AIzaSyDlTc56bOOF_k_N53lRdnR7KU21e5E45Y";

// Define the core Genkit configuration using modern imports (defineGenkit/googleGenai)
export const ai = genkit({
    plugins: [
      firebasePlugin(),
      googleAI({ 
        apiKey: GEMINI_API_KEY, 
      }), 
    ],
    logLevel: 'debug',
    enableTracingAndMetrics: true,
});
