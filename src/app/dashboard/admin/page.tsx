
import { Suspense } from 'react';
import {
  Users,
  Store,
  ShoppingBag,
  Mic,
  Bot,
  Shield,
  FileCode,
  Server,
  TrendingUp,
  ArrowRight,
  Cog,
  Sparkles,
  BarChart3,
  PackageCheck,
  Beaker,
  Lightbulb,
  ImageIcon
} from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { DesignButton } from './design-button';
import { Skeleton } from "@/components/ui/skeleton";
import { unstable_cache } from 'next/cache';
import { getAdminServices } from '@/firebase/admin-init';

/**
 * 1. FAST DATA FETCHING (The "Read Explosion Fix")
 * Uses the Admin SDK .count().get() to perform metadata-only counts.
 * Wrapped in unstable_cache to ensure sub-100ms response times.
 */
const getPlatformStats = unstable_cache(
  async () => {
    try {
        const { db } = await getAdminServices();
        
        // Parallel metadata counts (cost = 1 read per count operation)
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
  { revalidate: 300 } // Cache for 5 minutes
);

/**
 * 2. THE UI SKELETON (What the user sees while loading)
 */
function StatsSkeleton() {
  return (
    <div className="grid md:grid-cols-3 gap-8">
      {[1, 2, 3].map((i) => (
        <Skeleton key={i} className="h-32 w-full rounded-[2rem] bg-white/50 shadow-sm" />
      ))}
    </div>
  );
}

/**
 * 3. THE STATS DISPLAY (Loads after the server counts)
 */
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
  variant?: 'default' | 'highlight';
}) {
  return (
    <Link href={href}>
      <Card className={cn(
          "hover:shadow-md transition h-full rounded-[2.5rem] group overflow-hidden",
          variant === 'highlight' ? "bg-primary/5 border-primary/20" : "border-primary/10 hover:border-primary/30"
      )}>
        <CardHeader className="flex flex-row gap-4 items-center">
          <div className={cn(
              "h-12 w-12 rounded-2xl flex items-center justify-center text-primary transition-colors shadow-inner",
              variant === 'highlight' ? "bg-primary text-white" : "bg-primary/5 group-hover:bg-primary group-hover:text-white"
          )}>
            <Icon className="h-6 w-6" />
          </div>
          <div>
            <CardTitle className="text-lg font-bold">{title}</CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase opacity-40">{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

/**
 * 4. THE MAIN PAGE (The Governor's Hub)
 */
export default async function AdminDashboardPage() {
  return (
    <div className="container mx-auto px-4 py-10 space-y-16 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5">
        <div>
            <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic">Admin Hub</h1>
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

      {/* Optimized Stats Section */}
      <Suspense fallback={<StatsSkeleton />}>
        <StatsGrid />
      </Suspense>

      {/* Developer Support Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Developer Support
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <ActionCard
            title="AI Support Context"
            description="Generate a complete system blueprint for LLMs."
            href="/dashboard/admin/support-prompt"
            icon={Bot}
            variant="highlight"
          />
          <ActionCard
            title="Performance Audit"
            description="Verify indexing and read/write optimizations."
            href="/dashboard/admin/performance-audit"
            icon={TrendingUp}
          />
        </div>
      </section>

      {/* UI/UX Code Section */}
      <section className="space-y-6 bg-primary/5 p-10 rounded-[3rem] border border-primary/10">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <FileCode className="h-6 w-6 text-primary" />
            Platform UI/UX Code
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ActionCard title="Homepage UX" description="Category grid and search logic." href="/dashboard/admin/homepage-help" icon={ArrowRight} />
          <ActionCard title="Menu Display" description="QR menu and cart integration." href="/dashboard/admin/menu-help" icon={ArrowRight} />
          <ActionCard title="Store Dashboard" description="Inventory management source." href="/dashboard/admin/my-store-help" icon={ArrowRight} />
          <ActionCard title="Order History" description="Customer tracking timeline code." href="/dashboard/admin/my-orders-help" icon={ArrowRight} />
        </div>
      </section>

      {/* System Operations Section */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <Cog className="h-6 w-6 text-primary" />
            System & Operations
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ActionCard title="Sales Reports" description="Aggregate revenue and volume data." href="/dashboard/admin/sales-report" icon={BarChart3} />
          <ActionCard title="Master Catalog" description="Global product and price control." href="/dashboard/owner/my-store" icon={Store} />
          <ActionCard title="Voice Commands" description="Natural language mapping." href="/dashboard/voice-commands" icon={Mic} />
          <ActionCard title="Security Rules" description="Firestore protection policy." href="/dashboard/admin/security-rules" icon={Shield} />
          
          {/* Restored tools */}
          <ActionCard title="Item Specialist" description="Recipe and cost engineering." href="/dashboard/admin/recipe-tester" icon={Beaker} />
          <ActionCard title="Failed Commands" description="AI training from logs." href="/dashboard/admin/failed-commands" icon={Bot} />
          <ActionCard title="AI Training" description="Alias extraction ground." href="/dashboard/admin/training-ground" icon={Lightbulb} />
          <ActionCard title="Image Control" description="Manage all platform visuals." href="/dashboard/admin/image-management" icon={ImageIcon} />
        </div>
      </section>
      
      <div className="flex justify-center pt-10">
         <ActionCard 
            title="Dashboard UI Source" 
            description="Inspect the code for this hub." 
            href="/dashboard/admin/dashboard-help" 
            icon={FileCode} 
        />
      </div>
    </div>
  );
}
