
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
 * RESILIENT HYDRATION ROOT
 * Ensures browser APIs (localStorage, window) are only accessed after hydration.
 * Release the UI shell quickly to avoid "hanging" loading screens.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [hasHydrated, setHasHydrated] = useState(false);
    const { appReady, isInitialized } = useAppStore();
    
    // Start identity and services bootstrap
    useInitializeApp();

    useEffect(() => {
        setHasHydrated(true);
    }, []);
    
    // 1. Wait for hydration to avoid server/client HTML mismatch
    if (!hasHydrated) {
        return null; // Return empty shell for SSR
    }

    // 2. Show loader ONLY on very first boot or critical sync
    // Release the UI as soon as possible to allow PWA caching to work
    if (!isInitialized && !appReady) {
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
