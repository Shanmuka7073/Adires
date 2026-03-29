'use client';

import React, { ReactNode, useEffect, useState, useMemo } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { InstallProvider } from '@/components/install-provider';
import { AppErrorBoundary } from '@/components/monitoring/error-boundary';
import { initializeFirebase } from '@/firebase';
import { MonitoringInitializer } from "@/components/monitoring/monitoring-initializer";

/**
 * CLIENT ROOT
 * Entry point for all client-side providers.
 * Integrated with ErrorBoundary and Monitoring.
 */
export function ClientRoot({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);
  const firebaseServices = useMemo(() => initializeFirebase(), []);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <FirebaseClientProvider>
      <MonitoringInitializer />
      <AppErrorBoundary db={firebaseServices.firestore}>
        <InstallProvider>
          <CartProvider>
            <MainLayout>
              {children}
            </MainLayout>
          </CartProvider>
        </InstallProvider>
      </AppErrorBoundary>
    </FirebaseClientProvider>
  );
}
