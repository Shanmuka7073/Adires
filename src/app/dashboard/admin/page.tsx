'use client';

import { useState, useEffect, useTransition } from 'react';
import {
  Users,
  Store,
  DollarSign,
  ShoppingBag,
  Target,
  RefreshCw,
  Rocket,
  Shield,
  Server,
  FileSignature,
  Loader2,
  ImageIcon,
  ShieldCheck,
  WifiOff,
  BellRing,
  Zap,
  FastForward,
  Clock,
  LayoutGrid,
  BarChart3,
  Smartphone
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { getPlatformAnalytics } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

function KPICard({ title, value, subValue, trendValue = 0, icon: Icon, color }: any) {
  const isPositive = trendValue >= 0;
  return (
    <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden group hover:shadow-2xl transition-all border-2 border-transparent hover:border-primary/10">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">{title}</span>
        <div className={cn("h-8 w-8 rounded-xl flex items-center justify-center", color)}>
            <Icon className="h-4 w-4 text-white" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
            <div className="text-3xl font-black text-gray-950 tracking-tighter">{value}</div>
            {trendValue !== undefined && trendValue !== 0 && (
                <div className={cn(
                    "flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full",
                    isPositive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
                )}>
                    {Math.abs(trendValue).toFixed(1)}%
                </div>
            )}
        </div>
        <p className="text-[9px] font-bold opacity-40 uppercase tracking-tight mt-1">{subValue}</p>
      </CardContent>
    </Card>
  );
}

function AdminActionCard({ title, description, href, icon: Icon }: { title: string, description: string, href: string, icon: React.ElementType }) {
    return (
        <Link href={href} className="block group">
            <Card className="rounded-3xl border-0 shadow-lg hover:shadow-2xl transition-all h-full bg-white overflow-hidden border-2 border-transparent hover:border-primary/10">
                <CardHeader className="p-6">
                    <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary shadow-inner group-hover:bg-primary group-hover:text-white transition-colors">
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
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
  const [activePeriod, setActiveTab] = useState<'today' | '7d' | '14d' | '30d'>('today');
  const { toast } = useToast();

  const fetchStats = async () => {
    try {
        const stats = await getPlatformAnalytics();
        setData(stats);
    } catch (e) {
        console.error("Platform analytics failed:", e);
        toast({ variant: 'destructive', title: 'Data sync failed' });
    } finally {
        setIsLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const handleRefresh = () => {
      startRefresh(async () => {
          await fetchStats();
          toast({ title: 'System metrics updated' });
      });
  };

  if (isLoading) return <div className="p-12 text-center flex flex-col items-center justify-center h-[60vh] gap-4">
      <Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" />
      <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Connecting to Ops Data...</p>
  </div>;

  const currentMetrics = data?.periods?.[activePeriod] || data?.periods?.today || { 
      revenue: 0, orders: 0, aov: 0, userReach: 0, 
      trends: { revenue: 0, orders: 0, aov: 0, userReach: 0 } 
  };

  return (
    <div className="container mx-auto px-4 py-10 space-y-12 max-w-7xl pb-32 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5">
        <div className="min-w-0 flex-1">
            <h1 className="text-3xl md:text-6xl font-black font-headline tracking-tight uppercase italic leading-none text-gray-950 truncate">Decision Hub</h1>
            <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Operational Intelligence Hub</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
            <div className="flex bg-black/5 p-1 rounded-2xl border self-end">
                {(['today', '7d', '14d', '30d'] as const).map(p => (
                    <button 
                        key={p} 
                        onClick={() => setActiveTab(p)}
                        className={cn(
                            "px-4 h-10 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                            activePeriod === p ? "bg-white shadow-lg text-primary" : "opacity-40 hover:opacity-100"
                        )}
                    >
                        {p}
                    </button>
                ))}
            </div>
            <div className="flex gap-2 self-end">
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="rounded-full h-10 px-4 border-2 font-black text-[10px] uppercase tracking-widest shadow-sm">
                    <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} /> Force Sync
                </Button>
            </div>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
            title={`Revenue ${activePeriod.toUpperCase()}`} 
            value={`₹${(currentMetrics.revenue || 0).toFixed(0)}`} 
            subValue={activePeriod === 'today' ? "Vs Yesterday" : "Growth Context"} 
            trendValue={currentMetrics.trends?.revenue || 0} 
            icon={DollarSign} 
            color="bg-primary" 
        />
        <KPICard 
            title={`Orders ${activePeriod.toUpperCase()}`} 
            value={currentMetrics.orders || 0} 
            subValue="Transaction Volume" 
            trendValue={currentMetrics.trends?.orders || 0} 
            icon={ShoppingBag} 
            color="bg-amber-500" 
        />
        <KPICard 
            title="Avg Order Value" 
            value={`₹${(currentMetrics.aov || 0).toFixed(0)}`} 
            subValue="Basket Profitability" 
            trendValue={currentMetrics.trends?.aov || 0} 
            icon={Target} 
            color="bg-blue-600" 
        />
        <KPICard 
            title="Market Reach" 
            value={currentMetrics.userReach || 0} 
            subValue={`${data?.activeSessions || 0} Real-time Visitors`} 
            trendValue={currentMetrics.trends?.userReach || 0} 
            icon={Users} 
            color="bg-purple-600" 
        />
      </section>

      <div className="space-y-4">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 px-1 flex items-center gap-2">
              <Zap className="h-3 w-3" /> Billing Efficiency (Live Telemetry)
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <KPICard 
                  title="Avg Billing Speed" 
                  value={`${(data?.avgBillingSpeed || 0).toFixed(1)}m`} 
                  subValue="Minutes per session" 
                  icon={Zap} 
                  color="bg-indigo-600" 
              />
              <KPICard 
                  title="Fastest Bill" 
                  value={`${(data?.fastestBill || 0).toFixed(1)}m`} 
                  subValue="Operational Peak" 
                  icon={FastForward} 
                  color="bg-emerald-600" 
              />
              <KPICard 
                  title="Slowest Bill" 
                  value={`${(data?.slowestBill || 0).toFixed(1)}m`} 
                  subValue="Maximum duration" 
                  icon={Clock} 
                  color="bg-rose-600" 
              />
          </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-10">
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 px-1">Infrastructure Modules</h2>
                <div className="grid gap-4 md:grid-cols-2">
                    <AdminActionCard title="Market Intel" description="Detailed sales & revenue audit." href="/dashboard/admin/sales-report" icon={BarChart3} />
                    <AdminActionCard title="System Status" description="Live health check of cloud services." href="/dashboard/admin/system-status" icon={Server} />
                    <AdminActionCard title="Global Broadcast" description="Send push alerts to every device." href="/dashboard/admin/broadcast" icon={BellRing} />
                    <AdminActionCard title="App Overview" description="Architecture & Design Blueprint." href="/dashboard/admin/app-overview" icon={FileSignature} />
                    <AdminActionCard title="Security Rules" description="Production Firestore rule inspect." href="/dashboard/admin/security-rules" icon={Shield} />
                    <AdminActionCard title="Asset Hub" description="Centralized branding & image control." href="/dashboard/admin/image-management" icon={ImageIcon} />
                </div>
            </div>
        </section>

        <section className="space-y-10">
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                    <Rocket className="h-3 w-3" /> Deployment Safety
                </h2>
                <div className="grid grid-cols-1 gap-4">
                    <div className="p-8 rounded-[2.5rem] bg-green-50 border-2 border-green-100 flex flex-col items-center justify-center text-center gap-2 shadow-sm">
                        <ShieldCheck className="h-10 w-10 text-green-600 opacity-40" />
                        <p className="font-black uppercase text-xs text-green-900">Edge Clusters Stable</p>
                        <p className="text-[10px] font-bold text-green-800/60 uppercase">No incident reports detected.</p>
                    </div>
                    <Link href="/dashboard/admin/offline-audit">
                        <div className="p-8 rounded-[2.5rem] bg-indigo-50 border-2 border-indigo-100 flex flex-col items-center justify-center text-center gap-2 hover:bg-indigo-100 transition-colors group shadow-sm">
                            <WifiOff className="h-10 w-10 text-indigo-600 opacity-40 group-hover:opacity-100 transition-opacity" />
                            <p className="font-black uppercase text-xs text-indigo-900">Offline Integrity Audit</p>
                            <p className="text-[10px] font-bold text-indigo-800/60 uppercase">Check PWA Shell & Local Sync</p>
                        </div>
                    </Link>
                </div>
            </div>
        </section>
      </div>
    </div>
  );
}
