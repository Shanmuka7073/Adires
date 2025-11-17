'use server';

// This file is temporarily disabled as all Firebase Admin SDK functionality has been removed
// for client-side development focus. It can be restored when server-side features are needed.

export async function getAdminServices(): Promise<any> {
  throw new Error('Firebase Admin SDK is not available in this development mode.');
}
