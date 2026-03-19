
'use client';

import { Suspense, useState, useEffect, useTransition } from 'react';
import {
  Users,
  Store,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Target,
  Zap,
  BarChart3,
  Clock,
  LayoutGrid,
  Sparkles,
  Search,
  BellRing,
  Award,
  ChevronRight,
  Loader2,
  RefreshCw,
  Activity,
  Drama,
  Bot
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DesignButton } from './design-button';
import { Skeleton } from "@/components/ui/skeleton";
import { getPlatformAnalytics } from '@/app/actions';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

function KPICard({ title, value, subValue, trend, trendValue, icon: Icon, color }: any) {
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
            {trend && (
                <div className={cn(
                    "flex items-center text-[10px] font-bold",
                    trend === 'up' ? "text-green-600" : "text-red-500"
                )}>
                    {trend === 'up' ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {trendValue}
                </div>
            )}
        </div>
        <p className="text-[9px] font-bold opacity-40 uppercase tracking-tight mt-1">{subValue}</p>
      </CardContent>
    </Card>
  );
}

function InsightItem({ icon: Icon, title, message, variant = 'default' }: any) {
    return (
        <div className={cn(
            "p-4 rounded-2xl flex gap-4 items-start border-2 transition-all",
            variant === 'warning' ? "bg-amber-50 border-amber-100" : "bg-primary/5 border-primary/10"
        )}>
            <div className={cn(
                "h-8 w-8 rounded-lg shrink-0 flex items-center justify-center",
                variant === 'warning' ? "bg-amber-500 text-white" : "bg-primary text-white"
            )}>
                <Icon className="h-4 w-4" />
            </div>
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">{title}</p>
                <p className="text-xs font-bold text-gray-800 leading-snug">{message}</p>
            </div>
        </div>
    )
}

export default function AdminDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, startRefresh] = useTransition();
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

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;

  return (
    <div className="container mx-auto px-4 py-10 space-y-12 max-w-7xl pb-32">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5">
        <div>
            <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none">Mission Control</h1>
            <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Adires Global Authority Dashboard</p>
        </div>
        <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="rounded-full h-12 px-4 border-2 font-black text-[10px] uppercase tracking-widest">
                <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} /> Refresh Data
            </Button>
            <DesignButton />
        </div>
      </div>

      {/* KPI GRID */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <KPICard 
            title="Revenue Today" 
            value={`₹${data.revenueToday.toFixed(0)}`} 
            subValue={`From ${data.ordersToday} orders`} 
            trend="up" 
            trendValue="12%" 
            icon={DollarSign} 
            color="bg-primary" 
        />
        <KPICard 
            title="Avg Order Value" 
            value={`₹${data.aov.toFixed(0)}`} 
            subValue="Target: ₹450+" 
            trend="up" 
            trendValue="4.2%" 
            icon={Target} 
            color="bg-blue-600" 
        />
        <KPICard 
            title="Platform MAU" 
            value={data.totalUsers} 
            subValue={`${data.activeSessions} Live QR Sessions`} 
            trend="up" 
            trendValue="8%" 
            icon={Users} 
            color="bg-purple-600" 
        />
        <KPICard 
            title="Market Health" 
            value={`${data.fulfillmentRate}%`} 
            subValue="Order Success Rate" 
            icon={Activity} 
            color="bg-amber-500" 
        />
      </section>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* LEFT: INTELLIGENCE & INSIGHTS */}
        <section className="lg:col-span-2 space-y-8">
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                    <Sparkles className="h-3 w-3" /> Intelligence Layer
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                    <InsightItem 
                        icon={TrendingUp} 
                        title="Growth Anomaly" 
                        message="Chicken products are driving 42% of revenue this week. Suggesting specialized ads for Fresh-Cut Hubs."
                    />
                    <InsightItem 
                        icon={AlertTriangle} 
                        variant="warning"
                        title="Operational Risk" 
                        message="3 hubs in Zone-500001 have zero available delivery partners. High cancellation risk detected."
                    />
                </div>
            </div>

            {/* TOP HUBS LEADERBOARD */}
            <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-black/5 flex flex-row justify-between items-center py-6">
                    <div>
                        <CardTitle className="text-xl font-black uppercase tracking-tight">Market Leaderboard</CardTitle>
                        <CardDescription className="text-[10px] font-bold opacity-40 uppercase">Top performing Hubs by Revenue</CardDescription>
                    </div>
                    <Award className="h-6 w-6 text-primary opacity-20" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-black/5">
                        {data.topStores.map((store: any, i: number) => (
                            <div key={store.id} className="p-6 flex items-center justify-between group hover:bg-muted/30 transition-all">
                                <div className="flex items-center gap-4 min-w-0">
                                    <div className="h-10 w-10 rounded-2xl bg-black/5 flex items-center justify-center font-black text-sm text-gray-400 group-hover:bg-primary group-hover:text-white transition-colors">
                                        {i + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-black text-sm uppercase truncate">{store.name}</p>
                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{store.businessType || 'Retail'}</span>
                                            <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 h-4 px-1.5">{store.orderCount} Orders</Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-black text-lg tracking-tighter text-primary">₹{store.revenue.toFixed(0)}</p>
                                    <p className="text-[8px] font-black uppercase opacity-20">30D Volume</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </section>

        {/* RIGHT: GROWTH ENGINE & QUICK TOOLS */}
        <section className="space-y-8">
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                    <Zap className="h-3 w-3" /> Growth Engine
                </h2>
                <Card className="rounded-[2.5rem] border-0 shadow-xl p-8 bg-slate-950 text-white space-y-8">
                    <div className="space-y-3">
                        <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Repeat Rate</span>
                            <span className="text-xl font-black text-primary">64%</span>
                        </div>
                        <Progress value={64} className="h-1.5 bg-white/10" />
                        <p className="text-[9px] font-bold opacity-40 leading-tight">High retention. QR-sessions are effectively capturing repeat device IDs.</p>
                    </div>

                    <div className="space-y-3">
                        <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Cross-Sell</span>
                            <span className="text-xl font-black text-blue-400">22%</span>
                        </div>
                        <Progress value={22} className="h-1.5 bg-white/10" />
                        <p className="text-[9px] font-bold opacity-40 leading-tight">Users adding suggestions from the specialist module.</p>
                    </div>
                </Card>
            </div>

            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40">System Actions</h2>
                <div className="grid grid-cols-1 gap-3">
                    {[
                        { title: 'Strategic Audit', href: '/dashboard/admin/strategic-audit', icon: Drama, color: 'bg-indigo-500' },
                        { title: 'NLU Control', href: '/dashboard/voice-commands', icon: Mic, color: 'bg-primary' },
                        { title: 'Asha Context', href: '/dashboard/admin/support-prompt', icon: Bot, color: 'bg-blue-500' }
                    ].map(tool => (
                        <Link key={tool.title} href={tool.href}>
                            <Card className="rounded-2xl border-0 shadow-md group hover:shadow-xl transition-all overflow-hidden border-2 border-transparent hover:border-black/5">
                                <CardContent className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-white shadow-inner", tool.color)}>
                                            <tool.icon className="h-4 w-4" />
                                        </div>
                                        <span className="text-xs font-black uppercase tracking-tight">{tool.title}</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
      </div>
    </div>
  );
}
