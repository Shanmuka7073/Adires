
'use server';

import { getAdminServices } from './admin-init';
import { cookies } from 'next/headers';

// This is a simplified session management system using cookies.
// In a production app, you might use a more robust library like `next-auth`.

const SESSION_COOKIE_NAME = '__session';
const SESSION_DURATION_DAYS = 5 * 24 * 60 * 60 * 1000; // 5 days in milliseconds

/**
 * Creates a session cookie after a user is authenticated.
 * @param idToken The Firebase ID token of the authenticated user.
 */
export async function sessionLogin(idToken: string) {
  const { auth } = await getAdminServices();

  try {
    const decodedIdToken = await auth.verifyIdToken(idToken);

    // Only create a session cookie if the token is valid.
    if (decodedIdToken) {
      // Create a session cookie which can be used to validate the user's session
      // on subsequent server-side requests.
      const sessionCookie = await auth.createSessionCookie(idToken, {
        expiresIn: SESSION_DURATION_DAYS,
      });

      // Set the session cookie on the client.
      // `httpOnly` makes it inaccessible to client-side scripts, which is more secure.
      // `secure` ensures it's only sent over HTTPS.
      cookies().set(SESSION_COOKIE_NAME, sessionCookie, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: SESSION_DURATION_DAYS,
        path: '/',
      });
    }
  } catch (error) {
    console.error('Session login failed:', error);
    // Handle error, e.g., by throwing or returning an error response
  }
}

/**
 * Logs the user out by clearing the session cookie.
 */
export async function sessionLogout() {
  // Clear the session cookie.
  cookies().delete(SESSION_COOKIE_NAME);
}

/**
 * Gets the current user from the session cookie.
 * This is used in server components or API routes to check for an active session.
 * @returns The decoded token of the authenticated user, or null if not authenticated.
 */
export async function getCurrentUserFromSession() {
  const sessionCookie = cookies().get(SESSION_COOKIE_NAME)?.value;

  if (!sessionCookie) {
    return null;
  }

  try {
    const { auth } = await getAdminServices();
    const decodedToken = await auth.verifySessionCookie(sessionCookie, true);
    return decodedToken;
  } catch (error) {
    // Session cookie is invalid or expired.
    return null;
  }
}
