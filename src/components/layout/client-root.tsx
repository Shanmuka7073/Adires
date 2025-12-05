
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
 * data is loaded in the background. It no longer blocks rendering.
 */
function useInitializeApp() {
    const { firestore } = useFirebase();
    const {
        fetchInitialData,
        isInitialized,
        loading,
    } = useAppStore();

    useEffect(() => {
        // If not initialized and not already loading, start the data fetch.
        if (firestore && !isInitialized && !loading) {
            fetchInitialData(firestore);
        }
    }, [firestore, isInitialized, loading, fetchInitialData]);
}


function AppContent({ children }: { children: React.ReactNode }) {
    // Initialize data in the background. This no longer blocks rendering.
    useInitializeApp();

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
