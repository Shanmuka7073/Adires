
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
  title: "Adires | Unified Local Market",
  description: "Your unified local market for groceries, restaurants, and salons.",
  // Next.js handles manifest.ts automatically, so we don't need a hardcoded manifest.json link here.
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
        {/* Force an early capture of the install prompt for the InstallProvider */}
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
