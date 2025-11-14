import type { Metadata, Viewport } from "next";
import { PT_Sans } from "next/font/google";
import "./globals.css";

const ptSans = PT_Sans({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-pt-sans",
});

export const metadata: Metadata = {
  title: "LocalBasket",
  description: "Your local grocery delivery app.",
  manifest: "/manifest.json",
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
        {children}
      </body>
    </html>
  );
}
