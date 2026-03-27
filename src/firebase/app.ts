
'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';

/**
 * STRATEGIC FIREBASE APP LOADER
 * Strictly targets the project ID defined in your environment variables.
 * derivation: Automatically constructs the storage bucket URL if not provided.
 */
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: projectId,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${projectId}.firebasestorage.app`,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function getFirebaseApp(): FirebaseApp | null {
  if (getApps().length) return getApp();
  
  if (!projectId || projectId === 'undefined' || projectId.includes('{')) {
    console.error("CRITICAL ERROR: Missing or invalid NEXT_PUBLIC_FIREBASE_PROJECT_ID in environment variables.");
    return null;
  }

  try {
    return initializeApp(firebaseConfig);
  } catch (e) {
    console.error("Firebase App initialization failed:", e);
    return null;
  }
}
