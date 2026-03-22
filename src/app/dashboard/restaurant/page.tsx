
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowRight, Store, ShoppingBag, CheckCircle, XCircle, Users, FileText, Scissors, Utensils, Loader2, BarChart3, LayoutGrid, Sparkles, WifiOff, Download, Smartphone } from 'lucide-react';
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
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useInstall } from '@/components/install-provider';

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
        title: 'Advanced Analytics',
        description: 'Deep-dive into sales, profit margins, and cost drivers.',
        href: '/dashboard/owner/sales-report',
        icon: BarChart3,
        highlight: true,
    },
    {
        title: 'Offline Sync Audit',
        description: 'Check if your device is ready for local-first operations.',
        href: '/dashboard/offline-audit',
        icon: WifiOff,
        variant: 'warning'
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
        <Card className="bg-green-50 border-green-200 rounded-[2.5rem] shadow-inner">
            <CardHeader>
                <CardTitle className="text-xl font-black uppercase tracking-tight text-green-900">PWA Readiness</CardTitle>
                <CardDescription className="font-bold text-green-800/60">
                    Allow customers to "Install" your restaurant on their phone.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-3">
                    {checklistItems.map((item, index) => (
                        <li key={index} className="flex items-center gap-3">
                            {item.completed ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                            ) : (
                                <XCircle className="h-5 w-5 text-red-400" />
                            )}
                            <span className={cn("text-xs font-black uppercase tracking-tight", item.completed ? 'text-green-800/40 line-through' : 'text-green-900')}>
                                {item.label}
                            </span>
                        </li>
                    ))}
                </ul>
                {!allComplete && (
                     <Button asChild variant="link" className="mt-4 p-0 h-auto font-black uppercase text-[10px] tracking-widest text-primary">
                        <Link href="/dashboard/owner/my-store">Complete Setup <ArrowRight className="ml-1 h-3 w-3" /></Link>
                    </Button>
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
    const { canInstall, triggerInstall } = useInstall();

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
    
    const { isSalon, dashboardTitle, DashboardIcon } = useMemo(() => {
        if (!store) return { isSalon: false, isRestaurant: false, dashboardTitle: 'Business Dashboard', DashboardIcon: Store };
        if (store.businessType === 'salon') return { isSalon: true, isRestaurant: false, dashboardTitle: 'Salon Hub', DashboardIcon: Scissors };
        if (store.businessType === 'restaurant') return { isSalon: false, isRestaurant: true, dashboardTitle: 'Restaurant Hub', DashboardIcon: Utensils };
        return { isSalon: false, isRestaurant: false, dashboardTitle: 'Owner Hub', DashboardIcon: LayoutGrid };
    }, [store]);

    if (isLoading || !isRestaurantOwner) {
        return <div className="container mx-auto py-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-6xl">
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5 mb-12">
                <div className="space-y-1">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            <DashboardIcon className="h-6 w-6" />
                        </div>
                        <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic leading-none">{dashboardTitle}</h1>
                    </div>
                    <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">OPERATIONAL AUTHORITY</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    Business Status: Online
                </div>
            </div>

            {/* Prominent Installation Card (Outside Menu) */}
            {canInstall && (
                <Card className="rounded-[2.5rem] border-0 shadow-2xl bg-primary text-white p-8 relative overflow-hidden group mb-12">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 transition-transform group-hover:rotate-45 duration-700">
                        <Smartphone className="h-32 w-32" />
                    </div>
                    <div className="relative z-10 space-y-6">
                        <div>
                            <h2 className="text-3xl font-black uppercase tracking-tighter italic">Install Adires POS</h2>
                            <p className="font-bold opacity-80 text-xs uppercase tracking-widest mt-1">Get the high-performance native app experience</p>
                        </div>
                        <Button 
                            onClick={triggerInstall}
                            className="rounded-2xl h-14 px-8 bg-white text-primary hover:bg-white/90 font-black uppercase tracking-widest text-[10px] shadow-2xl active:scale-95 transition-all"
                        >
                            <Download className="mr-2 h-5 w-5" />
                            Install Now
                        </Button>
                    </div>
                </Card>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {serviceLinks.map((card) => (
                    <Link href={card.href} key={card.href} className="group h-full">
                        <Card className={cn(
                            "h-full rounded-[2.5rem] border-0 shadow-lg transition-all group-hover:shadow-2xl group-hover:-translate-y-1 overflow-hidden",
                            card.highlight ? "bg-primary/5 ring-2 ring-primary/20" : 
                            card.variant === 'warning' ? "bg-amber-50 border-amber-200 border-2" : "bg-white"
                        )}>
                            <CardHeader className="p-8">
                                <div className="flex justify-between items-start">
                                    <div className={cn(
                                        "h-14 w-14 rounded-2xl flex items-center justify-center transition-colors shadow-inner",
                                        card.highlight ? "bg-primary text-white" : 
                                        card.variant === 'warning' ? "bg-amber-500 text-white" : "bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white"
                                    )}>
                                        <card.icon className="h-7 w-7" />
                                    </div>
                                    {card.highlight && <Badge className="rounded-md font-black uppercase text-[8px] tracking-widest">New & Pro</Badge>}
                                </div>
                                <CardTitle className="text-xl font-black uppercase tracking-tight mt-6 leading-tight">
                                    {card.title === 'Advanced Analytics' ? 'Analytics Hub' : t(card.title)}
                                </CardTitle>
                                <CardDescription className="font-bold text-xs opacity-60 mt-2">
                                    {card.description}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="px-8 pb-8">
                                <div className="flex items-center text-primary font-black uppercase text-[10px] tracking-widest mt-4">
                                    <span>Enter Module</span>
                                    <ArrowRight className="ml-2 h-4 w-4" />
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

             <div className="max-w-4xl mx-auto mt-16 grid md:grid-cols-2 gap-8">
                {store ? <PWAChecklist store={store} /> : <Skeleton className="h-48 w-full rounded-[2.5rem]" />}
                <Card className="rounded-[2.5rem] border-0 shadow-lg bg-white p-8 flex flex-col justify-center gap-4">
                    <div className="flex items-center gap-3">
                        <WifiOff className="h-6 w-6 text-amber-500" />
                        <h3 className="font-black uppercase text-sm tracking-tight">Sync Diagnostics</h3>
                    </div>
                    <p className="text-xs font-bold text-gray-500 leading-relaxed uppercase">
                        Ensure your device is correctly registered for offline-first order processing.
                    </p>
                    <Button asChild variant="outline" className="rounded-xl font-black text-[9px] uppercase tracking-widest border-2 h-10 w-fit">
                        <Link href="/dashboard/offline-audit">Open Sync Center</Link>
                    </Button>
                </Card>
            </div>
        </div>
    );
}
