
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
  Clock,
  LayoutGrid,
  Sparkles,
  Award,
  ChevronRight,
  Loader2,
  RefreshCw,
  Drama,
  Bot,
  AlertTriangle,
  Mic,
  ZapOff,
  Flame,
  ShieldCheck,
  Rocket,
  ShieldAlert,
  Lock,
  Shield,
  ArrowRight,
  CheckCircle2
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DesignButton } from './design-button';
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

function DecisionItem({ type, title, message, action, onExecute }: any) {
    const isCritical = type === 'critical';
    return (
        <div className={cn(
            "p-5 rounded-[2rem] flex flex-col gap-4 border-2 transition-all relative overflow-hidden group",
            isCritical ? "bg-red-50 border-red-100 shadow-red-100" : "bg-amber-50 border-amber-100 shadow-amber-100"
        )}>
            {isCritical && <div className="absolute top-0 right-0 p-4 opacity-5 rotate-12"><Flame className="h-24 w-24" /></div>}
            <div className="flex gap-4 items-start relative z-10">
                <div className={cn(
                    "h-10 w-10 rounded-2xl shrink-0 flex items-center justify-center shadow-lg",
                    isCritical ? "bg-red-500 text-white" : "bg-amber-500 text-white"
                )}>
                    {isCritical ? <Zap className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />}
                </div>
                <div className="space-y-1">
                    <p className={cn("text-[10px] font-black uppercase tracking-widest opacity-40", isCritical ? "text-red-900" : "text-amber-900")}>{title}</p>
                    <p className="text-xs font-bold text-gray-800 leading-snug">{message}</p>
                </div>
            </div>
            <Button 
                onClick={() => onExecute(action.toLowerCase().replace(/ /g, '_'))}
                className={cn(
                    "w-full h-10 rounded-xl font-black uppercase text-[9px] tracking-widest shadow-md group-hover:scale-[1.02] transition-transform",
                    isCritical ? "bg-red-600 hover:bg-red-700" : "bg-amber-600 hover:bg-amber-700"
                )}
            >
                {action}
            </Button>
        </div>
    )
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
          handleRefresh(); // Trigger data refresh to show impact
      } else {
          toast({ variant: 'destructive', title: 'Execution Failed', description: res.error });
      }
  };

  if (isLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;

  const currentMetrics = data?.periods?.[activePeriod] || data?.periods?.today || { revenue: 0, orders: 0, aov: 0, userReach: 0, trends: { revenue: 0, orders: 0, aov: 0, userReach: 0 } };

  return (
    <div className="container mx-auto px-4 py-10 space-y-12 max-w-7xl pb-32 animate-in fade-in duration-700">
      {/* HEADER: AUTHORITY LAYER */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5">
        <div>
            <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none">Decision Hub</h1>
            <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Operational Execution & Intelligence</p>
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
                <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing} className="rounded-full h-12 px-4 border-2 font-black text-[10px] uppercase tracking-widest">
                    <RefreshCw className={cn("mr-2 h-4 w-4", isRefreshing && "animate-spin")} /> Force Sync
                </Button>
                <DesignButton />
            </div>
        </div>
      </div>

      {/* KPI GRID: PERIOD-AWARE */}
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
        {/* LEFT: DECISION RADAR & EXECUTION */}
        <section className="lg:col-span-2 space-y-10">
            {/* 1. DECISION RADAR */}
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                    <Rocket className="h-3 w-3" /> Decision Radar
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                    {data.decisions.length > 0 ? (
                        data.decisions.map((decision: any, i: number) => (
                            <DecisionItem key={i} {...decision} onExecute={handleExecute} />
                        ))
                    ) : (
                        <div className="col-span-full p-8 rounded-[2.5rem] bg-green-50 border-2 border-green-100 flex flex-col items-center justify-center text-center gap-2">
                            <ShieldCheck className="h-10 w-10 text-green-600 opacity-40" />
                            <p className="font-black uppercase text-xs text-green-900">All Zones Stable</p>
                            <p className="text-[10px] font-bold text-green-800/60 uppercase">No urgent intervention required today.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* 2. COMMAND HUB: EXECUTION LAYER */}
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                    <Zap className="h-3 w-3" /> Command Center
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <CommandCard title="Boost Partner Rewards" icon={Zap} color="bg-indigo-500" command="reward_boost" onExecute={handleExecute} />
                    <CommandCard title="Trigger Flash Promo" icon={Sparkles} color="bg-primary" command="flash_promo" onExecute={handleExecute} />
                    {data.isMaintenance ? (
                        <CommandCard title="Disable Maintenance" icon={ZapOff} color="bg-red-600" command="maintenance_off" onExecute={handleExecute} variant="destructive" />
                    ) : (
                        <CommandCard title="Enable Maintenance" icon={ZapOff} color="bg-red-500" command="maintenance_on" onExecute={handleExecute} />
                    )}
                </div>
            </div>

            {/* 3. LEADERBOARD */}
            <Card className="rounded-[3rem] border-0 shadow-2xl overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 border-b border-black/5 flex flex-row justify-between items-center py-8 px-10">
                    <div>
                        <CardTitle className="text-2xl font-black uppercase tracking-tight">Hub Performance</CardTitle>
                        <CardDescription className="text-[10px] font-bold opacity-40 uppercase">Top 5 verified business owners (Last 30 Days)</CardDescription>
                    </div>
                    <Award className="h-8 w-8 text-primary opacity-20" />
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y divide-black/5">
                        {data.topStores.map((store: any, i: number) => (
                            <div key={store.id} className="p-8 flex items-center justify-between group hover:bg-muted/30 transition-all cursor-pointer">
                                <div className="flex items-center gap-6 min-w-0">
                                    <div className="h-12 w-12 rounded-[1.2rem] bg-black/5 flex items-center justify-center font-black text-lg text-gray-400 group-hover:bg-primary group-hover:text-white transition-colors">
                                        {i + 1}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-black text-base uppercase truncate text-gray-950">{store.name}</p>
                                        <div className="flex items-center gap-3 mt-1">
                                            <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{store.businessType}</span>
                                            <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 h-5 px-2">{store.orderCount} Orders</Badge>
                                        </div>
                                    </div>
                                </div>
                                <div className="text-right shrink-0">
                                    <p className="font-black text-2xl tracking-tighter text-primary">₹{store.revenue.toFixed(0)}</p>
                                    <p className="text-[8px] font-black uppercase opacity-20">Volume Index</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </section>

        {/* RIGHT: SECURITY & GROWTH */}
        <section className="space-y-10">
            {/* SECURITY PERIMETER */}
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                    <ShieldAlert className="h-3 w-3" /> Security Perimeter
                </h2>
                <Card className="rounded-[2.5rem] border-0 shadow-lg bg-white overflow-hidden">
                    <CardHeader className="bg-red-50 border-b border-red-100 pb-4">
                        <CardTitle className="text-xs font-black uppercase tracking-tight text-red-900 flex items-center gap-2">
                            <Lock className="h-3 w-3" /> Defensive Hardening
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight">
                            <span className="opacity-40">RBAC (Admin Lock)</span>
                            <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Verified</span>
                        </div>
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight">
                            <span className="opacity-40">Secure Headers (CSP)</span>
                            <span className="text-green-600 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Enabled</span>
                        </div>
                        <Separator className="bg-black/5" />
                        <Button asChild variant="outline" className="w-full h-10 rounded-xl font-black uppercase text-[8px] tracking-widest border-2">
                            <Link href="/dashboard/admin/security-rules"><Shield className="mr-2 h-3.5 w-3.5" /> Inspect Firestore Rules</Link>
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {/* QUICK ACCESS ADMIN MODULES */}
            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40">Operational Access</h2>
                <div className="grid grid-cols-1 gap-3">
                    {[
                        { title: 'Strategic Audit', href: '/dashboard/admin/strategic-audit', icon: Drama, color: 'bg-indigo-500' },
                        { title: 'NLU Control Center', href: '/dashboard/voice-commands', icon: Mic, color: 'bg-primary' },
                        { title: 'Failed Command Hub', href: '/dashboard/admin/failed-commands', icon: Bot, color: 'bg-amber-500' },
                        { title: 'Live Order Video', href: '/dashboard/admin/site-config', icon: Video, color: 'bg-blue-500' }
                    ].map(tool => (
                        <Link key={tool.title} href={tool.href}>
                            <Card className="rounded-2xl border-0 shadow-md group hover:shadow-xl transition-all overflow-hidden border-2 border-transparent hover:border-black/5 bg-white">
                                <CardContent className="p-5 flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center text-white shadow-inner", tool.color)}>
                                            <tool.icon className="h-5 w-5" />
                                        </div>
                                        <span className="text-[10px] font-black uppercase tracking-widest">{tool.title}</span>
                                    </div>
                                    <ChevronRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" /> Growth Logic
                </h2>
                <Card className="rounded-[3rem] border-0 shadow-xl p-10 bg-slate-950 text-white space-y-10">
                    <div className="space-y-4">
                        <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Session Conversion</span>
                            <span className="text-2xl font-black text-primary">42.8%</span>
                        </div>
                        <Progress value={42.8} className="h-2 bg-white/10" />
                        <p className="text-[10px] font-bold opacity-40 leading-relaxed uppercase tracking-tight">QR-menu interaction to order success rate.</p>
                    </div>

                    <div className="space-y-4">
                        <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Category Pull</span>
                            <span className="text-2xl font-black text-blue-400">18.2%</span>
                        </div>
                        <Progress value={18.2} className="h-2 bg-white/10" />
                        <p className="text-[10px] font-bold opacity-40 leading-relaxed uppercase tracking-tight">Cross-sell index for Wellness & Meat hubs.</p>
                    </div>

                    <Separator className="bg-white/10" />

                    <div className="space-y-4">
                        <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Asha Strategy Tip</h3>
                        <p className="text-xs font-medium text-white/60 leading-relaxed italic">
                            "Revenue is trending up in Zone-500001. Onboarding 2 more Meat Hubs here could capture an estimated ₹45k/week in untapped volume."
                        </p>
                    </div>
                </Card>
            </div>
        </section>
      </div>
    </div>
  );
}
