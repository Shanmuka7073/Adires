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
 * Optimized App Content.
 * Removed reCAPTCHA provider to resolve performance bottlenecks.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [hasHydrated, setHasHydrated] = useState(false);
    const { appReady, isInitialized } = useAppStore();
    
    // Core bootstrap logic
    useInitializeApp();

    useEffect(() => {
        setHasHydrated(true);
    }, []);
    
    // PREVENT HYDRATION MISMATCH:
    // The server doesn't know if the client has data in localStorage.
    // We force a consistent initial render (GlobalLoader) until hydration is confirmed.
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
