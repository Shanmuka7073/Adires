'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { cookies } from 'next/headers';
import { AuthError } from 'firebase-admin/auth';

/**
 * Creates a server-side session cookie for the authenticated user.
 * @param idToken The Firebase ID token from the client.
 */
export async function sessionLogin(idToken: string) {
  const { auth } = await getAdminServices();

  try {
    // Set session expiration to 5 days.
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    // Create the session cookie. This will also verify the ID token.
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    // Set the cookie on the response.
    cookies().set('__session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'lax',
    });

  } catch (error) {
    const authError = error as AuthError;
    console.error('Session Login Error:', authError.message);
    // In a real app, you might want to return an error object
    // to the client to inform them of the failure.
    // For now, we log it on the server.
    throw new Error('Failed to create session.');
  }
}
