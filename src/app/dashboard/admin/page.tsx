
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
  ZapOff,
  Truck,
  PackageSearch,
  Smartphone,
  Briefcase,
  Binary
} from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc } from 'firebase/firestore';
import { useMemo, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import type { Order, Store as StoreType, User } from '@/lib/types';
import { t } from '@/lib/locales';
import { Button } from '@/components/ui/button';
import { createRestaurantUserAndStore } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAppStore } from '@/lib/store';

const ADMIN_EMAIL = 'admin@gmail.com';

function CreateRestaurantUserForm() {
    const { toast } = useToast();
    const [isCreating, startCreation] = useTransition();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [restaurantName, setRestaurantName] = useState('');

    const handleCreate = () => {
        if (!email || !password || !restaurantName) {
            toast({ variant: 'destructive', title: 'All fields are required.' });
            return;
        }

        startCreation(async () => {
            const result = await createRestaurantUserAndStore(email, password, restaurantName);
            if (result.success) {
                toast({
                    title: 'Restaurant Account Created!',
                    description: `User ${email} and store "${restaurantName}" have been created successfully.`,
                });
                setEmail('');
                setPassword('');
                setRestaurantName('');
            } else {
                toast({
                    variant: 'destructive',
                    title: 'Creation Failed',
                    description: result.error || 'An unknown error occurred.',
                });
            }
        });
    };

    return (
        <Card className="rounded-3xl shadow-md border-0 bg-white">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-6 w-6 text-primary" />
                    Create Restaurant Account
                </CardTitle>
                <CardDescription>Quickly create a new user and an associated store.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="space-y-2">
                    <Label htmlFor="res-email">Owner's Email</Label>
                    <Input id="res-email" type="email" placeholder="owner@example.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={isCreating} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="res-password">Password</Label>
                    <Input id="res-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} disabled={isCreating} />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="res-name">Restaurant Name</Label>
                    <Input id="res-name" placeholder="e.g., Paradise Biryani" value={restaurantName} onChange={(e) => setRestaurantName(e.target.value)} disabled={isCreating} />
                </div>
                <Button onClick={handleCreate} disabled={isCreating} className="w-full h-12 rounded-xl font-bold">
                    {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Create Account & Store
                </Button>
            </CardContent>
        </Card>
    );
}

function StatCard({ title, value, icon: Icon, loading }: any) {
  return (
    <Card className="rounded-3xl border-0 shadow-lg bg-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t(title)}</CardTitle>
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
}: {
  title: string;
  description: string;
  href: string;
  icon: any;
}) {
  return (
    <Link href={href}>
      <Card className="hover:shadow-md transition h-full border-primary/10 hover:border-primary/30 rounded-3xl group">
        <CardHeader className="flex flex-row gap-4 items-center">
          <div className="h-12 w-12 rounded-2xl bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors shadow-inner">
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

  const usersQuery = useMemoFirebase(() =>
    firestore ? collection(firestore, 'users') : null,
    [firestore],
  );

  const storesQuery = useMemoFirebase(() =>
    firestore ? collection(firestore, 'stores') : null,
    [firestore],
  );

  const ordersQuery = useMemoFirebase(() =>
    firestore
      ? query(collection(firestore, 'orders'), where('status', 'in', ['Delivered', 'Completed']))
      : null,
    [firestore],
  );

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

  if (isLoading || !isAdmin) {
    return (
        <div className="container mx-auto px-4 py-10 space-y-16">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-10 space-y-16 max-w-7xl">

      {/* ================= HEADER ================= */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5">
        <div>
            <h1 className="text-6xl font-black font-headline tracking-tighter">Admin Hub</h1>
            <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">System-wide Authority</p>
        </div>
        <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
            <Server className="h-3 w-3" /> System Health: Operational
        </div>
      </div>

      {/* ================= STATS ================= */}
      <section className="grid md:grid-cols-3 gap-8">
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} loading={statsLoading} />
        <StatCard title="Active Stores" value={stats.totalStores} icon={Store} loading={statsLoading} />
        <StatCard title="Completed Orders" value={stats.totalOrdersDelivered} icon={ShoppingBag} loading={statsLoading} />
      </section>

      {/* ================= OPERATIONS ================= */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <Briefcase className="h-6 w-6 text-primary" />
            Operations & Onboarding
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CreateRestaurantUserForm />
          <ActionCard
            title="QR Menu Manager"
            description="Manage and generate restaurant floor maps and QR codes."
            href="/dashboard/owner/menu-manager"
            icon={QrCode}
          />
           <ActionCard
            title="Master Product Catalog"
            description="Edit global products, images, and base pricing."
            href="/dashboard/owner/my-store"
            icon={Store}
          />
        </div>
      </section>

      {/* ================= GUIDES & DOCUMENTATION ================= */}
      <section className="space-y-6 bg-primary/5 p-10 rounded-[3rem] border border-primary/10">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Infrastructure Docs
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ActionCard
            title="App Overview"
            description="Complete guide to Restaurant POS, KDS, and PWA features."
            href="/dashboard/admin/app-overview"
            icon={FileSignature}
          />
          <ActionCard
            title="Home Delivery Guide"
            description="Details on GPS pinning, live tracking, and countdowns."
            href="/dashboard/admin/deliveries-help"
            icon={Truck}
          />
          <ActionCard
            title="Economics Breakdown"
            description="Learn how we calculate Gross Profit and Efficiency."
            href="/dashboard/admin/economics-breakdown"
            icon={TrendingUp}
          />
          <ActionCard
            title="PWA & App Install"
            description="Standalone restaurant apps using dynamic manifests."
            href="/dashboard/admin/manifest-help"
            icon={Smartphone}
          />
        </div>
      </section>

      {/* ================= AI & VOICE TRAINING ================= */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <BrainCircuit className="h-6 w-6 text-primary" />
            AI Training & Maintenance
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ActionCard
            title="Voice Command Editor"
            description="Manage general commands and conversational replies."
            href="/dashboard/voice-commands"
            icon={Mic}
          />
          <ActionCard
            title="Voice Error Center"
            description="Review logs of failed commands and teach new aliases."
            href="/dashboard/admin/failed-commands"
            icon={Bot}
          />
          <ActionCard
            title="AI Training Ground"
            description="Paste text from any source to teach the AI new concepts."
            href="/dashboard/admin/training-ground"
            icon={Lightbulb}
          />
        </div>
      </section>

      {/* ================= SYSTEM & INFRASTRUCTURE ================= */}
      <section className="space-y-6">
        <h2 className="text-2xl font-black font-headline uppercase tracking-tight flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            System & Performance
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ActionCard
            title="Performance Audit"
            description="Track Firestore read/write patterns and optimize costs."
            href="/dashboard/admin/performance-audit"
            icon={BarChart3}
          />
          <ActionCard
            title="Security Policy"
            description="View production Firestore rules and permission logic."
            href="/dashboard/admin/security-rules"
            icon={Shield}
          />
          <ActionCard
            title="Data Architecture"
            description="View core fetching logic and initial data parallelization."
            href="/dashboard/admin/initial-data-help"
            icon={Database}
          />
        </div>
      </section>
    </div>
  );
}

function BarChart3(props: any) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M3 3v18h18" />
            <path d="M18 17V9" />
            <path d="M13 17V5" />
            <path d="M8 17v-3" />
        </svg>
    )
}
