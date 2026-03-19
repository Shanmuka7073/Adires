
'use client';

import React, { useEffect } from 'react';
import { FirebaseClientProvider, useFirebase } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore, useInitializeApp } from '@/lib/store';
import GlobalLoader from './global-loader';
import { InstallProvider } from '@/components/install-provider';

/**
 * Optimized App Content wrapper.
 * Unlocks the UI as soon as "Core Data" (Branding, Commands) is ready.
 * Background data (Products, Aliases) streams in while user sees skeletons.
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
