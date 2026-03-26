
'use client';

import { initializeApp, getApps, getApp, type FirebaseApp } from 'firebase/app';

/**
 * HARDENED FIREBASE APP LOADER
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
  
  // 1. DYNAMIC ENVIRONMENT DETECTION
  // If we are in the Firebase Studio preview, we may need to override the Project ID
  let pid = firebaseConfig.projectId;
  
  if (typeof window !== 'undefined') {
      const isStudio = window.location.hostname.includes('firebase-studio') || window.location.hostname.includes('web-workstation');
      if (isStudio && (!pid || pid === 'undefined' || pid.includes('{'))) {
          // Attempt to extract from URL or use common placeholder
          pid = 'studio-9070259337-c267a'; 
      }
  }

  const isValidPid = pid && pid !== 'undefined' && pid !== '' && !pid.includes('{');

  if (!isValidPid) {
    console.error("CRITICAL ERROR: NEXT_PUBLIC_FIREBASE_PROJECT_ID is missing.");
    return null;
  }

  try {
    return initializeApp({ ...firebaseConfig, projectId: pid });
  } catch (e) {
    console.error("Firebase App initialization failed:", e);
    return null;
  }
}
