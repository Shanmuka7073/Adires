
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

function AppContent({ children }: { children: React.ReactNode }) {
    const { firestore } = useFirebase();
    const {
        fetchInitialData,
        isInitialized,
        loading,
        setAppReady,
        appReady
    } = useAppStore();
    const pathname = usePathname();
    const isMenuPage = pathname.startsWith('/menu/');

    useEffect(() => {
        // If the app is already ready, we don't need to do anything.
        if (appReady) return;

        // If data is already initialized from persisted state, mark app as ready.
        // Still fetch in the background for updates if not currently loading.
        if (isInitialized) {
            setAppReady(true);
            if (firestore && !loading) {
                fetchInitialData(firestore);
            }
            return;
        }

        // If not initialized and not already loading, start the main data fetch.
        if (firestore && !isInitialized && !loading) {
            fetchInitialData(firestore);
        }
    }, [firestore, isInitialized, loading, appReady, fetchInitialData, setAppReady]);
    
    // The loader is shown if the app isn't ready. 
    // `appReady` is set to true by `fetchInitialData` upon completion.
    if (!appReady) {
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
