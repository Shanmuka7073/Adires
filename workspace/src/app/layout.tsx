
import type { Metadata, Viewport } from "next";
import { PT_Sans } from "next/font/google";
import "./globals.css";
import { ClientRoot } from "@/components/layout/client-root";
import Script from "next/script";

const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pt-sans",
});

export const metadata: Metadata = {
  title: "Adires",
  description: "Local Business Impowerment.",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#90EE90",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={ptSans.variable}>
       <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body>
        <Script id="sw-register" strategy="afterInteractive">
          {`
            if ('serviceWorker' in navigator) {
              window.addEventListener('load', () => {
                navigator.serviceWorker.register('/sw.js')
                  .then(() => console.log('Service Worker registered'))
                  .catch(err => console.error('SW registration failed', err));
              });
            }
          `}
        </Script>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
