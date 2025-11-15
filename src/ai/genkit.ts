
'use server';
// This file is the single source of truth for Genkit AI-related configuration.
// It is used by the /api/genkit route to expose flows to the Genkit developer UI.
// It is also used by the app to call flows.

import { AIMiddleware, GenkitError, genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { getAdminServices } from '@/firebase/admin-init';
import { cookies } from 'next/headers';
import { z } from 'zod';

/**
 * An async helper function to get the UID of the currently authenticated user.
 * This can be called from server actions or other server-side code.
 * @returns The user's UID, or throws an error if not authenticated.
 */
export async function getAuthenticatedUid(): Promise<string> {
    const { auth } = await getAdminServices();
    const sessionCookie = cookies().get('__session')?.value;
    if (!sessionCookie) {
        throw new GenkitError({
            status: 'UNAUTHENTICATED',
            message: 'User is not authenticated.',
        });
    }
    try {
        const decodedIdToken = await auth.verifySessionCookie(sessionCookie);
        return decodedIdToken.uid;
    } catch (e) {
        console.warn('Could not verify session cookie. User will be considered anonymous.', e);
        throw new GenkitError({
            status: 'UNAUTHENTICATED',
            message: 'Session cookie is invalid.',
        });
    }
}


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
