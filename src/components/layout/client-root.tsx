
'use client';

import React, { useEffect } from 'react';
import { FirebaseClientProvider, useFirebase } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout, MenuLayout, SharedVoiceProvider } from '@/components/layout/main-layout';
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
        if (isInitialized) {
            setAppReady(true);
             if (firestore && !loading) {
                // Fetch in the background for updates if not already loading.
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
    const { appReady, isInitialized } = useAppStore();
    const pathname = usePathname();

    const isMenuPage = pathname.startsWith('/menu/');
    
    // Show loader if the app is not ready OR if it's not initialized yet.
    if (!appReady || !isInitialized) {
        return <GlobalLoader />;
    }

    return (
        <InstallProvider>
            <CartProvider>
                <SharedVoiceProvider>
                    {isMenuPage ? (
                        <MenuLayout>{children}</MenuLayout>
                    ) : (
                        <MainLayout>{children}</MainLayout>
                    )}
                </SharedVoiceProvider>
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
