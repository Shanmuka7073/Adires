
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * DESKTOP DASHBOARD PAGE (DECOMMISSIONED)
 * This page was part of the legacy grocery-only catalog.
 * Redirecting users to the main dashboard.
 */
export default function DesktopDashboardDecommissioned() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard');
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
