'use client';

import React, { useEffect } from 'react';
import { FirebaseClientProvider, useFirebase } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore } from '@/lib/store';
import GlobalLoader from './global-loader';
import { InstallProvider } from '@/components/install-provider';

// The initialization logic MUST live here, at the top level.
function AppInitializer({ children }: { children: React.ReactNode }) {
  const { firestore } = useFirebase();
  const { fetchInitialData, isInitialized, loading, setAppReady } = useAppStore();

  useEffect(() => {
    // This logic ensures data is fetched as soon as Firebase is ready,
    // without waiting for a logged-in user.
    if (firestore && !isInitialized && !loading) {
      fetchInitialData(firestore).then(() => {
        setAppReady(true);
      });
    } else if (isInitialized) {
      // If data is already in the store (from localStorage), the app is ready.
      setAppReady(true);
    } else if (!firestore && !loading) {
      // If there's a Firebase connection issue, we still unlock the app
      // to prevent getting stuck on the loader forever.
      console.warn("Firebase not available, but proceeding to render app.");
      setAppReady(true);
    }
  }, [firestore, isInitialized, loading, fetchInitialData, setAppReady]);

  return <>{children}</>;
}


export function ClientRoot({ children }: { children: React.ReactNode }) {
  const { appReady, isInitialized } = useAppStore();

  return (
    <FirebaseClientProvider>
      <AppInitializer>
        {!isInitialized || !appReady ? (
          <GlobalLoader />
        ) : (
          <InstallProvider>
            <CartProvider>
              <MainLayout>
                {children}
              </MainLayout>
              <Toaster />
            </CartProvider>
          </InstallProvider>
        )}
      </AppInitializer>
    </FirebaseClientProvider>
  );
}
