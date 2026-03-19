
import { Suspense } from 'react';
import {
  Users,
  Store,
  Mic,
  Bot,
  Shield,
  FileCode,
  TrendingUp,
  ArrowRight,
  Cog,
  Sparkles,
  BarChart3,
  PackageCheck,
  Beaker,
  Lightbulb,
  ImageIcon,
  WifiOff,
  Activity,
  List,
  Cpu,
  Fingerprint,
  Zap,
  Globe
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DesignButton } from './design-button';
import { Skeleton } from "@/components/ui/skeleton";
import { unstable_cache } from 'next/cache';
import { getAdminServices } from '@/firebase/admin-init';

/**
 * 1. FAST DATA FETCHING
 */
const getPlatformStats = unstable_cache(
  async () => {
    try {
        const { db } = await getAdminServices();
        const [userSnap, storeSnap, orderSnap] = await Promise.all([
          db.collection('users').count().get(),
          db.collection('stores').count().get(),
          db.collection('orders').where('status', 'in', ['Delivered', 'Completed']).count().get()
        ]);

        return {
          totalUsers: userSnap.data().count || 0,
          totalStores: storeSnap.data().count || 0,
          totalOrders: orderSnap.data().count || 0,
        };
    } catch (e) {
        console.error("Failed to fetch platform stats:", e);
        return { totalUsers: 0, totalStores: 0, totalOrders: 0 };
    }
  },
  ['platform-stats'],
  { revalidate: 300 }
);

function StatsSkeleton() {
  return (
    <div className="grid md:grid-cols-3 gap-8">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-[2rem] bg-white/50 shadow-sm" />
      ))}
    </div>
  );
}

async function StatsGrid() {
  const stats = await getPlatformStats();
  
  const cards = [
    { label: 'Total Users', value: stats.totalUsers, icon: Users },
    { label: 'Active Stores', value: stats.totalStores, icon: Store },
    { label: 'Completed Orders', value: stats.totalOrders, icon: PackageCheck },
  ];

  return (
    <div className="grid md:grid-cols-3 gap-8">
      {cards.map((card) => (
        <Card key={card.label} className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden group">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-40">{card.label}</CardTitle>
            <card.icon className="h-4 w-4 text-primary opacity-20 group-hover:opacity-100 transition-opacity" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-gray-950 tracking-tighter">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ActionCard({
  title,
  description,
  href,
  icon: Icon,
  variant = 'default'
}: {
  title: string;
  description: string;
  href: string;
  icon: any;
  variant?: 'default' | 'highlight' | 'warning' | 'pro';
}) {
  return (
    <Link href={href}>
      <Card className={cn(
          "hover:shadow-md transition h-full rounded-[2.5rem] group overflow-hidden border-2",
          variant === 'highlight' ? "bg-primary/5 border-primary/20" : 
          variant === 'warning' ? "bg-amber-50 border-amber-200" :
          variant === 'pro' ? "bg-slate-900 border-primary/30 text-white" :
          "border-black/5 hover:border-primary/30"
      )}>
        <CardHeader className="flex flex-row gap-4 items-center">
          <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center transition-colors shadow-inner",
              variant === 'highlight' ? "bg-primary text-white" : 
              variant === 'warning' ? "bg-amber-500 text-white" :
              variant === 'pro' ? "bg-primary text-white" :
              "bg-primary/5 text-primary group-hover:bg-primary group-hover:text-white"
          )}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">{title}</CardTitle>
            <CardDescription className={cn(
                "text-[10px] font-bold uppercase opacity-40",
                variant === 'pro' && "text-primary/60 opacity-100"
            )}>{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default async function AdminDashboardPage() {
  return (
    <div className="container mx-auto px-4 py-10 space-y-16 max-w-7xl pb-32">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5">
        <div>
            <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none">Admin Hub</h1>
            <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">System-wide Authority</p>
        </div>
        <div className="flex gap-3">
            <DesignButton />
            <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                System Health: Operational
            </div>
        </div>
      </div>

      <Suspense fallback={<StatsSkeleton />}>
        <StatsGrid />
      </Suspense>

      {/* Advanced Capabilities Section */}
      <section className="space-y-6">
        <div className="flex items-center justify-between">
            <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
                <Cpu className="h-6 w-6 text-primary" />
                Advanced Platform Blueprint
            </h2>
            <Badge variant="outline" className="rounded-full border-primary text-primary px-4 py-1 font-black text-[10px] tracking-widest uppercase">High Performance Mode</Badge>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ActionCard
            title="Comprehensive Overview"
            description="Deep-dive into the Advanced Architecture and UX."
            href="/dashboard/admin/app-overview"
            icon={FileSignature}
            variant="pro"
          />
          <ActionCard
            title="Biometric Security"
            description="Audit Fingerprint and Voice ID auth flows."
            href="/dashboard/admin/fingerprint-help"
            icon={Fingerprint}
          />
          <ActionCard
            title="NLU Brain Center"
            description="Configure Multilingual Voice Intelligence."
            href="/dashboard/voice-commands"
            icon={Globe}
          />
        </div>
      </section>

      {/* Diagnostics & Verification Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <Activity className="h-6 w-6 text-amber-500" />
            Reliability & Offline Diagnostics
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <ActionCard
            title="Instant PWA Install"
            description="Verify Service Worker and Local-First status."
            href="/dashboard/offline-audit"
            icon={Zap}
            variant="warning"
          />
          <ActionCard
            title="Performance Monitor"
            description="Analyze N+1 read fixes and operational indexing."
            href="/dashboard/admin/performance-audit"
            icon={TrendingUp}
          />
        </div>
      </section>

      {/* UI/UX Code Section */}
      <section className="space-y-6 bg-primary/5 p-10 rounded-[3rem] border border-primary/10">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2 text-primary">
            <FileCode className="h-6 w-6" />
            Platform Core Logic
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ActionCard title="Homepage UX" description="Individual Data scrollers." href="/dashboard/admin/homepage-help" icon={ArrowRight} />
          <ActionCard title="Menu Display" description="QR session & Cart logic." href="/dashboard/admin/menu-help" icon={ArrowRight} />
          <ActionCard title="Store Hub" description="Digital Menu & POS source." href="/dashboard/admin/my-store-help" icon={ArrowRight} />
          <ActionCard title="My Activity" description="Unified Customer history code." href="/dashboard/admin/my-orders-help" icon={ArrowRight} />
        </div>
      </section>

      {/* System Operations Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <Cog className="h-6 w-6 text-primary" />
            System Operations
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ActionCard title="Sales Reports" description="Margin and cost analytics." href="/dashboard/owner/sales-report" icon={BarChart3} />
          <ActionCard title="Master Catalog" description="Global item & pricing control." href="/dashboard/owner/my-store" icon={Store} />
          <ActionCard title="Security Rules" description="Firestore protection layers." href="/dashboard/admin/security-rules" icon={Shield} />
          <ActionCard title="Specialist" description="AI Recipe & Service engineering." href="/dashboard/admin/recipe-tester" icon={Beaker} />
          <ActionCard title="Training Ground" description="Human-in-the-loop AI learning." href="/dashboard/admin/training-ground" icon={Lightbulb} />
          <ActionCard title="Visual Control" description="Manage all platform visual IDs." href="/dashboard/admin/image-management" icon={ImageIcon} />
        </div>
      </section>
      
      <div className="flex justify-center pt-10">
         <ActionCard 
            title="System Source" 
            description="Inspect the hub UI/UX code." 
            href="/dashboard/admin/dashboard-help" 
            icon={FileCode} 
        />
      </div>
    </div>
  );
}
