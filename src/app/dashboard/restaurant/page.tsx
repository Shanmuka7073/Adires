
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * DECOMMISSIONED ROUTE
 * The Merchant Hub has been consolidated into the primary /dashboard route.
 * This file is kept as a stub to resolve legacy bookmarks and redirects to the new hub.
 */
export default function MerchantRedirectionPage() {
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
