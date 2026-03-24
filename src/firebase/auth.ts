'use client';

import { getAuth, type Auth } from 'firebase/auth';
import { getFirebaseApp } from './app';

/**
 * MODULAR AUTH GETTER
 * Ensures auth is only initialized when the Firebase App is ready.
 */
export function getAuthInstance(): Auth | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getAuth(app);
}
