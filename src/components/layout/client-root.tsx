'use client';

import React, { useEffect, useState } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useInitializeApp } from '@/lib/store';
import { InstallProvider } from '@/components/install-provider';

/**
 * RESILIENT HYDRATION ROOT
 * Ensures initial render matches server (null) 100% of the time.
 * This eliminates the "Hydration failed" Expected matching div error.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [isMounted, setIsMounted] = useState(false);
    
    useInitializeApp();

    useEffect(() => {
        setIsMounted(true);
    }, []);
    
    // Return null on both server and client first render to ensure hydration match
    if (!isMounted) {
        return null;
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
