
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
  AlertTriangle,
  Server,
  FileText,
  FileSignature,
  Fingerprint,
  Voicemail,
  KeyRound,
  Bug,
  Package,
  BookOpen,
  HelpCircle,
  BrainCircuit,
  BarChart3,
  ChefHat,
  TrendingUp,
  UserPlus,
  ArrowRight,
  Edit,
  Search,
  Download,
  Database,
  ZapOff,
  Truck,
  PackageSearch,
  FileJson,
  Smartphone
} from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useMemo, useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import type { Order, Store as StoreType, User, ProductPrice, ProductVariant, Product } from '@/lib/types';
import { t } from '@/lib/locales';
import { Button } from '@/components/ui/button';
import { createRestaurantUserAndStore } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2 } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';


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
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <UserPlus className="h-6 w-6 text-primary" />
                    Create Restaurant Account
                </CardTitle>
                <CardDescription>Quickly create a new user and an associated store for a restaurant owner.</CardDescription>
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
                <Button onClick={handleCreate} disabled={isCreating} className="w-full">
                    {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                    Create Account & Store
                </Button>
            </CardContent>
        </Card>
    );
}

function StatCard({ title, value, icon: Icon, loading }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm text-muted-foreground">{t(title)}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{value}</div>}
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
      <Card className="hover:shadow-md transition h-full border-primary/10 hover:border-primary/30">
        <CardHeader className="flex flex-row gap-4 items-center">
          <Icon className="h-8 w-8 text-primary" />
          <div>
            <CardTitle>{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
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
    <div className="container mx-auto px-4 py-10 space-y-16">

      {/* ================= HEADER ================= */}
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-bold font-headline">Admin Control Center</h1>
        <p className="text-muted-foreground">
          Platform-wide health, operations, and feature documentation.
        </p>
      </div>

      {/* ================= STATS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} loading={statsLoading} />
        <StatCard title="Active Stores" value={stats.totalStores} icon={Store} loading={statsLoading} />
        <StatCard title="Orders Completed" value={stats.totalOrdersDelivered} icon={ShoppingBag} loading={statsLoading} />
      </div>

      {/* ================= OPERATIONS ================= */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
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
           <ActionCard
            title="Restaurant Ingredient Costs"
            description="Set standard cost prices for raw materials used in recipes."
            href="/dashboard/admin/restaurant-inventory"
            icon={ChefHat}
          />
        </div>
      </section>

      {/* ================= GUIDES & DOCUMENTATION ================= */}
      <section className="space-y-6 bg-primary/5 p-8 rounded-[2.5rem] border border-primary/10">
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <HelpCircle className="h-6 w-6 text-primary" />
            Features: How It Works
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ActionCard
            title="App Overview"
            description="A complete guide to Restaurant POS, KDS, and PWA features."
            href="/dashboard/admin/app-overview"
            icon={FileSignature}
          />
          <ActionCard
            title="Home Delivery Guide"
            description="Details on GPS pinning, live tracking, and the 20-min countdown."
            href="/dashboard/admin/deliveries-help"
            icon={Truck}
          />
          <ActionCard
            title="Economics Breakdown"
            description="Learn how the app calculates Gross Profit and Table Efficiency."
            href="/dashboard/admin/economics-breakdown"
            icon={TrendingUp}
          />
          <ActionCard
            title="PWA & App Install"
            description="How we create standalone restaurant apps using dynamic manifests."
            href="/dashboard/admin/manifest-help"
            icon={Smartphone}
          />
        </div>
      </section>

      {/* ================= AI & VOICE TRAINING ================= */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
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
            description="Review logs of failed commands and teach the AI new aliases."
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
        <h2 className="text-2xl font-bold flex items-center gap-2">
            <Server className="h-6 w-6 text-primary" />
            System & Performance
        </h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
           <ActionCard
            title="System Health"
            description="Monitor service availability and API status."
            href="/dashboard/admin/system-status"
            icon={Server}
          />
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
          <ActionCard
            title="Read Explosion Fix"
            description="Technical analysis of N+1 query optimization strategies."
            href="/dashboard/admin/read-explosion-help"
            icon={ZapOff}
          />
           <ActionCard
            title="WebAuthn API"
            description="Source code for secure biometric and fingerprint login routes."
            href="/dashboard/admin/webauthn-api-help"
            icon={Fingerprint}
          />
        </div>
      </section>
    </div>
  );
}
