'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';
import { firebaseConfig } from './config';

/**
 * STRATEGIC FIREBASE APP LOADER
 * Strictly targets the project ID defined in your environment variables or config.
 */
export function getFirebaseApp(): FirebaseApp | null {
  if (getApps().length) return getApp();
  
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || firebaseConfig.projectId;

  if (!projectId || projectId === 'undefined') {
    console.error("CRITICAL ERROR: Missing Firebase Project ID.");
    return null;
  }

  try {
    return initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase App initialization failed:", e);
    return null;
  }
}
