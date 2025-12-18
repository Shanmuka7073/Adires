'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, Store, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const restaurantLinks = [
    {
        title: 'my-store',
        description: 'manage-your-store-products-and-incoming-orders',
        href: '/dashboard/owner/my-store',
        icon: Store,
    },
    {
        title: 'store-orders',
        description: 'view-and-manage-live-orders-from-your-tables',
        href: '/dashboard/owner/orders',
        icon: ShoppingCart,
    }
];

export default function RestaurantDashboardPage() {
    const { isRestaurantOwner, isLoading } = useAdminAuth();
    const router = useRouter();

    useEffect(() => {
        if (!isLoading && !isRestaurantOwner) {
            router.replace('/dashboard');
        }
    }, [isLoading, isRestaurantOwner, router]);
    
    if (isLoading) {
        return <div className="container mx-auto py-12">Loading dashboard...</div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">Restaurant Dashboard</h1>
                <p className="text-lg text-muted-foreground mt-2">Manage your restaurant's digital operations.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {restaurantLinks.map((card) => (
                    <Link href={card.href} key={card.href} className="group block rounded-lg overflow-hidden h-full">
                        <Card className="h-full flex flex-col transition-all group-hover:shadow-xl group-hover:-translate-y-1">
                            <CardHeader>
                                <CardTitle className="text-xl font-bold font-headline flex items-center gap-2">
                                    <card.icon className="h-6 w-6 text-primary" />
                                    {t(card.title)}
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-between">
                                <CardDescription>{t(card.description)}</CardDescription>
                                <div className="flex items-center text-primary font-semibold mt-4">
                                    <span>{t('go-to')} {t(card.title)}</span>
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    );
}
