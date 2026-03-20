'use client';

import React, { type ReactNode, useEffect, useState } from 'react';
import { FirebaseProvider } from '@/firebase/provider';
import { initializeFirebase } from '@/firebase';
import GlobalLoader from '@/components/layout/global-loader';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';
import type { FirebaseApp } from 'firebase/app';
import type { FirebaseStorage } from 'firebase/storage';

interface FirebaseClientProviderProps {
  children: ReactNode;
}

interface FirebaseServices {
    firebaseApp: FirebaseApp;
    auth: Auth;
    firestore: Firestore;
    storage: FirebaseStorage;
}

export function FirebaseClientProvider({ children }: FirebaseClientProviderProps) {
  const [firebaseServices, setFirebaseServices] = useState<FirebaseServices | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Initialize Firebase on the client side.
    initializeFirebase()
      .then(services => {
        setFirebaseServices(services);
      })
      .catch(err => {
        console.error("Fatal: Firebase initialization failed.", err);
        setError(err.message || "Failed to initialize Firebase. The app cannot continue.");
      });
  }, []);

  if (error) {
      return (
          <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background text-destructive p-4">
              <h1 className="text-xl font-bold">Application Error</h1>
              <p className="text-center">{error}</p>
          </div>
      )
  }

  if (!firebaseServices) {
    return <GlobalLoader />;
  }

  return (
    <FirebaseProvider
      firebaseApp={firebaseServices.firebaseApp}
      auth={firebaseServices.auth}
      firestore={firebaseServices.firestore}
      storage={firebaseServices.storage}
    >
      {children}
    </FirebaseProvider>
  );
}
