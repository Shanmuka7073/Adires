
'use client';

import React, { useEffect, useState } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore, useInitializeApp } from '@/lib/store';
import { InstallProvider } from '@/components/install-provider';
import { GoogleReCaptchaProvider } from 'react-google-recaptcha-v3';

/**
 * Optimized App Content.
 * FIX: Removed full-screen GlobalLoader from critical render path.
 * FIX: Integrated ReCaptchaProvider at root to prevent full-app re-mount after 4s.
 */
function AppContent({ children }: { children: React.ReactNode }) {
    useInitializeApp();
    
    // We render the core layout immediately. Individual pages handle 
    // their own loading states with Skeletons for better LCP scores.
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
