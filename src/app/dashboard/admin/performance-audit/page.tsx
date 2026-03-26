'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * PERFORMANCE AUDIT (DECOMMISSIONED)
 * Purged to reduce application bundle weight.
 */
export default function PerformanceRemoved() {
    const router = useRouter();
    useEffect(() => { router.replace('/dashboard/admin'); }, [router]);
    return <div className="flex h-screen items-center justify-center opacity-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
}
