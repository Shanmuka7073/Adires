'use server';

import { getAdminServices } from '@/firebase/admin-init';
import { cookies } from 'next/headers';
import { AuthError, getAuth as getAdminAuth } from 'firebase-admin/auth';
import { logLoginAttempt } from '@/app/actions';

/**
 * Creates a server-side session cookie for the authenticated user.
 * @param idToken The Firebase ID token from the client.
 */
export async function sessionLogin(idToken: string) {
  const { auth } = await getAdminServices();

  try {
    // Set session expiration to 5 days.
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    
    // Verify the ID token to get user details before creating the cookie
    const decodedIdToken = await auth.verifyIdToken(idToken);
    
    // Create the session cookie.
    const sessionCookie = await auth.createSessionCookie(idToken, { expiresIn });

    // Set the cookie on the response.
    cookies().set('__session', sessionCookie, {
      maxAge: expiresIn,
      httpOnly: true,
      secure: true,
      path: '/',
      sameSite: 'lax',
    });

    // Log the successful login attempt
    if (decodedIdToken.email) {
       await logLoginAttempt(decodedIdToken.email, 'success', decodedIdToken.uid);
    }

  } catch (error) {
    const authError = error as AuthError;
    console.error('Session Login Error:', authError.message);
    
    // Attempt to decode the token to get the email for logging, even if it's expired
    try {
        const decoded = await getAdminAuth().verifyIdToken(idToken, true);
        if (decoded.email) {
            await logLoginAttempt(decoded.email, 'failure', decoded.uid, authError.code);
        }
    } catch (decodeError) {
        // If decoding also fails, we can't get the email.
        console.error("Could not decode token to log failed attempt:", decodeError);
    }
    
    throw new Error('Failed to create session.');
  }
}
