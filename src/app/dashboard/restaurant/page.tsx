
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    ArrowRight, 
    Store, 
    ShoppingBag, 
    CheckCircle, 
    XCircle, 
    Users, 
    FileText, 
    Scissors, 
    Utensils, 
    Loader2, 
    BarChart3, 
    LayoutGrid, 
    Sparkles, 
    WifiOff, 
    Download, 
    Smartphone,
    Database,
    Pencil
} from 'lucide-react';
import Link from 'next/link';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useLayoutEffect, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store as StoreType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useInstall } from '@/components/install-provider';

const serviceLinks = [
    {
        title: 'MY STORE',
        description: 'Manage store-products and incoming orders.',
        href: '/dashboard/owner/my-store',
        icon: Store,
    },
    {
        title: 'STORE ORDERS',
        description: 'View and manage live orders from your tables',
        href: '/dashboard/owner/orders',
        icon: ShoppingBag,
        showStats: true,
    },
    {
        title: 'ANALYTICS HUB',
        description: 'Deep-dive into sales, profit margins, and cost drivers.',
        href: '/dashboard/owner/sales-report',
        icon: BarChart3,
        highlight: true,
        badge: 'NEW & PRO'
    },
    {
        title: 'OFFLINE SYNC AUDIT',
        description: 'Check if your device is ready for call-first operations.',
        href: '/dashboard/offline-audit',
        icon: WifiOff,
        variant: 'warning',
        showStats: true
    },
    {
        title: 'MANAGE EMPLOYEES',
        description: 'Manage staff roles and access levels.',
        href: '/dashboard/owner/employees',
        icon: Users,
    },
    {
        title: 'SALARY REPORTS',
        description: 'Generate and distribute monthly salary slips.',
        href: '/dashboard/owner/salary',
        icon: FileText,
    }
];

function UsageBadge() {
    const { readCount, writeCount } = useAppStore();
    return (
        <div className="bg-gray-900 text-white text-[8px] font-black uppercase tracking-widest rounded-full px-2.5 py-1 flex items-center gap-2 shadow-lg">
            <div className="flex items-center gap-1">
                <Database className="h-2.5 w-2.5 text-primary" />
                <span>R: {readCount}</span>
            </div>
            <div className="flex items-center gap-1">
                <Pencil className="h-2.5 w-2.5 text-amber-500" />
                <span>W: {writeCount}</span>
            </div>
        </div>
    )
}

function PWAChecklist({ store }: { store: StoreType }) {
    const checklistItems = [
        { label: 'Store name', completed: !!store.name },
        { label: 'Description', completed: !!store.description && store.description.length > 10 },
        { label: 'Upload logo', completed: !!store.imageUrl },
    ];

    const allComplete = checklistItems.every(item => item.completed);

    return (
        <Card className="bg-green-50 border-0 rounded-[2.5rem] shadow-lg mb-8 overflow-hidden">
            <CardHeader className="pb-4">
                <CardTitle className="text-sm font-black uppercase tracking-widest text-green-900">PWA READINESS</CardTitle>
                <CardDescription className="text-[10px] font-bold text-green-800/40 uppercase tracking-tight">
                    Enable native install for your customers
                </CardDescription>
            </CardHeader>
            <CardContent>
                <ul className="space-y-2">
                    {checklistItems.map((item, index) => (
                        <li key={index} className="flex items-center gap-3">
                            {item.completed ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                            ) : (
                                <div className="h-4 w-4 rounded-full border-2 border-red-200" />
                            )}
                            <span className={cn("text-[11px] font-bold uppercase tracking-tight", item.completed ? 'text-green-800/40' : 'text-green-900')}>
                                {item.label}
                            </span>
                        </li>
                    ))}
                </ul>
                {!allComplete && (
                     <Button asChild variant="link" className="mt-4 p-0 h-auto font-black uppercase text-[9px] tracking-[0.2em] text-primary">
                        <Link href="/dashboard/owner/my-store">Complete Setup <ArrowRight className="ml-1 h-2.5 w-2.5" /></Link>
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

    const storeQuery = useMemoFirebase(() => {
        if (!user || !isRestaurantOwner || !firestore) return null;
        return query(collection(firestore, 'stores'), where('ownerId', '==', user.uid));
    }, [user, isRestaurantOwner, firestore]);

    const { data: stores, isLoading: isStoreLoading } = useCollection<StoreType>(storeQuery);
    const store = useMemo(() => userStore || stores?.[0], [userStore, stores]);

    const isLoading = isAuthLoading || isStoreLoading;

    useLayoutEffect(() => {
        if (!isLoading && !isRestaurantOwner) {
            router.replace('/dashboard');
        }
    }, [isLoading, isRestaurantOwner, router]);
    
    const { dashboardTitle, DashboardIcon } = useMemo(() => {
        if (!store) return { dashboardTitle: 'Business Hub', DashboardIcon: Store };
        if (store.businessType === 'salon') return { dashboardTitle: 'Salon Hub', DashboardIcon: Scissors };
        return { dashboardTitle: 'Restaurant Hub', DashboardIcon: Utensils };
    }, [store]);

    if (isLoading || !isRestaurantOwner) {
        return <div className="container mx-auto py-12 text-center h-[80vh] flex items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /></div>;
    }

    return (
        <div className="container mx-auto py-8 px-4 md:px-6 max-w-2xl space-y-10 pb-32">
            {/* HERO SECTION */}
            <div className="flex flex-col items-center text-center gap-4">
                <div className="h-20 w-20 rounded-[2rem] bg-primary/5 flex items-center justify-center text-primary shadow-inner">
                    <DashboardIcon className="h-10 w-10" />
                </div>
                <div>
                    <h1 className="text-4xl font-black tracking-tighter text-gray-950 uppercase italic leading-none">{dashboardTitle}</h1>
                    <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.3em] mt-2 opacity-40">Operational Authority</p>
                </div>
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-4 py-2 rounded-full border border-green-100">
                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                    Status: Online
                </div>
            </div>

            {/* MODULE CARDS */}
            <div className="grid grid-cols-1 gap-6">
                {serviceLinks.map((card) => (
                    <Link href={card.href} key={card.href} className="group block">
                        <Card className={cn(
                            "rounded-[2.5rem] border-0 shadow-lg overflow-hidden transition-all group-hover:shadow-2xl group-active:scale-[0.98] bg-white",
                            card.highlight && "bg-primary/5 ring-2 ring-primary/10"
                        )}>
                            <div className="p-8">
                                <div className="flex justify-between items-start mb-6">
                                    <div className={cn(
                                        "h-14 w-14 rounded-2xl flex items-center justify-center shadow-inner",
                                        card.highlight ? "bg-primary text-white" : "bg-primary/5 text-primary"
                                    )}>
                                        <card.icon className="h-7 w-7" />
                                    </div>
                                    {card.badge && (
                                        <Badge className="bg-primary text-white border-0 font-black text-[8px] uppercase px-3 py-1 tracking-widest rounded-lg">
                                            {card.badge}
                                        </Badge>
                                    )}
                                </div>
                                
                                <div className="space-y-1">
                                    <h3 className="text-xl font-black uppercase tracking-tight text-gray-950">{card.title}</h3>
                                    <p className="text-[11px] font-bold text-gray-500 uppercase leading-tight opacity-60 max-w-[80%]">{card.description}</p>
                                </div>

                                <div className="mt-8 flex justify-between items-center">
                                    <div className="flex items-center text-primary font-black uppercase text-[10px] tracking-[0.2em]">
                                        <span>Enter Module</span>
                                        <ArrowRight className="ml-2 h-3.5 w-3.5" />
                                    </div>
                                    {card.showStats && <UsageBadge />}
                                </div>
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* SECONDARY TOOLS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                {store && <PWAChecklist store={store} />}
                
                <Card className="rounded-[2.5rem] border-0 shadow-lg bg-white p-8 flex flex-col justify-center items-center text-center gap-4 group">
                    <div className="h-12 w-12 rounded-2xl bg-black/5 flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Smartphone className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black uppercase tracking-tight">SYNC DIAGNOSTICS</h3>
                        <p className="text-[9px] font-bold text-gray-400 uppercase mt-1 leading-tight px-4 tracking-tighter">Ensure device identity persistence</p>
                    </div>
                    <Button asChild variant="outline" className="rounded-xl font-black text-[9px] uppercase tracking-widest border-2 h-10 w-full shadow-sm">
                        <Link href="/dashboard/offline-audit">Open Sync Center</Link>
                    </Button>
                </Card>
            </div>

            {/* INSTALL BANNER */}
            {canInstall && (
                <Card className="rounded-[2.5rem] border-0 shadow-xl bg-gray-950 text-white p-8 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 transition-transform group-hover:rotate-45 duration-700">
                        <Smartphone className="h-32 w-32" />
                    </div>
                    <div className="relative z-10 space-y-6">
                        <div>
                            <h2 className="text-2xl font-black tracking-tighter uppercase italic leading-none">Install Pro Shell</h2>
                            <p className="font-bold opacity-40 text-[9px] uppercase tracking-widest mt-2">Get the verified desktop experience on mobile</p>
                        </div>
                        <Button 
                            onClick={triggerInstall}
                            className="rounded-xl h-12 px-8 bg-white text-gray-950 hover:bg-white/90 font-black uppercase tracking-widest text-[10px] shadow-2xl transition-all"
                        >
                            <Download className="mr-2 h-4 w-4" />
                            Launch Installation
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
