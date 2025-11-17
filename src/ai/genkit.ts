
'use server';
import 'dotenv/config';

import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { firebasePlugin } from '@genkit-ai/firebase';

export const ai = genkit({
  plugins: [
    googleAI(),
    firebasePlugin,
  ],
});
