
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
 * Handles the high-performance initialization loop.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    useInitializeApp();
    const { appReady } = useAppStore();

    if (!appReady) {
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
