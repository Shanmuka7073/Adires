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
 * Ensures initial render matches server (null) to eliminate hydration failures.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [isMounted, setIsMounted] = useState(false);
    const { appReady, isInitialized } = useAppStore();
    
    useInitializeApp();

    useEffect(() => {
        setIsMounted(true);
    }, []);
    
    // 1. Render null until mounted to match server output
    if (!isMounted) {
        return null;
    }

    // 2. Show loader only if we are absolutely not ready
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
