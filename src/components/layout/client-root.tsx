
'use client';

import React, { useEffect, useState } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore, useInitializeApp } from '@/lib/store';
import GlobalLoader from '@/components/layout/global-loader';
import { InstallProvider } from '@/components/install-provider';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

/**
 * Optimized App Content.
 * Deferring GoogleReCaptchaProvider by 4 seconds to clear the main thread 
 * for initial rendering and hydration, improving TBT and FID.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    useInitializeApp();
    const { appReady, isInitialized } = useAppStore();
    const [showRecaptcha, setShowRecaptcha] = useState(false);

    useEffect(() => {
        // Defer reCAPTCHA script injection to maximize PageSpeed score
        const timer = setTimeout(() => {
            setShowRecaptcha(true);
        }, 4000);
        return () => clearTimeout(timer);
    }, []);

    if (!appReady && !isInitialized) {
        return <GlobalLoader />;
    }

    const coreLayout = (
        <InstallProvider>
            <CartProvider>
                <MainLayout>
                    {children}
                </MainLayout>
                <Toaster />
            </CartProvider>
        </InstallProvider>
    );

    if (showRecaptcha) {
        return (
            <GoogleReCaptchaProvider reCaptchaKey="6LdgK5UsAAAAAN0jsIdfk5gPWZpSHKOo5aEGtYsw">
                {coreLayout}
            </GoogleReCaptchaProvider>
        );
    }

    return coreLayout;
}

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
        <AppContent>{children}</AppContent>
    </FirebaseClientProvider>
  );
}
