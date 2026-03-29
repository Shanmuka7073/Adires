
'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import { FirebaseClientProvider } from '@/firebase/client-provider';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { InstallProvider } from '@/components/install-provider';

/**
 * CLIENT ROOT
 * Entry point for client-side providers.
 */
export function ClientRoot({ children }: { children: ReactNode }) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

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
