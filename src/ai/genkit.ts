
'use server';

import { genkit, type Plugin } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';

const googleAIVertex: Plugin<any> | undefined = process.env.GCLOUD_PROJECT
  ? googleAI({
      location: 'us-central1',
      project: process.env.GCLOUD_PROJECT,
    })
  : undefined;

// Initialize the AI instance with the Google AI plugin.
export const ai = genkit({
  plugins: [googleAIVertex, googleAI()].filter((i) => !!i) as Plugin[],
});
