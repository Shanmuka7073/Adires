
'use server';

// This file is temporarily disabled as all Firebase Admin SDK functionality has been removed
// for client-side development focus. It can be restored when server-side features are needed.

export async function sessionLogin(idToken: string) {
  console.log('Session login is disabled for client-side development.');
  // In a real server-side environment, you would use firebase-admin here.
  // For now, we will do nothing to avoid build errors.
}
