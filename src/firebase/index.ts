
'use client';

import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { firebaseConfig } from './config';

/**
 * STRATEGIC SDK INITIALIZATION
 * Uses config.ts as a fallback to ensure build-time prerendering doesn't fail
 * due to missing environment variables. This resolves the auth/invalid-api-key error.
 */
export function initializeFirebase() {
  const finalConfig = {
    ...firebaseConfig,
    apiKey: (process.env.NEXT_PUBLIC_FIREBASE_API_KEY && process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'undefined') 
        ? process.env.NEXT_PUBLIC_FIREBASE_API_KEY 
        : firebaseConfig.apiKey,
    authDomain: (process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN && process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN !== 'undefined') 
        ? process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN 
        : firebaseConfig.authDomain,
    projectId: (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== 'undefined') 
        ? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID 
        : firebaseConfig.projectId,
    storageBucket: (process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET && process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET !== 'undefined') 
        ? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET 
        : firebaseConfig.storageBucket,
    messagingSenderId: (process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID && process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID !== 'undefined') 
        ? process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID 
        : firebaseConfig.messagingSenderId,
    appId: (process.env.NEXT_PUBLIC_FIREBASE_APP_ID && process.env.NEXT_PUBLIC_FIREBASE_APP_ID !== 'undefined') 
        ? process.env.NEXT_PUBLIC_FIREBASE_APP_ID 
        : firebaseConfig.appId,
  };

  const app = getApps().length > 0 
    ? getApp() 
    : initializeApp(finalConfig);

  return {
    firebaseApp: app,
    auth: getAuth(app),
    firestore: getFirestore(app)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';
