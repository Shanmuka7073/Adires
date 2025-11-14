<<<<<<< HEAD
import type { Metadata, Viewport } from "next";
import { PT_Sans } from "next/font/google";
import "./globals.css";
import { ClientRoot } from "@/components/layout/client-root";
=======

import type { Metadata } from 'next';
import './globals.css';
import { PT_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';

>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584

const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pt-sans",
});

<<<<<<< HEAD
export const metadata: Metadata = {
  title: "LocalBasket",
  description: "Your local grocery delivery app.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#90EE90",
=======
// This is now a pure server component. Metadata can be exported.
export const metadata: Metadata = {
    title: 'LocalBasket',
    description: 'Shop Fresh, Shop Local, Just by Voice',
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
<<<<<<< HEAD
    <html lang="en" className={`${ptSans.variable}`}>
      <body>
        <ClientRoot>{children}</ClientRoot>
=======
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* The font links are now managed by Next.js font optimization */}
      </head>
      <body
        className={cn(
          'min-h-screen bg-background font-body antialiased',
          ptSans.variable
        )}
      >
        <FirebaseClientProvider>
          <CartProvider>
            <MainLayout>
              {children}
            </MainLayout>
            <Toaster />
          </CartProvider>
        </FirebaseClientProvider>
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
      </body>
    </html>
  );
}
