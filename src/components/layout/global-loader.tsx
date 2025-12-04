
"use client";

import Image from 'next/image';

export default function GlobalLoader() {
  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
        <div className="relative flex items-center justify-center h-24 w-24">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin"></div>
            <Image 
                src="https://i.ibb.co/WpfhKqjW/android-launchericon-512-512.png" 
                alt="Local Basket Logo"
                width={64}
                height={64}
                className="rounded-full"
            />
        </div>
      <p className="mt-6 text-muted-foreground font-semibold text-lg animate-pulse">
        Loading LocalBasket…
      </p>
    </div>
  );
}
