
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
 * data is loaded before the UI is shown to the user.
 */
function useInitializeApp() {
    const { firestore, user } = useFirebase();
    const {
        fetchInitialData,
        fetchUserStore,
        isInitialized,
        loading,
        userStore
    } = useAppStore();

    useEffect(() => {
        // Only fetch if firestore is available and we haven't initialized yet.
        if (firestore && !isInitialized && !loading) {
            fetchInitialData(firestore, user?.uid);
        }
    }, [firestore, user?.uid, isInitialized, loading, fetchInitialData]);

    // Handle secondary branding fetch if user logs in later
    useEffect(() => {
        if (isInitialized && user?.uid && !userStore && firestore) {
            fetchUserStore(firestore, user.uid);
        }
    }, [isInitialized, user?.uid, userStore, firestore, fetchUserStore]);
}


function AppContent({ children }: { children: React.ReactNode }) {
    useInitializeApp();
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
