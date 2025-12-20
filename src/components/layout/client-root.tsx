
'use client';

import React, { useEffect } from 'react';
import { FirebaseClientProvider, useFirebase } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore } from '@/lib/store';
import GlobalLoader from './global-loader';
import { InstallProvider } from '@/components/install-provider';

/**
 * This hook is responsible for making sure the application's essential
 * data is loaded before the UI is shown to the user. It handles both
 * the initial data fetch and rehydration from persisted local storage.
 */
function useInitializeApp() {
    const { firestore } = useFirebase();
    const {
        fetchInitialData,
        isInitialized,
        loading,
        setAppReady,
    } = useAppStore();

    useEffect(() => {
        // If data is already initialized from a previous session (persisted state),
        // we can mark the app as ready immediately. We might still want to fetch
        // in the background for updates, but the UI can render.
        if (isInitialized) {
            setAppReady(true);
            if (firestore) {
              // Optional: fetch in the background if needed
              // fetchInitialData(firestore); 
            }
            return;
        }

        // If not initialized and not already loading, start the data fetch.
        if (firestore && !loading) {
            fetchInitialData(firestore);
        }
    }, [firestore, isInitialized, loading, fetchInitialData, setAppReady]);
}


function AppContent({ children }: { children: React.ReactNode }) {
    useInitializeApp();
    const { appReady } = useAppStore();

    if (!appReady) {
        return <GlobalLoader />;
    }

    return (
        <InstallProvider>
            <CartProvider>
                <MainLayout>
                    {children}
                </MainLayout>
                <Toaster />
            </CartProvider>
        </InstallProvider>
    );
}

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
        <AppContent>{children}</AppContent>
    </FirebaseClientProvider>
  );
}
