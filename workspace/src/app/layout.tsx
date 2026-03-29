
import type { Metadata, Viewport } from "next";
import { PT_Sans } from "next/font/google";
import "./globals.css";
import { ClientRoot } from "@/components/layout/client-root";
import ServiceWorkerRegister from "@/components/service-worker-register";

const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pt-sans",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://adires.vercel.app'),
  title: "Adires | Unified Local Market",
  description: "Your unified local market for groceries, restaurants, and salons.",
  keywords: ["hyperlocal", "marketplace", "delivery", "restaurant", "salon", "India"],
  authors: [{ name: "Adires Platform" }],
  openGraph: {
    title: "Adires | Unified Local Market",
    description: "Connecting you to your trusted neighborhood stores.",
    url: "https://adires.vercel.app",
    siteName: "Adires",
    images: [
      {
        url: "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png",
        width: 800,
        height: 600,
      },
    ],
    locale: "en_IN",
    type: "website",
  },
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#90EE90",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={ptSans.variable}>
       <head>
        <meta charSet="utf-8" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        
        {/* PERFORMANCE: Resource hints for critical Firebase domains */}
        <link rel="preconnect" href="https://www.gstatic.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.google.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://firestore.googleapis.com" />
        <link rel="preconnect" href="https://studio-9070259337-c267a.firebaseapp.com" crossOrigin="anonymous" />
        
        <link rel="dns-prefetch" href="https://www.google.com" />
        <link rel="dns-prefetch" href="https://www.gstatic.com" />
        <link rel="dns-prefetch" href="https://studio-9070259337-c267a.firebaseapp.com" />
        
        <script dangerouslySetInnerHTML={{
            __html: `
                window.addEventListener('beforeinstallprompt', (e) => {
                    e.preventDefault();
                    window.deferredInstallPrompt = e;
                    window.dispatchEvent(new Event('pwa-install-available'));
                });
            `
        }} />
      </head>
      <body>
        <ServiceWorkerRegister />
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
