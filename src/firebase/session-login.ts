'use server';

// This file is temporarily disabled as all Firebase Admin SDK functionality has been removed
// for client-side development focus. It can be restored when server-side features are needed.

export async function sessionLogin(idToken: string) {
  console.log('Session login is disabled for client-side development.');
  // The original function tried to use firebase-admin to create a session cookie.
  // This is not needed for client-only auth state management.
  return Promise.resolve();
}
