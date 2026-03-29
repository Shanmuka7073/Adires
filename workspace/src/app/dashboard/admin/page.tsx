
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    Users, 
    Store, 
    ShoppingBag, 
    Server, 
    BarChart3,
    Shield,
    Loader2,
    RefreshCw,
    Wrench,
    Activity,
    Mic
} from 'lucide-react';
import Link from 'next/link';
import { useFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { getPlatformAnalytics } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function StatCard({ title, value, icon: Icon, loading }: { title: string, value: string | number, icon: React.ElementType, loading?: boolean }) {
    return (
        <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{title}</span>
                <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-3xl font-black tracking-tighter">{value}</div>}
            </CardContent>
        </Card>
    )
}

function AdminActionCard({ title, description, href, icon: Icon, highlight = false }: { title: string, description: string, href: string, icon: React.ElementType, highlight?: boolean }) {
    return (
        <Link href={href} className="block group">
            <Card className={cn(
                "rounded-3xl border-0 shadow-lg hover:shadow-2xl transition-all h-full bg-white overflow-hidden border-2 border-transparent hover:border-primary/10",
                highlight && "ring-2 ring-primary/20 border-primary/10 bg-primary/5"
            )}>
                <CardHeader className="p-6">
                    <div className="flex items-center gap-4">
                        <div className={cn(
                            "h-12 w-12 rounded-2xl flex items-center justify-center shadow-inner transition-colors",
                            highlight ? "bg-primary text-white" : "bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white"
                        )}>
                            <Icon className="h-6 w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-sm font-black uppercase tracking-tight">{title}</CardTitle>
                            <CardDescription className="text-[10px] font-bold opacity-40 uppercase mt-1 leading-tight">{description}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        </Link>
    );
}

export default function AdminDashboardPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [data, setData] = useState<any>(null);
    const [isRefreshing, startRefresh] = useTransition();

    const fetchStats = async () => {
        try {
            const stats = await getPlatformAnalytics();
            setData(stats);
        } catch (e) {
            toast({ variant: 'destructive', title: 'Sync failed' });
        }
    };

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/dashboard');
        } else if (isAdmin) {
            fetchStats();
        }
    }, [isAdminLoading, isAdmin, router]);

    if (isAdminLoading || !isAdmin) {
        return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32 animate-in fade-in duration-700">
            <div className="flex justify-between items-end border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none">Decision Hub</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Operational Command Center</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => startRefresh(fetchStats)} disabled={isRefreshing} className="rounded-full h-10 px-4 border-2 font-black text-[10px] uppercase tracking-widest shadow-sm">
                    <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isRefreshing && "animate-spin")} /> Sync Data
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Revenue Today" value={`₹${data?.periods?.today?.revenue || 0}`} icon={BarChart3} loading={!data} />
                <StatCard title="Total Users" value={data?.totalUsers || 0} icon={Users} loading={!data} />
                <StatCard title="Total Stores" value={data?.totalStores || 0} icon={Store} loading={!data} />
                <StatCard title="Active Jobs" value={data?.activeSessions || 0} icon={ShoppingBag} loading={!data} />
            </div>

            <div className="space-y-6">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 px-1 text-primary flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Intelligence & Controls
                 </h2>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <AdminActionCard 
                        title="Voice Intel"
                        description="Audit failed commands & global aliases."
                        href="/dashboard/admin/voice-intelligence"
                        icon={Mic}
                        highlight={true}
                    />
                    <AdminActionCard 
                        title="Nuke & Sync Audit"
                        description="Fix Index failures and clear ghost data."
                        href="/dashboard/admin/offline-audit"
                        icon={Wrench}
                    />
                    <AdminActionCard 
                        title="System Status"
                        description="Live health check of cloud services."
                        href="/dashboard/admin/system-status"
                        icon={Server}
                    />
                </div>
            </div>

            <div className="space-y-6 pt-6">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 px-1">Inventory Modules</h2>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    <AdminActionCard 
                        title="Market Catalog"
                        description="Global product management."
                        href="/dashboard/owner/my-store"
                        icon={ShoppingBag}
                    />
                    <AdminActionCard
                        title="Security Rules"
                        description="Firestore permission audit."
                        href="/dashboard/admin/security-rules"
                        icon={Shield}
                    />
                </div>
            </div>
        </div>
    );
}
