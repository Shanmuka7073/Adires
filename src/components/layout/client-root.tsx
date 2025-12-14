'use client';

import React, { useEffect } from 'react';
import { FirebaseClientProvider, useFirebase } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore } from '@/lib/store';
import GlobalLoader from './global-loader';
import { InstallProvider } from '@/components/install-provider';
import { usePathname } from 'next/navigation';

/**
 * This hook is responsible for making sure the application's essential
 * data is loaded in the background. It no longer blocks rendering.
 */
function useInitializeApp() {
    const { firestore } = useFirebase();
    const {
        fetchInitialData,
        isInitialized,
        loading,
    } = useAppStore();

    useEffect(() => {
        // If not initialized and not already loading, start the data fetch.
        if (firestore && !isInitialized && !loading) {
            fetchInitialData(firestore);
        }
    }, [firestore, isInitialized, loading, fetchInitialData]);
    
    // Unregister old service workers to force updates.
    useEffect(() => {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      }
    }, []);
}


function AppContent({ children }: { children: React.ReactNode }) {
    // Initialize data in the background. This no longer blocks rendering.
    useInitializeApp();
    const pathname = usePathname();

    // Check if the current route is a menu page
    const isMenuPage = pathname.startsWith('/menu/');

    const content = (
        <InstallProvider>
            <CartProvider>
                {isMenuPage ? (
                    <>
                        {children}
                        <Toaster />
                    </>
                ) : (
                    <MainLayout>
                        {children}
                    </MainLayout>
                )}
                <Toaster />
            </CartProvider>
        </InstallProvider>
    );

    return content;
}

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
        <AppContent>{children}</AppContent>
    </FirebaseClientProvider>
  );
}
