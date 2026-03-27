'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';

/**
 * STRATEGIC FIREBASE APP LOADER
 * Removed dynamic overrides to prevent project mismatch between Client and Admin SDKs.
 * Strictly uses environment variables for reliability.
 */
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp(): FirebaseApp | null {
  if (getApps().length) return getApp();
  
  const pid = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Validation to ensure we are not initializing with undefined/placeholder values
  const isValidPid = pid && pid !== 'undefined' && pid !== '' && !pid.includes('{');

  if (!isValidPid) {
    console.error("CRITICAL ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing in environment variables.");
    return null;
  }

  try {
    return initializeApp({ ...firebaseConfig, projectId: pid });
  } catch (e) {
    console.error("Firebase App initialization failed:", e);
    return null;
  }
}
