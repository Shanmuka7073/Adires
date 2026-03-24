
'use client';

import React, { useEffect, useState } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore, useInitializeApp } from '@/lib/store';
import { InstallProvider } from '@/components/install-provider';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';
import GlobalLoader from './global-loader';

/**
 * Optimized App Content.
 * Hardened hasHydrated state to prevent hydration errors and double-refresh cycles.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [hasHydrated, setHasHydrated] = useState(false);
    const { appReady, isInitialized } = useAppStore();
    
    useInitializeApp();

    useEffect(() => {
        setHasHydrated(true);
    }, []);
    
    // Server-side and hydration safety check
    if (!hasHydrated) {
        return <div className="fixed inset-0 bg-background" />;
    }

    if (!isInitialized || !appReady) {
        return <GlobalLoader />;
    }

    return (
        <GoogleReCaptchaProvider 
            reCaptchaKey="6LdgK5UsAAAAAN0jsIdfk5gPWZpSHKOo5aEGtYsw"
            scriptProps={{
                async: true,
                defer: true,
                appendTo: 'head',
                nonce: undefined,
            }}
        >
            <InstallProvider>
                <CartProvider>
                    <MainLayout>
                        {children}
                    </MainLayout>
                    <Toaster />
                </CartProvider>
            </InstallProvider>
        </GoogleReCaptchaProvider>
    );
}

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
        <AppContent>{children}</AppContent>
    </FirebaseClientProvider>
  );
}
