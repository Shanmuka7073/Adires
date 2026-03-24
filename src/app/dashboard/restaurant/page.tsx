
'use client';

import { Card } from '@/components/ui/card';
import { 
    ArrowRight, 
    Store, 
    ShoppingBag, 
    Users, 
    FileText, 
    Scissors, 
    Utensils, 
    Loader2, 
    BarChart3, 
    WifiOff, 
    Download, 
    Smartphone,
    Database,
    Pencil
} from 'lucide-react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store as StoreType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useInstall } from '@/components/install-provider';

const serviceLinks = [
    { title: 'MY STORE', description: 'Manage products & orders', href: '/dashboard/owner/my-store', icon: Store },
    { title: 'STORE ORDERS', description: 'Manage live orders', href: '/dashboard/owner/orders', icon: ShoppingBag, showStats: true },
    { title: 'ANALYTICS', description: 'Sales & profit insights', href: '/dashboard/owner/sales-report', icon: BarChart3, highlight: true },
    { title: 'OFFLINE AUDIT', description: 'Device sync status', href: '/dashboard/offline-audit', icon: WifiOff, showStats: true },
    { title: 'EMPLOYEES', description: 'Manage staff', href: '/dashboard/owner/employees', icon: Users },
    { title: 'SALARY', description: 'Salary reports', href: '/dashboard/owner/salary', icon: FileText }
];

function UsageBadge() {
    const { readCount, writeCount } = useAppStore();
    return (
        <div className="bg-gray-900 text-white text-[8px] font-black uppercase tracking-widest rounded-full px-2 py-1 flex items-center gap-2 shadow-lg">
            <div className="flex items-center gap-1">
                <Database className="h-2.5 w-2.5 text-primary" />
                <span>R: {readCount}</span>
            </div>
            <div className="flex items-center gap-1">
                <Pencil className="h-2.5 w-2.5 text-amber-500" />
                <span>W: {writeCount}</span>
            </div>
        </div>
    );
}

export default function ServiceDashboardPage() {
    const { user, firestore } = useFirebase();
    const { isRestaurantOwner, isLoading } = useAdminAuth();
    const router = useRouter();
    const { userStore } = useAppStore();
    const { canInstall, triggerInstall } = useInstall();

    const storeQuery = useMemoFirebase(() => {
        if (!user || !isRestaurantOwner || !firestore) return null;
        return query(collection(firestore, 'stores'), where('ownerId', '==', user.uid));
    }, [user, isRestaurantOwner, firestore]);

    const { data: stores } = useCollection<StoreType>(storeQuery);
    const store = useMemo(() => userStore || stores?.[0], [userStore, stores]);

    useEffect(() => {
        if (!isLoading && user && !isRestaurantOwner) {
            router.replace('/dashboard');
        }
    }, [isLoading, user, isRestaurantOwner, router]);

    const { dashboardTitle, DashboardIcon } = useMemo(() => {
        if (!store) return { dashboardTitle: 'Business Hub', DashboardIcon: Store };
        if (store.businessType === 'salon') return { dashboardTitle: 'Salon Hub', DashboardIcon: Scissors };
        return { dashboardTitle: 'Restaurant Hub', DashboardIcon: Utensils };
    }, [store]);

    if (isLoading) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Verifying Authority...</p>
            </div>
        );
    }

    if (user && !isRestaurantOwner) {
        return null; // Redirect logic in useEffect
    }

    return (
        <div className="container mx-auto px-3 py-3 max-w-2xl space-y-3 pb-24 animate-in fade-in duration-500">

            {/* HEADER ROW - COMPACT */}
            <div className="flex items-center gap-3 border-b pb-3 border-black/5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <DashboardIcon className="h-5 w-5" />
                </div>

                <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-black uppercase tracking-tight truncate leading-none">
                        {dashboardTitle}
                    </h1>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                        Operational Control
                    </p>
                </div>

                <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2.5 py-1.5 rounded-full border border-green-100 shadow-sm">
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                    Online
                </div>
            </div>

            {/* MODULE LIST - HIGH DENSITY */}
            <div className="space-y-2">
                {serviceLinks.map((card) => (
                    <Link href={card.href} key={card.href} className="group block">
                        <Card className={cn(
                            "rounded-2xl border-0 shadow-sm transition-all active:scale-[0.98] bg-white border-2 border-transparent hover:border-primary/10",
                            card.highlight && "bg-primary/5 ring-1 ring-primary/10"
                        )}>
                            <div className="flex items-center gap-3 p-2.5">
                                <div className={cn(
                                    "h-9 w-9 rounded-xl flex items-center justify-center shadow-inner shrink-0",
                                    card.highlight ? "bg-primary text-white" : "bg-primary/5 text-primary"
                                )}>
                                    <card.icon className="h-4 w-4" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <h3 className="text-[11px] font-black uppercase tracking-tight text-gray-950 leading-none">
                                        {card.title}
                                    </h3>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1 leading-none truncate">
                                        {card.description}
                                    </p>
                                </div>

                                {card.showStats && <UsageBadge />}

                                <ArrowRight className="h-3.5 w-3.5 text-primary opacity-20 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>

            {/* INSTALL BANNER - COMPACT */}
            {canInstall && (
                <Card className="rounded-2xl bg-gray-950 text-white p-3 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-10 rotate-12 transition-transform group-hover:rotate-45 duration-700">
                        <Smartphone className="h-12 w-12" />
                    </div>

                    <div className="flex items-center justify-between relative z-10">
                        <div className="min-w-0">
                            <h2 className="text-[10px] font-black uppercase tracking-widest text-primary">Native Experience</h2>
                            <p className="text-[8px] font-bold opacity-40 uppercase tracking-tighter mt-0.5">Install the Adires Pro Shell</p>
                        </div>

                        <Button 
                            onClick={triggerInstall}
                            className="h-8 px-4 bg-white text-gray-950 text-[9px] font-black uppercase tracking-widest rounded-lg shadow-xl"
                        >
                            <Download className="mr-1.5 h-3 w-3" />
                            Install
                        </Button>
                    </div>
                </Card>
            )}

            {/* SYNC DIAGNOSTICS CARD - TIGHT */}
            <Card className="rounded-2xl border-0 shadow-sm bg-white p-3 flex items-center justify-between gap-4 group">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-black/5 flex items-center justify-center text-gray-400 group-hover:bg-primary/10 group-hover:text-primary transition-colors">
                        <Smartphone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-[10px] font-black uppercase tracking-tight text-gray-950 leading-none">Identity Sync</h3>
                        <p className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter mt-1">Audit device persistence</p>
                    </div>
                </div>
                <Button asChild variant="outline" className="rounded-lg font-black text-[8px] uppercase tracking-widest border-2 h-8 px-3 shrink-0">
                    <Link href="/dashboard/offline-audit">Open Audit</Link>
                </Button>
            </Card>

        </div>
    );
}
