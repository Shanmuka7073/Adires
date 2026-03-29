'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import GlobalLoader from '@/components/layout/global-loader';

/**
 * CENTRAL REDIRECTION HUB
 * Routes users to their specific operational dashboards based on confirmed role.
 * Waits for isUserDataLoaded to prevent "identity flickering" and redirect loops.
 */
export default function DashboardRedirectPage() {
    const { isAdmin, isRestaurantOwner, isCustomer, isLoading, user } = useAdminAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        if (!user) {
            router.replace('/login');
            return;
        }

        if (isAdmin) {
            router.replace('/dashboard/admin');
        } else if (isRestaurantOwner) {
            router.replace('/dashboard/restaurant');
        } else {
            // Personal accounts go home directly
            router.replace('/');
        }
    }, [isLoading, isAdmin, isRestaurantOwner, isCustomer, user, router]);

    return <GlobalLoader />;
}
