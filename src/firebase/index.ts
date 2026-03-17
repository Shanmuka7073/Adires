
'use client';
import { getClientFirebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

// Keep a client-side cache of the initialized app
let clientFirebaseApp: FirebaseApp | null = null;

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export async function initializeFirebase() {
  // If we've already initialized, return the cached instance
  if (clientFirebaseApp) {
    return getSdks(clientFirebaseApp);
  }

  // Fetch the configuration from the server action
  const firebaseConfig = await getClientFirebaseConfig();

  // Initialize the app with the fetched config
  const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
  clientFirebaseApp = app;

  return getSdks(app);
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: initializeFirestore(firebaseApp, {
        // Enable persistent local cache for sub-200ms perceived speed and lower costs
        localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
        ignoreUndefinedProperties: true,
        experimentalForceLongPolling: true,
    }),
    storage: getStorage(firebaseApp), // Initialize and export storage
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';

// Explicitly export useFirestore for clarity
export { useFirestore } from './provider';
