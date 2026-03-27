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
 * HYDRATION-SAFE CLIENT PROVIDER
 * Ensures initial render matches server output (null) to prevent hydration errors.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseApp, setFirebaseApp] = useState<FirebaseApp | null>(null);
  const [auth, setAuth] = useState<Auth | null>(null);
  const [firestore, setFirestore] = useState<Firestore | null>(null);
  const [storage, setStorage] = useState<FirebaseStorage | null>(null);
  const [isMounted, setIsMounted] = useState(false);
  const [isCoreLoaded, setIsCoreLoaded] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const initCoreServices = async () => {
        const appInstance = getFirebaseApp();
        const authInstance = getAuthInstance();
        
        setFirebaseApp(appInstance);
        setAuth(authInstance);
        setIsCoreLoaded(true);

        if (appInstance) {
            try {
                const [db, st] = await Promise.all([
                    getFirestoreInstance(),
                    getStorageInstance()
                ]);
                setFirestore(db);
                setStorage(st);
            } catch (e) {
                console.warn("Delayed service load failed:", e);
            }
        }
    };

    initCoreServices();
  }, []);

  // 1. Return null on server and initial client pass to avoid hydration mismatch
  if (!isMounted) {
    return null;
  }

  // 2. Show loader only after hydration, while initializing services
  if (!isCoreLoaded) {
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
