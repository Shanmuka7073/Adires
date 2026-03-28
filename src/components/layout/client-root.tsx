
'use client';

import React, { ReactNode } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { InstallProvider } from '@/components/install-provider';

/**
 * STRATEGIC CLIENT ROOT
 * Wraps the application in all necessary client-side providers.
 * Includes InstallProvider to resolve the 'useInstall must be used within an InstallProvider' error.
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
