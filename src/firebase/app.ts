
'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';

/**
 * HARDENED FIREBASE APP LOADER
 * Strictly checks for Project ID validity to prevent "projects//databases" path errors.
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
  
  // 1. VALIDATION CHECK: Prevent "projects//databases" path corruption
  const pid = firebaseConfig.projectId;
  const isValidPid = pid && pid !== 'undefined' && pid !== '' && !pid.includes('{');

  if (!isValidPid) {
    console.error("CRITICAL ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing or invalid. Check your environment variables.");
    // Return null to allow the client to handle the missing connection gracefully
    return null;
  }

  // 2. CONFIG COMPLETENESS CHECK
  if (!firebaseConfig.apiKey || !firebaseConfig.appId) {
    console.error("CRITICAL ERROR: Firebase API Key or App ID is missing.");
    return null;
  }

  try {
    return initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase App initialization failed:", e);
    return null;
  }
}
