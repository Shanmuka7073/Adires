'use client';

import React, { ReactNode } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { CartProvider } from '@/lib/cart';

/**
 * CLIENT ROOT
 * Wraps the application in all necessary client-side providers.
 */
export function ClientRoot({ children }: { children: ReactNode }) {
  return (
    <FirebaseClientProvider>
      <CartProvider>
        {children}
      </CartProvider>
    </FirebaseClientProvider>
  );
}