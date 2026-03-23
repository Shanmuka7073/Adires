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
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

// Keep a client-side cache of the initialized app
let clientFirebaseApp: FirebaseApp | null = null;
let appCheckInitialized = false;

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

  // Initialize App Check only on the client
  if (typeof window !== 'undefined' && !appCheckInitialized) {
    try {
        // SYNCHRONIZED KEY: Matching the provider in client-root.tsx
        const appCheck = initializeAppCheck(app, {
            provider: new ReCaptchaV3Provider('6LdgK5UsAAAAAN0jsIdfk5gPWZpSHKOo5aEGtYsw'),
            isTokenAutoRefreshEnabled: true,
        });
        // Expose instance for diagnostic tools
        (window as any).firebaseAppCheckInstance = appCheck;
        appCheckInitialized = true;
        console.log("App Check initialized successfully with reCAPTCHA v3.");
    } catch (e) {
        console.error("App Check failed to initialize:", e);
    }
  }

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
    storage: getStorage(firebaseApp),
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './errors';
export * from './error-emitter';

export { useFirestore } from './provider';
