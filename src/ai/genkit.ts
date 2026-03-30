'use server';

import { genkit, configureGenkit } from '@genkit-ai/core';
import { googleAI } from '@genkit-ai/google-genai';

const isDev = process.env.NODE_ENV === 'development';

configureGenkit({
  plugins: [
    googleAI(),
  ],
  logLevel: isDev ? 'debug' : 'info',
  enableTracingAndMetrics: !isDev,
});

export { genkit as ai };
