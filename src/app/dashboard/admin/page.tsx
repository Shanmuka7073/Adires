
'use client';

import {
  Users,
  Store,
  ShoppingBag,
  Mic,
  Bot,
  Lightbulb,
  Beaker,
  Shield,
  ImageIcon,
  FileCode,
  Video,
  QrCode,
  Server,
  FileSignature,
  Voicemail,
  KeyRound,
  Package,
  HelpCircle,
  BrainCircuit,
  TrendingUp,
  UserPlus,
  ArrowRight,
  Database,
  Truck,
  Smartphone,
  Briefcase,
  Cog,
  Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useMemo, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import type { Order, Store as StoreType, User } from '@/lib/types';
import { t } from '@/lib/locales';
import { Button } from '@/components/ui/button';

function StatCard({ title, value, icon: Icon, loading }: any) {
  return (
    <Card className="rounded-3xl border-0 shadow-lg bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
        <Icon className="h-4 w-4 text-primary opacity-20" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-3xl font-black text-gray-950 tracking-tighter">{value}</div>}
      </CardContent>
    </Card>
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
          "hover:shadow-md transition h-full rounded-3xl group",
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
            <CardDescription className="text-xs">{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}

export default function AdminDashboardPage() {
  const { firestore } = useFirebase();
  const router = useRouter();
  const { isAdmin, isLoading } = useAdminAuth();

  const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
  const storesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'stores') : null, [firestore]);
  const ordersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'orders'), where('status', 'in', ['Delivered', 'Completed'])) : null, [firestore]);

  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);
  const { data: stores, isLoading: storesLoading } = useCollection<StoreType>(storesQuery);
  const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

  useEffect(() => {
    if (!isLoading && !isAdmin) router.replace('/dashboard');
  }, [isLoading, isAdmin, router]);

  const stats = useMemo(() => ({
    totalUsers: users?.length ?? 0,
    totalStores: stores?.length ?? 0,
    totalOrdersDelivered: orders?.length ?? 0,
  }), [users, stores, orders]);

  const statsLoading = isLoading || usersLoading || storesLoading || ordersLoading;

  if (isLoading || !isAdmin) return <div className="container mx-auto p-10"><Skeleton className="h-64 w-full rounded-3xl" /></div>;

  return (
    <div className="container mx-auto px-4 py-10 space-y-16 max-w-7xl">
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5">
        <div>
            <h1 className="text-6xl font-black font-headline tracking-tighter">Admin Hub</h1>
            <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">System-wide Authority</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
            <Server className="h-3 w-3" /> System Health: Operational
        </div>
      </div>

      <section className="grid md:grid-cols-3 gap-8">
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} loading={statsLoading} />
        <StatCard title="Active Stores" value={stats.totalStores} icon={Store} loading={statsLoading} />
        <StatCard title="Completed Orders" value={stats.totalOrdersDelivered} icon={ShoppingBag} loading={statsLoading} />
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Developer Support
        </h2>
        <div className="grid md:grid-cols-2 gap-6">
          <ActionCard
            title="AI Support Context"
            description="Generate a complete system blueprint to share with AI assistants for debugging."
            href="/dashboard/admin/support-prompt"
            icon={Bot}
            variant="highlight"
          />
          <ActionCard
            title="Performance Audit"
            description="Track Firestore read/write patterns and verify indexing optimizations."
            href="/dashboard/admin/performance-audit"
            icon={TrendingUp}
          />
        </div>
      </section>

      <section className="space-y-6 bg-primary/5 p-10 rounded-[3rem] border border-primary/10">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <FileCode className="h-6 w-6 text-primary" />
            Platform UI/UX Code
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ActionCard title="Homepage UX" description="Category grid and header code." href="/dashboard/admin/homepage-help" icon={ArrowRight} />
          <ActionCard title="Menu Display" description="QR menu and cart integration." href="/dashboard/admin/menu-help" icon={ArrowRight} />
          <ActionCard title="Store Dashboard" description="Inventory management UI." href="/dashboard/admin/my-store-help" icon={ArrowRight} />
          <ActionCard title="Order History" description="Customer tracking UI." href="/dashboard/admin/my-orders-help" icon={ArrowRight} />
        </div>
      </section>

      <section className="space-y-6">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <Cog className="h-6 w-6 text-primary" />
            System & Operations
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ActionCard title="Master Catalog" description="Global product database." href="/dashboard/owner/my-store" icon={Store} />
          <ActionCard title="Voice Commands" description="Natural language mapping." href="/dashboard/voice-commands" icon={Mic} />
          <ActionCard title="Security Rules" description="Firestore protection policy." href="/dashboard/admin/security-rules" icon={Shield} />
          <ActionCard title="System Status" description="Cloud health dashboard." href="/dashboard/admin/system-status" icon={Server} />
        </div>
      </section>
    </div>
  );
}
