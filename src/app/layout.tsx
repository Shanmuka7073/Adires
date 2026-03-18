
import type { Metadata, Viewport } from "next";
import { PT_Sans } from "next/font/google";
import "./globals.css";
import { ClientRoot } from "@/components/layout/client-root";

const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pt-sans",
});

export const metadata: Metadata = {
  title: "Adires | Unified Local Market",
  description: "Your unified local market for groceries, restaurants, and salons.",
  manifest: "/manifest.json",
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
        <script dangerouslySetInnerHTML={{ __html: `
          // Early capture of the install prompt
          window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            window.deferredInstallPrompt = e;
            window.dispatchEvent(new CustomEvent('pwa-install-available'));
          });
        ` }} />
      </head>
      <body>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
