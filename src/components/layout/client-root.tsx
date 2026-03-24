
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
 * FIX: Added hasHydrated state to prevent Error #418 Hydration Mismatch.
 * This ensures the first client render matches the server render exactly.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [hasHydrated, setHasHydrated] = useState(false);
    const { appReady, isInitialized } = useAppStore();
    
    useInitializeApp();

    useEffect(() => {
        setHasHydrated(true);
    }, []);
    
    // During hydration (the very first render on the client), we must match the server.
    // Since the server doesn't have access to localStorage/Zustand persistence,
    // we show the loader until the client is fully hydrated and the app is ready.
    if (!hasHydrated || !isInitialized || !appReady) {
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
