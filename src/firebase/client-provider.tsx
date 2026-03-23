'use client';

import React, { type ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { firebaseApp, auth, getFirestoreInstance, getStorageInstance, initializeAppCheckDeferred } from '@/firebase';
import GlobalLoader from '@/components/layout/global-loader';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseStorage } from 'firebase/storage';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

/**
 * STRATEGIC CLIENT PROVIDER
 * Implements code-splitting by deferring heavy SDKs.
 * 1. Auth is loaded immediately (Small).
 * 2. Firestore/Storage are loaded in background.
 * 3. App Check is deferred by 3s to clear LCP thread.
 */
export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firestore, setFirestore] = useState<Firestore | null>(null);
  const [storage, setStorage] = useState<FirebaseStorage | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const loadHeavyServices = async () => {
        try {
            const [db, st] = await Promise.all([
                getFirestoreInstance(),
                getStorageInstance()
            ]);
            setFirestore(db);
            setStorage(st);
            setIsLoaded(true);
            
            // Wait for UI to settle before triggering reCAPTCHA
            setTimeout(() => {
                initializeAppCheckDeferred();
            }, 3000);
        } catch (e) {
            console.error("Critical service load failed:", e);
            setIsLoaded(true); 
        }
    };

    loadHeavyServices();
  }, []);

  // Only block the UI if we're not yet ready to handle Auth
  if (!isLoaded && typeof window !== 'undefined') {
    return <GlobalLoader />;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseApp}
      auth={auth}
      firestore={firestore as any}
      storage={storage as any}
    >
      {children}
    </FirebaseProvider>
  );
}
