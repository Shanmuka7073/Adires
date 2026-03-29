
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
    RefreshCw,
    MapPin,
    Camera,
    Upload as UploadIcon,
    Sparkles,
    Zap,
    Monitor,
    XCircle,
    CheckCircle2,
    BarChart3
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
 * The setup gate has been removed. Merchants land directly on their operational tools.
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
        if (firestore && !userStore && !isUserDataLoaded && isMerchant) {
            fetchUserStore(firestore, user.uid);
        }
    }, [isLoading, isMerchant, isAdmin, user, firestore, userStore, isUserDataLoaded, fetchUserStore, router]);

    const serviceLinks = useMemo(() => {
        const isSalon = userStore?.businessType === 'salon';
        return [
            { 
                title: 'POS Terminal', 
                description: 'Counter billing & walk-ins', 
                href: '/dashboard/owner/pos', 
                icon: Monitor, 
                highlight: true 
            },
            { 
                title: isSalon ? 'Live Bookings' : 'Live Orders', 
                description: isSalon ? 'Appointments queue' : 'Active table sessions', 
                href: isSalon ? '/dashboard/owner/bookings' : '/dashboard/owner/orders', 
                icon: isSalon ? CalendarCheck : ShoppingBag, 
                highlight: true 
            },
            { 
                title: 'Hub Messenger', 
                description: 'Customer support chat', 
                href: '/chat', 
                icon: MessageSquare 
            },
            { 
                title: 'Operational Analytics', 
                description: 'Gross profit & check trends', 
                href: '/dashboard/owner/sales-report', 
                icon: BarChart3 
            },
            { 
                title: 'Digital Menu Hub', 
                description: 'Catalog & QR assignments', 
                href: '/dashboard/owner/menu-manager', 
                icon: Utensils 
            },
            { 
                title: 'Business Profile', 
                description: 'Manage storefront & photo', 
                href: '/dashboard/owner/my-store', 
                icon: Store 
            }
        ];
    }, [userStore]);

    if (isLoading || (!isUserDataLoaded && user)) return <GlobalLoader />;
    
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
        <div className="container mx-auto px-3 py-6 max-w-2xl space-y-6 pb-24 animate-in fade-in duration-500">
            <div className="flex items-center gap-4 border-b pb-6 border-black/5">
                <div className="h-14 w-14 rounded-3xl bg-primary/10 flex items-center justify-center text-primary shadow-inner border-2 border-white">
                    {userStore?.businessType === 'salon' ? <Scissors className="h-7 w-7" /> : <Utensils className="h-7 w-7" />}
                </div>
                <div className="flex-1 min-w-0 text-left">
                    <h1 className="text-xl font-black uppercase tracking-tight truncate leading-none text-gray-950 italic">{userStore?.name || 'Business Hub'}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <p className="text-[10px] font-black text-primary uppercase tracking-widest">Operational Hub</p>
                        <div className="h-1 w-1 rounded-full bg-black/10" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter">{userStore?.businessType || 'Independent Hub'}</p>
                    </div>
                </div>
                <Button variant="outline" size="icon" className="h-10 w-10 rounded-xl border-2" onClick={() => window.location.reload()}>
                    <RefreshCw className="h-4 w-4 opacity-40" />
                </Button>
            </div>

            <div className="grid grid-cols-1 gap-3">
                {serviceLinks.map((card) => (
                    <a href={card.href} key={card.href} className="group block">
                        <Card className={cn(
                            "rounded-2xl border-0 shadow-lg transition-all active:scale-[0.98] bg-white border-2 border-transparent hover:border-primary/10",
                            card.highlight && "bg-primary/5 ring-2 ring-primary/10 border-primary/20"
                        )}>
                            <div className="flex items-center gap-4 p-4">
                                <div className={cn(
                                    "h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner shrink-0",
                                    card.highlight ? "bg-primary text-white" : "bg-primary/5 text-primary"
                                )}>
                                    <card.icon className="h-6 w-6" />
                                </div>
                                <div className="flex-1 min-w-0 text-left">
                                    <h3 className="text-sm font-black uppercase tracking-tight text-gray-950 leading-none">{card.title}</h3>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1.5 leading-none truncate">{card.description}</p>
                                </div>
                                <ArrowRight className="h-4 w-4 text-primary opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all shrink-0" />
                            </div>
                        </Card>
                    </a>
                ))}
            </div>

            <Card className="rounded-[2.5rem] border-0 shadow-xl bg-slate-900 text-white p-8 overflow-hidden relative mt-6">
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                    <Zap className="h-24 w-24" />
                </div>
                <div className="relative z-10 space-y-2 text-left">
                    <h3 className="text-xs font-black uppercase tracking-[0.3em] text-primary">System Pulse</h3>
                    <p className="text-sm font-bold opacity-60 leading-relaxed uppercase">
                        All local table sessions are synchronized with the kitchen display. Ensure your device has a stable internet connection.
                    </p>
                </div>
            </Card>
        </div>
    );
}
