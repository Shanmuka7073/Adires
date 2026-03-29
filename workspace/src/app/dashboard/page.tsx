'use client';

import { Card } from '@/components/ui/card';
import { ArrowRight, ShoppingCart, Store, Truck, Package, User as UserIcon, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { getProductImage } from '@/lib/data';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

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
    const { isMerchant, isAdmin, isLoading, user } = useAdminAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        if (user) {
            // If the user is an admin or a store owner, they belong in the operational dashboard
            if (isAdmin) {
                router.replace('/dashboard/admin');
            } else if (isMerchant) {
                router.replace('/dashboard/restaurant');
            }
        }
    }, [isLoading, isMerchant, isAdmin, user, router]);

    useEffect(() => {
        if (!isLoading && !isMerchant && !isAdmin) {
            const fetchImages = async () => {
                const imagePromises = allRoleCards.map(card => getProductImage(card.imageId));
                const resolvedImages = await Promise.all(imagePromises);
                const imageMap = allRoleCards.reduce((acc, card, index) => {
                    acc[card.imageId] = resolvedImages[index];
                    return acc;
                }, {} as Record<string, { imageUrl: string; imageHint: string }>);
                setImages(imageMap);
                setLoadingImages(false);
            };
            fetchImages();
        }
    }, [isLoading, isMerchant, isAdmin]);
    
    if (isLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    // Merchants are redirected away from this "Activity Hub" to their business tools
    if (user && (isMerchant || isAdmin)) return null;

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-6xl pb-24 md:pb-10">
            <div className="text-center mb-10 space-y-2">
                <h1 className="text-4xl font-black font-headline tracking-tighter uppercase italic">My Activity Hub</h1>
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">Personal Access Console</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
                <Link href="/dashboard/customer/my-orders" className="block group">
                    <Card className="p-6 rounded-[2rem] border-0 shadow-lg bg-white flex items-center justify-between group-hover:shadow-2xl transition-all">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                                <Package className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-black uppercase text-sm tracking-tight text-gray-950">My Orders</h3>
                                <p className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Active & Past Jobs</p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                    </Card>
                </Link>

                <Link href="/dashboard/customer/my-profile" className="block group">
                    <Card className="p-6 rounded-[2rem] border-0 shadow-lg bg-white flex items-center justify-between group-hover:shadow-2xl transition-all">
                        <div className="flex items-center gap-4">
                            <div className="h-12 w-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-inner">
                                <UserIcon className="h-6 w-6" />
                            </div>
                            <div>
                                <h3 className="font-black uppercase text-sm tracking-tight text-gray-950">My Profile</h3>
                                <p className="text-[9px] font-bold opacity-40 uppercase tracking-widest">Identity & Address</p>
                            </div>
                        </div>
                        <ArrowRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                    </Card>
                </Link>

                {allRoleCards.map((card) => (
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