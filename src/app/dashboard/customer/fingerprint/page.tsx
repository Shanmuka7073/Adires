'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

/**
 * FINGERPRINT REGISTRATION PAGE (REMOVED)
 * Biometric functionality has been disabled.
 * Redirecting users back to the profile page.
 */
export default function FingerprintRemovedPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/customer/my-profile');
    }, [router]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center space-y-4">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
            <p className="text-muted-foreground font-bold uppercase text-xs tracking-widest">
                Redirecting to profile...
            </p>
        </div>
    );
}
