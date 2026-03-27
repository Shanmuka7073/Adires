'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';

/**
 * STRATEGIC FIREBASE APP LOADER
 * Removed dynamic Project ID overrides to prevent project-switching bugs.
 * Strictly targets the project ID defined in your environment variables.
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

  if (!pid || pid === 'undefined' || pid.includes('{')) {
    console.error("CRITICAL ERROR: Missing or invalid NEXT_PUBLIC_FIREBASE_PROJECT_ID in environment variables.");
    return null;
  }

  try {
    return initializeApp({ ...firebaseConfig, projectId: pid });
  } catch (e) {
    console.error("Firebase App initialization failed:", e);
    return null;
  }
}