'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, ShoppingCart, Store, Truck, UserCheck, FileText } from 'lucide-react';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { getProductImage } from '@/lib/data';
import { useEffect, useState, useLayoutEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

const allRoleCards = [
    {
        title: 'start-shopping',
        description: 'browse-local-stores-and-find-fresh-groceries',
        href: '/stores/beverages', 
        icon: ShoppingCart,
        imageId: 'dash-shopping'
    },
    {
        title: 'store-owner',
        description: 'manage-your-store-products-and-incoming-orders',
        href: '/dashboard/owner/my-store',
        icon: Store,
        imageId: 'dash-owner'
    },
    {
        title: 'delivery-partner',
        description: 'view-and-accept-available-delivery-jobs',
        href: '/dashboard/delivery/deliveries',
        icon: Truck,
        imageId: 'dash-delivery'
    },
    {
        title: 'employee',
        description: 'punch-in-and-out-for-your-shift',
        href: '/dashboard/employee/attendance',
        icon: UserCheck,
        imageId: 'dash-delivery'
    },
    {
        title: 'salary-slips',
        description: 'view-and-download-your-monthly-salary-slips',
        href: '/dashboard/employee/salary-slips',
        icon: FileText,
        imageId: 'dash-owner'
    }
];

function RoleCard({ card, image, isLoading }: { card: any, image: any, isLoading: boolean }) {
    const firstStoreId = useAppStore((state) => state.stores[0]?.id);
    const href = card.href.startsWith('/stores/') && firstStoreId 
        ? `/stores/${firstStoreId}?category=${card.href.split('/')[2]}` 
        : card.href;

    if (isLoading || !image) {
        return <Skeleton className="h-full w-full min-h-[250px]" />;
    }

    return (
        <Link href={href} className="group block rounded-lg overflow-hidden h-full">
            <Card className="h-full flex flex-col transition-all group-hover:shadow-xl group-hover:-translate-y-1">
                <div className="relative h-40 w-full">
                    <Image 
                        src={image.imageUrl} 
                        alt={t(card.title)} 
                        fill 
                        className="object-cover"
                        data-ai-hint={image.imageHint}
                    />
                </div>
                <CardHeader>
                    <CardTitle className="text-xl font-bold font-headline">{t(card.title)}</CardTitle>
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
    )
}

export default function DashboardPage() {
    const [images, setImages] = useState<Record<string, { imageUrl: string; imageHint: string }>>({});
    const [loading, setLoading] = useState(true);
    const { isRestaurantOwner, isEmployee, isLoading: isRoleLoading } = useAdminAuth();
    const router = useRouter();

    const roleCards = useMemo(() => {
        if (isEmployee) {
            return allRoleCards.filter(card => card.title === 'employee' || card.title === 'salary-slips');
        }
        return allRoleCards.filter(card => card.title !== 'employee' && card.title !== 'salary-slips');
    }, [isEmployee]);

    useLayoutEffect(() => {
        if (!isRoleLoading && isRestaurantOwner) {
            router.replace('/dashboard/restaurant');
        }
    }, [isRoleLoading, isRestaurantOwner, router]);

    useEffect(() => {
        if (!isRoleLoading && !isRestaurantOwner) {
            const fetchImages = async () => {
                const imagePromises = roleCards.map(card => getProductImage(card.imageId));
                const resolvedImages = await Promise.all(imagePromises);
                const imageMap = roleCards.reduce((acc, card, index) => {
                    acc[card.imageId] = resolvedImages[index];
                    return acc;
                }, {} as Record<string, { imageUrl: string; imageHint: string }>);
                setImages(imageMap);
                setLoading(false);
            };
            fetchImages();
        }
    }, [isRoleLoading, isRestaurantOwner, roleCards]);
    
    if (isRoleLoading || isRestaurantOwner) {
        return (
            <div className="container mx-auto py-12 text-center">
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    const gridCols = isEmployee ? 'lg:grid-cols-2' : 'lg:grid-cols-3';

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">{t('your-dashboard')}</h1>
                <p className="text-lg text-muted-foreground mt-2">{t('select-your-role-to-access-your-tools')}</p>
            </div>
            <div className={`grid grid-cols-1 md:grid-cols-2 ${gridCols} gap-8 max-w-6xl mx-auto`}>
                {roleCards.map((card) => (
                    <RoleCard 
                        key={card.title} 
                        card={card} 
                        image={images[card.imageId]} 
                        isLoading={loading}
                    />
                ))}
            </div>
        </div>
    );
}
