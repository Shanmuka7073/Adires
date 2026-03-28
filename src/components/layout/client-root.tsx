
'use client';

import React, { ReactNode } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';

/**
 * CLIENT ROOT
 * Corrects the circular dependency by serving as the top-level provider shell.
 */
export function ClientRoot({ children }: { children: ReactNode }) {
  return (
    <FirebaseClientProvider>
      <CartProvider>
        <MainLayout>
          {children}
        </MainLayout>
      </CartProvider>
    </FirebaseClientProvider>
  );
}
