
'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';

/**
 * HARDENED FIREBASE APP LOADER
 * Specifically checks for missing Project ID to prevent the "projects//databases" error.
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
  
  // CRITICAL: Prevent "Invalid segment (projects//databases)" error
  if (!firebaseConfig.projectId || firebaseConfig.projectId === 'undefined' || firebaseConfig.projectId === '') {
    console.error("CRITICAL ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing from environment variables.");
    return null;
  }

  // Ensure mandatory fields exist before attempting initialization
  if (!firebaseConfig.apiKey || !firebaseConfig.appId) {
    console.error("CRITICAL ERROR: Firebase configuration is incomplete (apiKey or appId missing).");
    return null;
  }

  try {
    return initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase App initialization failed:", e);
    return null;
  }
}
