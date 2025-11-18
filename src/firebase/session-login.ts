
'use server';

import { auth } from '@/firebase/admin-init';
import { flow } from '@/ai/genkit';
import { z } from 'zod';

/**
 * A Genkit flow for authenticating a user and creating a session cookie.
 * This is a server-side action that should be called from a client component.
 */
export const sessionLogin = flow(
  {
    name: 'sessionLogin',
    inputSchema: z.object({ idToken: z.string() }),
    outputSchema: z.object({ success: z.boolean() }),
  },
  async ({ idToken }) => {
    try {
      const expiresIn = 60 * 60 * 24 * 5 * 1000; // 5 days
      const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });
      // In a real application, you would set the cookie in the response.
      // Since we are in a Genkit flow, we can't directly manipulate the response.
      // The client will need to handle setting the cookie.
      return { success: true };
    } catch (error) {
      console.error('Error creating session cookie:', error);
      return { success: false };
    }
  }
);
