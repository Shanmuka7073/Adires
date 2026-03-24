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
 * Hardened to prevent hydration mismatches (Error #418, #423).
 */
function AppContent({ children }: { children: React.ReactNode }) {
    const [hasHydrated, setHasHydrated] = useState(false);
    const { appReady, isInitialized } = useAppStore();
    
    // Core bootstrap logic
    useInitializeApp();

    useEffect(() => {
        setHasHydrated(true);
    }, []);
    
    // PREVENT HYDRATION MISMATCH:
    // The server doesn't know if the client has data in localStorage.
    // We force a consistent initial render (GlobalLoader) until hydration is confirmed.
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
