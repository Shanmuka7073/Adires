
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * PRODUCT LIST PAGE (DECOMMISSIONED)
 * This feature has been removed as part of the grocery/voice catalog purge.
 * Admins are automatically redirected back to the Decision Hub.
 */
export default function ProductListDecommissioned() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/admin');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em]">
                Redirecting to Hub...
            </p>
        </div>
    );
}
