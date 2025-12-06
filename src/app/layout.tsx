
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
  title: "LocalBasket",
  description: "Your local grocery delivery app.",
  icons: {
    icon: "https://i.ibb.co/WpfhKqjW/android-launchericon-512-512.png",
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
    <html lang="en" className={`${ptSans.variable}`}>
      <body>
        <ClientRoot>{children}</ClientRoot>
      </body>
    </html>
  );
}
