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
 * Hardened to ensure initial render matches server (null) 100% of the time.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [isMounted, setIsMounted] = useState(false);
    const { appReady, isInitialized } = useAppStore();
    
    useInitializeApp();

    useEffect(() => {
        // This only runs on the client after the first render
        setIsMounted(true);
    }, []);
    
    // 1. Render null until mounted to match server output exactly
    if (!isMounted) {
        return null;
    }

    // 2. Show loader only after hydration, while initializing app state
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
