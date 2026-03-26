'use client';

import React, { type ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { getFirebaseApp, getAuthInstance, getFirestoreInstance, getStorageInstance } from '@/firebase';
import GlobalLoader from '@/components/layout/global-loader';
import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * STRATEGIC CLIENT PROVIDER (V4 - Optimized)
 * Fully dynamic initialization to solve build-time errors and bundle bloat.
 * 1. Initializes basic App and Auth shell on client mount.
 * 2. Lazily loads Firestore and Storage in the background.
 * 3. App Check and reCAPTCHA have been removed for maximum speed.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseApp, setFirebaseApp] = useState<FirebaseApp | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [firestore, setFirestore] = useState<Firestore | null>(null);
  const [storage, setStorage] = useState<FirebaseStorage | null>(null);
  const [isCoreLoaded, setIsCoreLoaded] = useState(false);

  useEffect(() => {
    const initCoreServices = async () => {
        // Core initialization only happens on the client
        const appInstance = getFirebaseApp();
        const authInstance = getAuthInstance();
        
        setFirebaseApp(appInstance);
        setAuth(authInstance);
        setIsCoreLoaded(true);

        // Background load heavier services
        if (appInstance) {
            try {
                const [db, st] = await Promise.all([
                    getFirestoreInstance(),
                    getStorageInstance()
                ]);
                setFirestore(db);
                setStorage(st);
            } catch (e) {
                console.error("Delayed service load failed:", e);
            }
        }
    };

    initCoreServices();
  }, []);

  // Show the loader only during the initial client-side bootstrap
  if (!isCoreLoaded && typeof window !== 'undefined') {
    return <GlobalLoader />;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore}
      storage={storage}
    >
      {children}
    </FirebaseProvider>
  );
}
