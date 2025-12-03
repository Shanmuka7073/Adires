
'use client';

import React, { useEffect } from 'react';
import { FirebaseClientProvider, useFirebase } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore } from '@/lib/store';
import GlobalLoader from './global-loader';
import { InstallProvider } from '@/components/install-provider';


function useInitializeApp() {
    const { firestore } = useFirebase();
    const { fetchInitialData, isInitialized, loading, setAppReady } = useAppStore();

    useEffect(() => {
        // If the app is already initialized from persisted state, we can mark it as ready.
        if (isInitialized) {
            setAppReady(true);
            // Optionally, re-fetch in the background to get latest data
            if (firestore) {
                fetchInitialData(firestore);
            }
            return;
        }
        
        // If not initialized and not currently loading, start the fetch.
        if (firestore && !loading) {
            fetchInitialData(firestore); // This will set appReady to true internally upon completion.
        } else if (!firestore && !loading) {
            // If firestore isn't available for some reason, we should still unlock the app.
            setAppReady(true);
        }
    }, [firestore, isInitialized, loading, fetchInitialData, setAppReady]);
};


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
