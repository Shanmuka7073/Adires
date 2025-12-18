'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, ShoppingCart, Store, Truck, Mic, Sparkles } from 'lucide-react';
import Link from 'next/link';
import { t } from '@/lib/locales';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useEffect, useState, useLayoutEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';

const roleCards = [
    {
        title: 'start-shopping',
        description: 'browse-local-stores-and-find-fresh-groceries',
        href: '/stores/beverages', // Default to beverages category
        icon: ShoppingCart,
        imageId: 'dash-shopping'
    },
    {
        title: 'voice-order',
        description: 'record-your-shopping-list-and-have-a-local-shopkeeper-fulfill-it',
        href: '/checkout',
        icon: Mic,
        imageId: 'dash-voice'
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
    const { isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
    const router = useRouter();

    useLayoutEffect(() => {
        // This effect runs before the browser paints.
        // If the role is determined and it's a restaurant owner, redirect immediately.
        if (!isRoleLoading && isRestaurantOwner) {
            router.replace('/dashboard/restaurant');
        }
    }, [isRoleLoading, isRestaurantOwner, router]);

    useEffect(() => {
        // This effect runs only if the user is NOT a restaurant owner.
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
    }, [isRoleLoading, isRestaurantOwner]);

    // While role is loading OR if the user is a restaurant owner (and about to be redirected),
    // render nothing. This prevents any flickering.
    if (isRoleLoading || isRestaurantOwner) {
        return (
            <div className="container mx-auto py-12 text-center">
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">{t('your-dashboard')}</h1>
                <p className="text-lg text-muted-foreground mt-2">{t('select-your-role-to-access-your-tools')}</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
                {roleCards.map((card) => (
                    <RoleCard 
                        key={card.title} 
                        card={card} 
                        image={images[card.imageId]} 
                        isLoading={loading}
                    />
                ))}
            </div>
            <div className="mt-16 text-center">
                 <Card className="max-w-2xl mx-auto bg-primary/5 border-primary/20">
                    <CardHeader>
                        <CardTitle className="flex items-center justify-center gap-2 font-headline">
                             <Sparkles className="h-6 w-6 text-primary" />
                            <span>New: Voice ID Login</span>
                        </CardTitle>
                        <CardDescription>
                            Set up a voice password for a faster, more secure way to log in.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button asChild>
                            <Link href="/dashboard/customer/voice-id">
                                Set Up Your Voice ID
                            </Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
