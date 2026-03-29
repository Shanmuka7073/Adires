
'use client';

import React, { useEffect, useState } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useInitializeApp } from '@/lib/store';
import { InstallProvider } from '@/components/install-provider';

/**
 * CORE CLIENT WRAPPER
 * This is the actual implementation of the ClientRoot.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [isMounted, setIsMounted] = useState(false);
    
    // Initialize global app data exactly once
    useInitializeApp();

    useEffect(() => {
        setIsMounted(true);
    }, []);
    
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
