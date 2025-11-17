'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { cookies } from 'next/headers';
import { AuthError, getAuth as getAdminAuth } from 'firebase-admin/auth';
import { logLoginAttempt } from '@/app/actions';

/**
 * Creates a session cookie for the given ID token.
 * This is a server-side action.
 */
export async function sessionLogin(idToken: string) {
  try {
    const { auth } = await getAdminServices();
    const decodedIdToken = await auth.verifyIdToken(idToken);

    // Set session expiration to 5 days.
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    // Set the cookie on the browser
    cookies().set('__session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'lax',
    });

    await logLoginAttempt(decodedIdToken.email || 'unknown', 'success', decodedIdToken.uid);

  } catch (error) {
    const authError = error as AuthError;
    console.error('Session Login Error:', authError.message);
    if (authError.code) {
        await logLoginAttempt('unknown', 'failure', undefined, authError.code);
    }
    // Re-throw or handle the error as needed for the frontend
    throw error;
  }
}
