'use client';

import { Suspense, useState, useEffect, useTransition, useMemo } from 'react';
import {
  Users,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  DollarSign,
  ShoppingBag,
  Target,
  Zap,
  RefreshCw,
  ZapOff,
  Flame,
  ShieldCheck,
  Rocket,
  Lock,
  Shield,
  ArrowRight,
  CheckCircle2,
  Server,
  FileSignature,
  Loader2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { getPlatformAnalytics, executeCommand } from '@/app/actions';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

function KPICard({ title, value, subValue, trendValue, icon: Icon, color }: any) {
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
            <div className={cn(
                "flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full",
                isPositive ? "bg-green-100 text-green-600" : "bg-red-100 text-red-500"
            )}>
                {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                {Math.abs(trendValue).toFixed(1)}%
            </div>
        </div>
        <p className="text-[9px] font-bold opacity-40 uppercase tracking-tight mt-1">{subValue}</p>
      </CardContent>
    </Card>
  );
}

function CommandCard({ title, icon: Icon, color, command, onExecute, variant = 'default' }: any) {
    const isDestructive = variant === 'destructive';
    return (
        <Card className={cn(
            "rounded-2xl border-0 shadow-md group hover:shadow-xl transition-all overflow-hidden border-2 border-transparent hover:border-black/5 bg-white",
            isDestructive && "border-red-100 bg-red-50/30"
        )}>
            <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-inner", color)}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <span className={cn("text-[10px] font-black uppercase tracking-tight", isDestructive && "text-red-900")}>{title}</span>
                </div>
                <Button 
                    variant={isDestructive ? 'destructive' : 'ghost'} 
                    size="sm" 
                    onClick={() => onExecute(command)} 
                    className={cn(
                        "h-8 rounded-lg text-[8px] font-black uppercase",
                        !isDestructive && "bg-black/5 hover:bg-black/10"
                    )}
                >
                    {isDestructive ? 'Disable' : 'Execute'}
                </Button>
            </CardContent>
        </Card>
    )
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

  const handleExecute = async (command: string) => {
      toast({ title: 'Broadcasting Command', description: 'Transmitting to platform edge...' });
      const res = await executeCommand(command);
      if (res.success) {
          toast({ title: 'Success', description: res.message });
          handleRefresh(); 
      } else {
          toast({ variant: 'destructive', title: 'Execution Failed' });
      }
  };

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;

  const currentMetrics = data?.periods?.[activePeriod] || data?.periods?.today || { revenue: 0, orders: 0, aov: 0, userReach: 0, trends: { revenue: 0, orders: 0, aov: 0, userReach: 0 } };

  return (
    <div className="container mx-auto px-4 py-10 space-y-12 max-w-7xl pb-32 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5">
        <div>
            <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none">Decision Hub</h1>
            <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">System Administration & Intelligence</p>
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
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="rounded-full h-10 px-4 border-2 font-black text-[10px] uppercase tracking-widest">
                    <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} /> Force Sync
                </Button>
            </div>
        </div>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
            title={`Revenue ${activePeriod.toUpperCase()}`} 
            value={`₹${currentMetrics.revenue.toFixed(0)}`} 
            subValue={activePeriod === 'today' ? "Vs Yesterday" : "Growth Context"} 
            trendValue={currentMetrics.trends.revenue} 
            icon={DollarSign} 
            color="bg-primary" 
        />
        <KPICard 
            title={`Orders ${activePeriod.toUpperCase()}`} 
            value={currentMetrics.orders} 
            subValue="Transaction Volume" 
            trendValue={currentMetrics.trends.orders} 
            icon={ShoppingBag} 
            color="bg-amber-500" 
        />
        <KPICard 
            title="Avg Order Value" 
            value={`₹${currentMetrics.aov.toFixed(0)}`} 
            subValue="Basket Profitability" 
            trendValue={currentMetrics.trends.aov} 
            icon={Target} 
            color="bg-blue-600" 
        />
        <KPICard 
            title="Market Reach" 
            value={currentMetrics.userReach} 
            subValue={`${data.activeSessions} Real-time Visitors`} 
            trendValue={currentMetrics.trends.userReach} 
            icon={Users} 
            color="bg-purple-600" 
        />
      </section>

      <div className="grid lg:grid-cols-3 gap-8">
        <section className="lg:col-span-2 space-y-10">
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                    <Rocket className="h-3 w-3" /> System Health
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <div className="p-8 rounded-[2.5rem] bg-green-50 border-2 border-green-100 flex flex-col items-center justify-center text-center gap-2">
                        <ShieldCheck className="h-10 w-10 text-green-600 opacity-40" />
                        <p className="font-black uppercase text-xs text-green-900">Infrastructure Stable</p>
                        <p className="text-[10px] font-bold text-green-800/60 uppercase">All core services operational.</p>
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                    <Zap className="h-3 w-3" /> Command Hub
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <CommandCard title="Boost Partner Rewards" icon={Zap} color="bg-indigo-500" command="reward_boost" onExecute={handleExecute} />
                    {data.isMaintenance ? (
                        <CommandCard title="Disable Maintenance" icon={ZapOff} color="bg-red-600" command="maintenance_off" onExecute={handleExecute} variant="destructive" />
                    ) : (
                        <CommandCard title="Enable Maintenance" icon={ZapOff} color="bg-red-500" command="maintenance_on" onExecute={handleExecute} />
                    )}
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 px-1">Infrastructure Control</h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <AdminActionCard title="System Status" description="Live health check of platform services." href="/dashboard/admin/system-status" icon={Server} />
                    <AdminActionCard title="App Overview" description="Complete design & architecture breakdown." href="/dashboard/admin/app-overview" icon={FileSignature} />
                    <AdminActionCard title="Market Catalog" description="Manage master products and prices." href="/dashboard/owner/my-store" icon={Store} />
                    <AdminActionCard title="Security Rules" description="Production Firestore rule inspect." href="/dashboard/admin/security-rules" icon={Shield} />
                    <AdminActionCard title="Image Management" description="Centralized asset control." href="/dashboard/admin/image-management" icon={ImageIcon} />
                </div>
            </div>
        </section>

        <section className="space-y-10">
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                    <Smartphone className="h-3 w-3" /> PWA Modules
                </h2>
                <Card className="rounded-[2.5rem] border-0 shadow-lg bg-white overflow-hidden">
                    <CardHeader className="bg-primary/5 border-b border-primary/10 pb-4">
                        <CardTitle className="text-xs font-black uppercase tracking-tight text-primary flex items-center gap-2">
                            <Lock className="h-3 w-3" /> App Shell Config
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <Button asChild variant="outline" className="w-full h-10 rounded-xl font-black uppercase text-[8px] tracking-widest border-2">
                            <Link href="/dashboard/admin/manifest-help">Edit PWA Manifest</Link>
                        </Button>
                        <Button asChild variant="outline" className="w-full h-10 rounded-xl font-black uppercase text-[8px] tracking-widest border-2">
                            <Link href="/dashboard/admin/pwa-settings">PWA Settings</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>
        </section>
      </div>
    </div>
  );
}
