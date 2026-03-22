
"use client";

import Image from 'next/image';
import { useAppStore } from '@/lib/store';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

/**
 * Branded Global Loader
 * Uses the store's identity from the persistent local cache to show branding instantly.
 */
export default function GlobalLoader() {
  const { userStore } = useAppStore();
  
  // Use restaurant's own image if available in persisted state, otherwise fallback to platform logo
  const logoUrl = userStore?.imageUrl || ADIRES_LOGO;
  const brandName = userStore?.name || "Adires";

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-background">
        <div className="relative flex items-center justify-center h-24 w-24">
            <div className="absolute inset-0 border-4 border-primary/20 rounded-full"></div>
            <div className="absolute inset-0 border-t-4 border-primary rounded-full animate-spin"></div>
            <div className="relative w-16 h-16 rounded-full overflow-hidden bg-white shadow-md border-2 border-primary/10">
                <Image 
                    src={logoUrl} 
                    alt={brandName}
                    fill
                    className="object-cover"
                    priority
                />
            </div>
        </div>
      <p className="mt-6 text-gray-900 font-black text-xs uppercase tracking-[0.3em] animate-pulse">
        {brandName}
      </p>
    </div>
  );
}
