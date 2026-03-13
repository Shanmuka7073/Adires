
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
 * data is loaded before the UI is shown to the user. It now ensures a fresh
 * fetch on every cold load, preventing race conditions.
 */
function useInitializeApp() {
    const { firestore, user } = useFirebase();
    const {
        fetchInitialData,
        isInitialized,
        loading,
    } = useAppStore();

    useEffect(() => {
        // Only fetch if firestore is available and we haven't initialized yet.
        // This runs once per application load.
        if (firestore && !isInitialized && !loading) {
            fetchInitialData(firestore, user?.uid);
        }
    }, [firestore, user?.uid, isInitialized, loading, fetchInitialData]);
}


function AppContent({ children }: { children: React.ReactNode }) {
    useInitializeApp();
    // We now rely solely on isInitialized, which is only set to true after the
    // initial data fetch is complete. This prevents the UI from rendering
    // with stale or incomplete data from localStorage.
    const { isInitialized } = useAppStore();

    if (!isInitialized) {
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
