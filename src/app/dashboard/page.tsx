
'use client';

import { Card } from '@/components/ui/card';
import { ArrowRight, ShoppingCart, Store, Truck, UserCheck, FileText, Loader2, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { getProductImage } from '@/lib/data';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { cn } from '@/lib/utils';

const allRoleCards = [
    {
        title: 'start-shopping',
        description: 'browse-local-stores-and-find-fresh-groceries',
        href: '/stores', 
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
    if (isLoading || !image) {
        return <Skeleton className="h-full w-full min-h-[200px] rounded-[2rem]" />;
    }

    return (
        <Link href={card.href} className="group block h-full">
            <Card className="h-full rounded-[2rem] border-0 shadow-lg flex flex-col transition-all group-hover:shadow-2xl group-active:scale-95 overflow-hidden">
                <div className="relative h-32 xs:h-40 w-full shrink-0">
                    <Image 
                        src={image.imageUrl} 
                        alt={t(card.title)} 
                        fill 
                        className="object-cover"
                        data-ai-hint={image.imageHint}
                    />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                        <h3 className="text-xl font-black font-headline uppercase tracking-tight text-gray-950 leading-none mb-2">{t(card.title)}</h3>
                        <p className="text-[11px] font-bold text-gray-500 uppercase tracking-tight leading-tight">{t(card.description)}</p>
                    </div>
                    <div className="flex items-center text-primary font-black uppercase text-[10px] tracking-widest mt-6">
                        <span>Enter Section</span>
                        <ArrowRight className="ml-2 h-3 w-3" />
                    </div>
                </div>
            </Card>
        </Link>
    )
}

export default function DashboardPage() {
    const [images, setImages] = useState<Record<string, { imageUrl: string; imageHint: string }>>({});
    const [loadingImages, setLoadingImages] = useState(true);
    const { isRestaurantOwner, isEmployee, isAdmin, isLoading, user } = useAdminAuth();
    const isUserDataLoaded = useAppStore(state => state.isUserDataLoaded);
    const router = useRouter();

    const roleCards = useMemo(() => {
        if (isEmployee) {
            return allRoleCards.filter(card => card.title === 'employee' || card.title === 'salary-slips');
        }
        return allRoleCards.filter(card => card.title !== 'employee' && card.title !== 'salary-slips');
    }, [isEmployee]);

    useEffect(() => {
        if (!isLoading && isUserDataLoaded && user) {
            if (isAdmin) {
                router.replace('/dashboard/admin');
            } else if (isRestaurantOwner) {
                router.replace('/dashboard/restaurant');
            }
        }
    }, [isLoading, isUserDataLoaded, isRestaurantOwner, isAdmin, user, router]);

    useEffect(() => {
        if (!isLoading && !isRestaurantOwner && !isAdmin) {
            const fetchImages = async () => {
                const imagePromises = roleCards.map(card => getProductImage(card.imageId));
                const resolvedImages = await Promise.all(imagePromises);
                const imageMap = roleCards.reduce((acc, card, index) => {
                    acc[card.imageId] = resolvedImages[index];
                    return acc;
                }, {} as Record<string, { imageUrl: string; imageHint: string }>);
                setImages(imageMap);
                setLoadingImages(false);
            };
            fetchImages();
        }
    }, [isLoading, isRestaurantOwner, isAdmin, roleCards]);
    
    if (isLoading || !isUserDataLoaded) {
        return (
            <div className="container mx-auto py-12 text-center flex flex-col items-center justify-center gap-4 h-[60vh]">
                <Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Identifying Role...</p>
            </div>
        );
    }

    // Prevents flicker during redirect
    if (user && (isRestaurantOwner || isAdmin)) return null;

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-6xl pb-24 md:pb-10">
            <div className="text-center mb-10 space-y-2">
                <h1 className="text-4xl font-black font-headline tracking-tighter uppercase italic">{t('your-dashboard')}</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">{t('select-your-role-to-access-your-tools')}</p>
            </div>
            <div className={cn(
                "grid grid-cols-1 gap-6 max-w-5xl mx-auto",
                isEmployee ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"
            )}>
                {roleCards.map((card) => (
                    <RoleCard 
                        key={card.title} 
                        card={card} 
                        image={images[card.imageId]} 
                        isLoading={loadingImages}
                    />
                ))}
            </div>
        </div>
    );
}
