
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
        // If it's a menu page, it's immediately ready without global data.
        if (isMenuPage) {
            if (!appReady) setAppReady(true);
            return;
        }

        // Standard global data loading for the main app
        if (appReady) return;

        if (isInitialized) {
            setAppReady(true);
            if (firestore && !loading) {
                fetchInitialData(firestore);
            }
            return;
        }

        if (firestore && !isInitialized && !loading) {
            fetchInitialData(firestore);
        }
    }, [firestore, isInitialized, loading, appReady, fetchInitialData, setAppReady, isMenuPage]);
    
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
