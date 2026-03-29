'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * REDUNDANT ROUTE
 * Merchant hub has been consolidated into the primary /dashboard route.
 * Redirecting to ensure stability.
 */
export default function RedundantMerchantDashboardPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard');
    }, [router]);

    return (
        <div className="flex h-screen items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary opacity-20" />
        </div>
    );
}
