
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
 * STRATEGIC CLIENT ROOT
 * Handles the delicate hydration sequence required for high-speed performance dashboards.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [hasHydrated, setHasHydrated] = useState(false);
    const { appReady, isInitialized } = useAppStore();
    
    // Core bootstrap logic: starts identity sync immediately
    useInitializeApp();

    useEffect(() => {
        setHasHydrated(true);
    }, []);
    
    // PREVENT HYDRATION MISMATCH AND FLASHING:
    // We show the loader until we are certain the store has hydrated from localStorage
    // OR we have received the initial targeted identity fetch from Firestore.
    if (!hasHydrated || !isInitialized || !appReady) {
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
