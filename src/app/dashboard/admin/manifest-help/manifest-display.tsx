
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * MANIFEST DISPLAY (DECOMMISSIONED)
 * This utility has been removed to lighten the application.
 * Redirecting back to the Decision Hub.
 */
export function ManifestDisplay() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/admin');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center p-12 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em]">
                Redirecting to Hub...
            </p>
        </div>
    );
}
