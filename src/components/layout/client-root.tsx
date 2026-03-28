'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { CartProvider } from '@/lib/cart';
import { Toaster } from '@/components/ui/toaster';
import { MainLayout } from '@/components/layout/main-layout';

/**
 * CLIENT ROOT
 * Correctly wraps the application in all necessary client-side providers.
 * Fixed to prevent circular imports.
 */
export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <CartProvider>
        <MainLayout>
          {children}
        </MainLayout>
        <Toaster />
      </CartProvider>
    </FirebaseClientProvider>
  );
}