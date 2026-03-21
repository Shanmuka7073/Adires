
'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore, useInitializeApp } from '@/lib/store';
import GlobalLoader from '@/components/layout/global-loader';
import { InstallProvider } from '@/components/install-provider';

/**
 * Consolidated Client Root.
 * Optimized for "Shell-First" rendering to drastically reduce LCP.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    useInitializeApp();
    const { appReady, isInitialized } = useAppStore();

    // If we have NO data at all, show the light loader.
    // If we have isInitialized (persisted), we render the layout immediately.
    if (!appReady && !isInitialized) {
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
