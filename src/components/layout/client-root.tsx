
'use client';

import React, { useEffect, useState } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore, useInitializeApp } from '@/lib/store';
import { InstallProvider } from '@/components/install-provider';
import GlobalLoader from './global-loader';

/**
 * RESILIENT OFFLINE ROOT
 * Prioritizes showing the cached UI over waiting for cloud authentication.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [hasHydrated, setHasHydrated] = useState(false);
    const { appReady, isInitialized } = useAppStore();
    
    // Start identity and services bootstrap
    useInitializeApp();

    useEffect(() => {
        setHasHydrated(true);
    }, []);
    
    // OFFLINE LOGIC: 
    // We show the loader ONLY on the very first visit (where isInitialized is false).
    // On subsequent visits, we show the cached UI immediately (hasHydrated is enough).
    if (!hasHydrated || (!isInitialized && !appReady)) {
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
