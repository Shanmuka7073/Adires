'use client';

import React, { ReactNode } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';

/**
 * CLIENT ROOT
 * Wraps the application in all necessary client-side providers.
 * This file centralizes the provider hierarchy to ensure all child components
 * have access to the required contexts (Firebase, Cart, etc.).
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
