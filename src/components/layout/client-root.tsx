'use client';

import React from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { CartProvider } from '@/lib/cart';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseErrorListener } from '@/components/FirebaseErrorListener';

export function ClientRoot({ children }: { children: React.ReactNode }) {
  return (
    <FirebaseClientProvider>
      <CartProvider>
        {children}
        <Toaster />
        <FirebaseErrorListener />
      </CartProvider>
    </FirebaseClientProvider>
  );
}
