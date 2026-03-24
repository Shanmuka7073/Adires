'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';

/**
 * LIGHTWEIGHT FIREBASE APP LOADER
 * Optimized to be resilient during Next.js static generation (server-side).
 * It will not attempt to initialize if the API key is missing during build.
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
  
  // Guard against missing config during build time (SSR/Prerendering)
  if (!firebaseConfig.apiKey) {
    return null;
  }

  return initializeApp(firebaseConfig);
}
