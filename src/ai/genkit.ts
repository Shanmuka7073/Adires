
'use server';
// This file is the single source of truth for Genkit AI-related configuration.
// It is used by the /api/genkit route to expose flows to the Genkit developer UI.
// It is also used by the app to call flows.

import { AIMiddleware, GenkitError, genkit } from 'genkit';
import { googleAI } from '@genkit-ai/google-genai';
import { getAdminServices } from '@/firebase/admin-init';
import { cookies } from 'next/headers';
import { z } from 'zod';

// A middleware to add the current user's uid to the flow's input metadata.
export const addUserContext: AIMiddleware = async (input, next) => {
  const { auth } = await getAdminServices();
  const sessionCookie = cookies().get('__session')?.value;
  if (sessionCookie) {
    try {
      const decodedIdToken = await auth.verifySessionCookie(sessionCookie);
      input.metadata = { ...input.metadata, uid: decodedIdToken.uid };
    } catch (e) {
      console.warn('Could not verify session cookie. User will be anonymous.', e);
    }
  }
  return next(input);
};
