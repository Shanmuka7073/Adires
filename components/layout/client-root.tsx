
'use client';

import React, { useEffect } from 'react';
import { FirebaseClientProvider, useFirebase } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore } from '@/lib/store';
import GlobalLoader from '@/components/layout/global-loader';
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
        stores, 
    } = useAppStore();

    useEffect(() => {
        // If data is already in the store (from persisted state), the app is ready.
        if (stores.length > 0 && isInitialized) {
            setAppReady(true);
            if (firestore) {
                fetchInitialData(firestore);
            }
            return;
        }

        // If not initialized and not already loading, start the data fetch.
        if (firestore && !isInitialized && !loading) {
            fetchInitialData(firestore);
        }
    }, [firestore, isInitialized, loading, fetchInitialData, setAppReady, stores.length]);
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
