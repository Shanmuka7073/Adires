
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
        stores, // Use a core data array to check for rehydration
    } = useAppStore();

    useEffect(() => {
        // If data is already in the store (from persisted state), the app is ready.
        if (stores.length > 0 && isInitialized) {
            setAppReady(true);
            // Optionally, you can still fetch data in the background to get updates
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
    const pathname = usePathname();

    const isMenuPage = pathname.startsWith('/menu/');

    if (!appReady) {
        return <GlobalLoader />;
    }

    return (
        <InstallProvider>
            <CartProvider>
                {isMenuPage ? (
                    <MenuLayout>{children}</MenuLayout>
                ) : (
                    <MainLayout>{children}</MainLayout>
                )}
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
