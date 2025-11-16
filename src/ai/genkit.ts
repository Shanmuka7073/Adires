
'use server';
// This file is the single source of truth for Genkit AI-related configuration.

import { AIMiddleware } from 'genkit';
import { getAdminServices } from '@/firebase/admin-init';
import { cookies } from 'next/headers';

// A middleware to add the current user's uid to the flow's context.
// This is NOT exported, but imported by flows that need it.
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
