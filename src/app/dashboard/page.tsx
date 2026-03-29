
'use client';

import { 
    Card, 
    CardContent, 
    CardHeader, 
    CardTitle, 
    CardDescription 
} from '@/components/ui/card';
import { 
    ArrowRight, 
    Store, 
    ShoppingBag, 
    Smartphone,
    MessageSquare,
    CalendarCheck,
    Utensils,
    Scissors,
    Loader2,
    Zap,
    XCircle,
    BarChart3,
    Users
} from 'lucide-react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo } from 'react';
import { useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { useAppStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import GlobalLoader from '@/components/layout/global-loader';
import Link from 'next/link';

/**
 * UNIFIED MERCHANT HUB
 * Consolidates business operations with high-fidelity UI and instant identity persistence.
 */
export default function UnifiedDashboardPage() {
    const { user, firestore } = useFirebase();
    const { isMerchant, isAdmin, isCustomer, isLoading } = useAdminAuth();
    const router = useRouter();
    const { userStore, fetchUserStore, isUserDataLoaded } = useAppStore();

    useEffect(() => {
        if (isLoading) return;
        if (!user) { router.replace('/login'); return; }
        
        // Admins have their own dedicated Decision Hub
        if (isAdmin) { router.replace('/dashboard/admin'); return; }

        // Fetch store identity if not already in memory
        if (firestore && !userStore && isMerchant) {
            fetchUserStore(firestore, user.uid);
        }
    }, [isLoading, isMerchant, isAdmin, user, firestore, userStore, fetchUserStore, router]);

    const serviceLinks = useMemo(() => {
        const isSalon = userStore?.businessType === 'salon';
        return [
            { 
                title: 'MY STORE', 
                description: 'MANAGE PRODUCTS & PROFILE', 
                href: '/dashboard/owner/my-store', 
                icon: Store 
            },
            { 
                title: isSalon ? 'LIVE BOOKINGS' : 'STORE ORDERS', 
                description: isSalon ? 'APPOINTMENTS QUEUE' : 'LIVE TABLE ORDERS', 
                href: isSalon ? '/dashboard/owner/bookings' : '/dashboard/owner/orders', 
                icon: isSalon ? CalendarCheck : ShoppingBag, 
                highlight: true 
            },
            { 
                title: 'MESSAGES', 
                description: 'CUSTOMER SUPPORT CHAT', 
                href: '/chat', 
                icon: MessageSquare 
            },
            { 
                title: 'ANALYTICS', 
                description: 'SALES & PROFIT INSIGHTS', 
                href: '/dashboard/owner/sales-report', 
                icon: BarChart3 
            },
            { 
                title: 'EMPLOYEES', 
                description: 'STAFF & PAYROLL', 
                href: '/dashboard/owner/employees', 
                icon: Users 
            },
            {
                title: 'OFFLINE AUDIT',
                description: 'AUDIT DEVICE PERSISTENCE',
                href: '/dashboard/offline-audit',
                icon: Smartphone
            }
        ];
    }, [userStore]);

    if (isLoading) return <GlobalLoader />;
    
    // Safety check for customers manually navigating to /dashboard
    if (isCustomer) {
        return (
            <div className="container mx-auto py-24 px-4 text-center space-y-6 max-w-md animate-in fade-in duration-500">
                <div className="h-20 w-20 rounded-[2.5rem] bg-destructive/10 flex items-center justify-center mx-auto text-destructive">
                    <XCircle className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                    <h1 className="text-3xl font-black uppercase tracking-tight italic text-center">Merchant Access</h1>
                    <p className="text-sm font-bold text-gray-500 uppercase tracking-widest opacity-60 leading-relaxed text-center">
                        This operational hub is reserved for verified store owners and employees.
                    </p>
                </div>
                <Button asChild variant="outline" className="w-full h-14 rounded-2xl border-2 font-black uppercase text-xs tracking-widest shadow-xl">
                    <Link href="/">Return to Marketplace</Link>
                </Button>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8 pb-24 animate-in fade-in duration-500">
            {/* BRAND HEADER */}
            <div className="flex items-center justify-between pb-6 border-b border-black/5">
                <div className="flex items-center gap-4">
                    <div className={cn(
                        "h-14 w-14 rounded-3xl flex items-center justify-center shadow-inner border-2 border-white transition-colors",
                        userStore ? "bg-[#f0fff4] text-primary" : "bg-muted text-muted-foreground opacity-20"
                    )}>
                        {userStore?.businessType === 'salon' ? <Scissors className="h-7 w-7" /> : <Utensils className="h-7 w-7" />}
                    </div>
                    <div className="text-left">
                        <h1 className="text-xl font-black uppercase tracking-tight text-gray-950 leading-none italic">
                            {userStore?.name || 'SETUP REQUIRED'}
                        </h1>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mt-2">
                            {userStore ? 'OPERATIONAL CONTROL' : 'IDENTITY PENDING'}
                        </p>
                    </div>
                </div>
                {userStore && (
                    <div className="inline-flex items-center rounded-full border border-primary/10 bg-[#f0fff4] px-3 py-1 text-primary font-black text-[9px] uppercase gap-1.5 shadow-sm">
                        <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> ONLINE
                    </div>
                )}
            </div>

            {/* ACTION CARDS GRID */}
            <div className="grid grid-cols-1 gap-4">
                {serviceLinks.map((card) => (
                    <Link href={card.href} key={card.href} className="group block">
                        <Card className={cn(
                            "rounded-[1.5rem] border-0 shadow-lg transition-all active:scale-[0.98] bg-white border-2 border-transparent hover:border-primary/10",
                            card.highlight && "bg-[#f0fff4] border-primary/20 ring-1 ring-primary/10",
                            !userStore && card.href === '/dashboard/owner/my-store' && "ring-2 ring-primary animate-pulse"
                        )}>
                            <div className="flex items-center gap-5 p-5">
                                <div className={cn(
                                    "h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0 transition-colors",
                                    card.highlight ? "bg-primary text-white" : "bg-[#f0fff4] text-primary"
                                )}>
                                    <card.icon className="h-6 w-6" />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <h3 className="text-sm font-black uppercase tracking-tight text-gray-950 leading-none">
                                        {card.title}
                                    </h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-2 leading-none truncate">
                                        {card.description}
                                    </p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-gray-300 group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
                            </div>
                        </Card>
                    </Link>
                ))}
            </div>

            <div className="pt-6">
                <Card className="rounded-[2.5rem] border-0 shadow-xl bg-slate-900 text-white p-8 overflow-hidden relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                        <Zap className="h-24 w-24" />
                    </div>
                    <div className="relative z-10 space-y-2 text-left">
                        <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary">System Pulse</h3>
                        <p className="text-sm font-bold opacity-60 leading-relaxed uppercase">
                            {userStore 
                                ? 'All operational terminals are currently synchronized with the regional dispatch network.'
                                : 'Please complete your business setup in the "My Store" section to activate live features.'}
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
}
