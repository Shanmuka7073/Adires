'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * IMAGE MANAGEMENT (DECOMMISSIONED)
 * Purged to resolve bundle weight issues (288 KB).
 */
export default function ImageManagementRemoved() {
    const router = useRouter();
    useEffect(() => { router.replace('/dashboard/admin'); }, [router]);
    return <div className="flex h-screen items-center justify-center opacity-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
}
