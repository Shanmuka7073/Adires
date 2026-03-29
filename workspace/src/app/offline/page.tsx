
'use client';

import { WifiOff, Home, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export default function OfflineFallbackPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-6 text-center">
      <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mb-6">
        <WifiOff className="h-12 w-12 text-muted-foreground opacity-20" />
      </div>
      <h1 className="text-3xl font-black font-headline tracking-tight uppercase italic mb-2">You are Offline</h1>
      <p className="text-muted-foreground max-w-xs mb-8">
        It looks like you've lost your connection. You can still browse recently viewed stores and items.
      </p>
      <div className="grid grid-cols-1 gap-3 w-full max-w-xs">
        <Button asChild className="h-12 rounded-xl font-black uppercase text-[10px] tracking-widest">
          <Link href="/"><Home className="mr-2 h-4 w-4" /> Go to Home</Link>
        </Button>
        <Button variant="outline" onClick={() => window.location.reload()} className="h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-2">
          <RefreshCw className="mr-2 h-4 w-4" /> Try Reconnecting
        </Button>
      </div>
    </div>
  );
}
