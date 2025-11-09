
import type { Metadata } from 'next';
import './globals.css';
import { PT_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';
import { Toaster } from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';
import { CartProvider } from '@/lib/cart';
import { MainLayout } from '@/components/layout/main-layout';

const ptSans = PT_Sans({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-pt-sans',
});

export const metadata: Metadata = {
    title: 'LocalBasket',
    description: 'Shop Fresh, Shop Local, Just by Voice',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Data is no longer fetched on the server during the initial render.
  // It will be fetched on the client-side within the MainLayout component.
  return (
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
      </body>
    </html>
  );
}
