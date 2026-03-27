
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
    CheckCircle2,
    Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type { Store as StoreType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useInstall } from '@/components/install-provider';
import { OnboardingChatbot } from '@/components/features/onboarding-chatbot';

export default function ServiceDashboardPage() {
    const { user, firestore } = useFirebase();
    const { isRestaurantOwner, isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    const { stores, userStore, fetchUserStore, isInitialized } = useAppStore();
    const { canInstall, triggerInstall } = useInstall();

    // Check for existing store in global state or current fetch
    const store = useMemo(() => {
        if (userStore) return userStore;
        return stores.find(s => s.ownerId === user?.uid);
    }, [userStore, stores, user?.uid]);

    useEffect(() => {
        if (!isLoading) {
            if (!user) {
                router.replace('/login?redirectTo=/dashboard/restaurant');
            } else if (!isRestaurantOwner && !isAdmin) {
                router.replace('/dashboard');
            }
        }
    }, [isLoading, user, isRestaurantOwner, isAdmin, router]);

    useEffect(() => {
        if (firestore && user && !store && isInitialized) {
            fetchUserStore(firestore, user.uid);
        }
    }, [firestore, user, store, isInitialized, fetchUserStore]);

    const { dashboardTitle, DashboardIcon, serviceLinks } = useMemo(() => {
        const isSalon = store?.businessType === 'salon';
        
        const links = [
            { title: 'MY STORE', description: 'Manage products & orders', href: '/dashboard/owner/my-store', icon: Store },
            { title: isSalon ? 'BOOKINGS' : 'STORE ORDERS', description: isSalon ? 'Live appointments' : 'Live table orders', href: isSalon ? '/dashboard/owner/bookings' : '/dashboard/owner/orders', icon: ShoppingBag },
            { title: 'ANALYTICS', description: 'Sales & profit insights', href: '/dashboard/owner/sales-report', icon: BarChart3, highlight: true },
            { title: 'OFFLINE AUDIT', description: 'Device sync status', href: '/dashboard/offline-audit', icon: WifiOff },
            { title: 'EMPLOYEES', description: 'Manage staff', href: '/dashboard/owner/employees', icon: Users },
            { title: 'SALARY', description: 'Salary reports', href: '/dashboard/owner/salary', icon: FileText }
        ];

        if (isSalon) return { dashboardTitle: 'Salon Hub', DashboardIcon: Scissors, serviceLinks: links };
        return { dashboardTitle: 'Restaurant Hub', DashboardIcon: Utensils, serviceLinks: links };
    }, [store]);

    if (isLoading) {
        return (
            <div className="h-[80vh] flex flex-col items-center justify-center gap-4">
                <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Verifying Authority...</p>
            </div>
        );
    }

    if (!user || (!isRestaurantOwner && !isAdmin)) {
        return null;
    }

    // IF NO STORE EXISTS: Show the Onboarding Assistant
    if (!store && isInitialized) {
        return (
            <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8 animate-in fade-in duration-700">
                <div className="text-center space-y-2">
                    <h1 className="text-4xl font-black font-headline tracking-tighter uppercase italic text-gray-950">Welcome Partner</h1>
                    <p className="text-muted-foreground font-bold text-[10px] tracking-widest uppercase opacity-40">Let's launch your digital storefront</p>
                </div>
                
                <OnboardingChatbot onComplete={(newStoreId) => {
                    if (firestore && user) fetchUserStore(firestore, user.uid);
                }} />

                <div className="p-6 rounded-[2.5rem] bg-white border-2 border-black/5 shadow-sm flex items-start gap-4">
                    <div className="h-10 w-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shrink-0">
                        <Sparkles className="h-5 w-5" />
                    </div>
                    <div className="space-y-1">
                        <h3 className="font-black uppercase text-[10px] tracking-tight">AI Assisted Setup</h3>
                        <p className="text-[10px] font-bold text-gray-500 leading-relaxed uppercase">
                            Simply answer a few questions to generate your store profile, set your GPS location, and add your first products.
                        </p>
                    </div>
                </div>
            </div>
        );
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
