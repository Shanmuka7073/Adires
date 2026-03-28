'use client';

import React, { ReactNode } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { InstallProvider } from '@/components/install-provider';

/**
 * CLIENT ROOT
 * The definitive entry point for client-side providers.
 * Resolved circular dependency by removing the proxy import.
 */
export function ClientRoot({ children }: { children: ReactNode }) {
  return (
    <FirebaseClientProvider>
      <InstallProvider>
        <CartProvider>
          <MainLayout>
            {children}
          </MainLayout>
        </CartProvider>
      </InstallProvider>
    </FirebaseClientProvider>
  );
}
