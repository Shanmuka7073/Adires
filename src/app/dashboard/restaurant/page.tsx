
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, Store, ShoppingBag, CheckCircle, XCircle, Users, FileText, Scissors, Utensils, Loader2, BarChart3 } from 'lucide-react';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store as StoreType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';

const serviceLinks = [
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
        icon: ShoppingBag,
    },
    {
        title: 'Sales Report',
        description: 'View detailed sales and profitability analytics.',
        href: '/dashboard/owner/sales-report',
        icon: BarChart3,
    },
    {
        title: 'Manage Employees',
        description: 'Add new employees and manage their roles.',
        href: '/dashboard/owner/employees',
        icon: Users,
    },
    {
        title: 'Salary Reports',
        description: 'View attendance records and generate salary slips.',
        href: '/dashboard/owner/salary',
        icon: FileText,
    }
];

function PWAChecklist({ store }: { store: StoreType }) {
    const checklistItems = [
        { label: 'Set a Store Name', completed: !!store.name },
        { label: 'Add a Store Description', completed: !!store.description && store.description.length > 10 },
        { label: 'Upload a Store Image/Logo', completed: !!store.imageUrl },
    ];

    const allComplete = checklistItems.every(item => item.completed);

    return (
        <Card className="mt-8 bg-green-50 border-green-200 rounded-[2rem]">
            <CardHeader>
                <CardTitle>PWA (Installable App) Readiness</CardTitle>
                <CardDescription>
                    Complete these steps to allow customers to add your business to their home screen like a native app.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3">
                    {checklistItems.map((item, index) => (
                        <li key={index} className="flex items-center gap-3">
                            {item.completed ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                            )}
                            <span className={item.completed ? 'text-muted-foreground line-through' : 'font-semibold'}>
                                {item.label}
                            </span>
                        </li>
                    ))}
                </ul>
                {!allComplete && (
                     <Link href="/dashboard/owner/my-store" passHref>
                        <button className="mt-4 text-sm font-semibold text-primary hover:underline">
                            Go to "My Store" to complete setup →
                        </button>
                    </Link>
                )}
            </CardContent>
        </Card>
    )
}

export default function ServiceDashboardPage() {
    const { user } = useFirebase();
    const { isRestaurantOwner, isLoading: isAuthLoading } = useAdminAuth();
    const router = useRouter();
    const { firestore } = useFirebase();
    const { userStore } = useAppStore();

    const storeQuery = useMemoFirebase(() => 
        user && isRestaurantOwner ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid)) : null
    , [user, isRestaurantOwner, firestore]);

    const { data: stores, isLoading: isStoreLoading } = useCollection<StoreType>(storeQuery);
    const store = useMemo(() => userStore || stores?.[0], [userStore, stores]);

    const isLoading = isAuthLoading || isStoreLoading;

    useLayoutEffect(() => {
        if (!isLoading && !isRestaurantOwner) {
            router.replace('/dashboard');
        }
    }, [isLoading, isRestaurantOwner, router]);
    
    if (isLoading || !isRestaurantOwner) {
        return <div className="container mx-auto py-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;
    }

    const isSalon = store?.businessType === 'salon' || store?.name.toLowerCase().includes('salon');
    const dashboardTitle = isSalon ? 'Salon Dashboard' : 'Restaurant Dashboard';
    const dashboardIcon = isSalon ? Scissors : Utensils;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="text-center mb-12">
                <div className="flex items-center justify-center gap-3 mb-2">
                    <dashboardIcon className="h-10 w-10 text-primary" />
                    <h1 className="text-4xl font-black font-headline tracking-tighter uppercase">{dashboardTitle}</h1>
                </div>
                <p className="text-lg text-muted-foreground font-bold opacity-60">Manage your business's digital operations.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                {serviceLinks.map((card) => (
                    <Link href={card.href} key={card.href} className="group block rounded-[2.5rem] overflow-hidden h-full">
                        <Card className="h-full flex flex-col transition-all group-hover:shadow-xl group-hover:-translate-y-1 border-0 shadow-lg">
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
             <div className="max-w-4xl mx-auto mt-8">
                {store ? <PWAChecklist store={store} /> : <Skeleton className="h-48 w-full mt-8 rounded-[2rem]" />}
            </div>
        </div>
    );
}
