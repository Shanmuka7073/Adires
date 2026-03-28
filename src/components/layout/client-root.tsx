'use client';

import React, { useEffect, useState } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useInitializeApp } from '@/lib/store';
import { InstallProvider } from '@/components/install-provider';

/**
 * CLIENT ROOT
 * Wraps the application in all necessary client-side providers.
 */
export function ClientRoot({ children }: { children: React.ReactNode }) {
    const [isMounted, setIsMounted] = useState(false);
    
    // Ensure app is initialized correctly on client mount
    useInitializeApp();

    useEffect(() => {
        setIsMounted(true);
    }, []);
    
    if (!isMounted) {
        return null;
    }

    return (
        <FirebaseClientProvider>
            <InstallProvider>
                <CartProvider>
                    <MainLayout>
                        {children}
                    </MainLayout>
                    <Toaster />
                </CartProvider>
            </InstallProvider>
        </FirebaseClientProvider>
    );
}