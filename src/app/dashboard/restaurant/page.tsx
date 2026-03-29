
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
    Sparkles,
    ShoppingBasket,
    MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useInstall } from '@/components/install-provider';

export default function ServiceDashboardPage() {
    const { user, firestore, areServicesAvailable } = useFirebase();
    const { isRestaurantOwner, isAdmin, isLoading } = useAdminAuth();
    const router = useRouter();
    const { userStore, fetchUserStore, isInitialized, isUserDataLoaded } = useAppStore();
    const { canInstall, triggerInstall } = useInstall();
    const [hasFetched, setHasFetched] = useState(false);

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
        if (firestore && user?.uid && !userStore && isInitialized && !hasFetched) {
            setHasFetched(true);
            fetchUserStore(firestore, user.uid);
        }
    }, [firestore, user?.uid, userStore, isInitialized, fetchUserStore, hasFetched]);

    const { dashboardTitle, DashboardIcon, serviceLinks } = useMemo(() => {
        const isSalon = userStore?.businessType === 'salon';
        
        const links = [
            { title: 'MY STORE', description: 'Manage products & orders', href: '/dashboard/owner/my-store', icon: Store },
            { title: isSalon ? 'BOOKINGS' : 'STORE ORDERS', description: isSalon ? 'Live appointments' : 'Live table orders', href: isSalon ? '/dashboard/owner/bookings' : '/dashboard/owner/orders', icon: ShoppingBag },
            { title: 'MESSAGES', description: 'Customer support chat', href: '/chat', icon: MessageSquare },
            { title: 'ANALYTICS', description: 'Sales & profit insights', href: '/dashboard/owner/sales-report', icon: BarChart3, highlight: true },
            { title: 'OFFLINE AUDIT', description: 'Device sync status', href: '/dashboard/offline-audit', icon: WifiOff },
            { title: 'EMPLOYEES', description: 'Manage staff', href: '/dashboard/owner/employees', icon: Users },
            { title: 'SALARY', description: 'Salary reports', href: '/dashboard/owner/salary', icon: FileText }
        ];

        if (isSalon) return { dashboardTitle: 'Salon Hub', DashboardIcon: Scissors, serviceLinks: links };
        return { dashboardTitle: 'Restaurant Hub', DashboardIcon: Utensils, serviceLinks: links };
    }, [userStore]);

    if (isLoading || !isUserDataLoaded) {
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

    if (!userStore) {
        return (
            <div className="container mx-auto px-4 py-12 text-center space-y-6">
                <div className="h-20 w-20 rounded-[2.5rem] bg-amber-100 flex items-center justify-center text-amber-600 mx-auto">
                    <ShoppingBasket className="h-10 w-10" />
                </div>
                <div>
                    <h1 className="text-3xl font-black uppercase italic">Business Identity Required</h1>
                    <p className="text-sm font-bold opacity-40 uppercase tracking-widest mt-2">No active store profile found for this account.</p>
                </div>
                <Button asChild className="h-12 px-8 rounded-xl font-black uppercase tracking-widest text-[10px]">
                    <Link href="/dashboard/owner/my-store">Setup My Business</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-3 py-3 max-w-2xl space-y-3 pb-24 animate-in fade-in duration-500">
            <div className="flex items-center gap-3 border-b pb-3 border-black/5">
                <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                    <DashboardIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                    <h1 className="text-sm font-black uppercase tracking-tight truncate leading-none">{dashboardTitle}</h1>
                    <p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest mt-1">Operational Control</p>
                </div>
                <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-widest text-green-600 bg-green-50 px-2.5 py-1.5 rounded-full border border-green-100 shadow-sm">
                    <div className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                    Online
                </div>
            </div>

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
                                    <h3 className="text-[11px] font-black uppercase tracking-tight text-gray-950 leading-none">{card.title}</h3>
                                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mt-1 leading-none truncate">{card.description}</p>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-primary opacity-20 group-hover:opacity-100 transition-opacity shrink-0" />
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>

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
                        <Button onClick={triggerInstall} className="h-8 px-4 bg-white text-gray-950 text-[9px] font-black uppercase tracking-widest rounded-lg shadow-xl">
                            <Download className="mr-1.5 h-3 w-3" /> Install
                        </Button>
                    </div>
                </Card>
            )}
        </div>
    );
}
