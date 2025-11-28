
'use client';

import React, { useEffect } from 'react';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';
import { Toaster } from '@/components/ui/toaster';
import { useAppStore } from '@/lib/store';
import GlobalLoader from './global-loader';

export function ClientRoot({ children }: { children: React.ReactNode }) {
  const { appReady, isInitialized } = useAppStore();

  if (!isInitialized || !appReady) {
    return <GlobalLoader />;
  }

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
