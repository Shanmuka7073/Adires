
'use client';

import React, { useEffect } from 'react';
import { FirebaseClientProvider, useFirebase } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout, MenuLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore } from '@/lib/store';
import GlobalLoader from './global-loader';
import { InstallProvider } from '@/components/install-provider';
import { usePathname } from 'next/navigation';

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
        appReady,
        stores // Use a core data array to check for rehydration
    } = useAppStore();

    // Effect for fetching initial data
    useEffect(() => {
        if (firestore && !isInitialized && !loading) {
            fetchInitialData(firestore);
        }
    }, [firestore, isInitialized, loading, fetchInitialData]);

    // Effect for determining when the app is ready to be shown
    useEffect(() => {
        // If the app is already ready, do nothing.
        if (appReady) return;

        // If data has been rehydrated from localStorage, the app is ready.
        if (stores.length > 0 && isInitialized) {
            setAppReady(true);
        }
        // If fetching is complete (initialized and not loading), the app is ready.
        else if (isInitialized && !loading) {
            setAppReady(true);
        }

    }, [isInitialized, loading, appReady, setAppReady, stores.length]);
}


function AppContent({ children }: { children: React.ReactNode }) {
    useInitializeApp();
    const { appReady } = useAppStore();
    const pathname = usePathname();
    const isMenuPage = pathname.startsWith('/menu/');

    if (isMenuPage) {
        // For menu pages, we don't need to wait for all global data.
        return (
             <InstallProvider>
                <CartProvider>
                    <MenuLayout>{children}</MenuLayout>
                    <Toaster />
                </CartProvider>
            </InstallProvider>
        )
    }
    
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
