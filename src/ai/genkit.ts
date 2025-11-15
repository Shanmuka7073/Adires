
'use server';
// This file is the single source of truth for Genkit AI-related configuration.
// It is used by the /api/genkit route to expose flows to the Genkit developer UI.
// It is also used by the app to call flows.

import { AIMiddleware, GenkitError } from 'genkit';
import { genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { getAdminServices } from '@/firebase/admin-init';
import { cookies } from 'next/headers';
import { z } from 'zod';


// A middleware to add the current user's uid to the flow's context.
export const addUserContext: AIMiddleware = async (input, next, context) => {
  const { auth } = await getAdminServices();
  const sessionCookie = cookies().get('__session')?.value;
  if (sessionCookie) {
    try {
      const decodedIdToken = await auth.verifySessionCookie(sessionCookie);
      // The standard way to pass auth info is on the context.auth object
      context.auth = { 
          uid: decodedIdToken.uid, 
          email: decodedIdToken.email,
          // You can add other properties from the token here if needed
      };
    } catch (e) {
      console.warn('Could not verify session cookie. User will be anonymous.', e);
    }
  }
  return next(input);
};


// Create and export a single, configured Genkit instance for the entire app.
export const ai = genkit({
    plugins: [
        googleAI(),
    ],
    policy: {
        run: {
            action: 'allow',
            subjects: 'all',
            conditions: [],
        },
        // Apply the middleware globally to all flows defined with this instance.
        use: [addUserContext],
    },
    logLevel: 'debug',
    enableTracingAndMetrics: true,
});
