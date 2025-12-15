
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
} from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import { useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import type { Order, Store as StoreType } from '@/lib/types';
import { t } from '@/lib/locales';

/* ---------------- STAT CARD ---------------- */

function StatCard({ title, value, icon: Icon }: any) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm text-muted-foreground">{t(title)}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

/* ---------------- ACTION CARD ---------------- */

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
      <Card className="hover:shadow-md transition">
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

/* ---------------- MAIN PAGE ---------------- */

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
      ? query(collection(firestore, 'orders'), where('status', '==', 'Delivered'))
      : null,
    [firestore],
  );

  const { data: users, isLoading: usersLoading } = useCollection(usersQuery);
  const { data: stores, isLoading: storesLoading } = useCollection<StoreType>(storesQuery);
  const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

  useEffect(() => {
    if (!isLoading && !isAdmin) router.replace('/dashboard');
  }, [isLoading, isAdmin, router]);

  if (isLoading || usersLoading || storesLoading || ordersLoading) {
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
        <h1 className="text-4xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview, operations & system control
        </p>
      </div>

      {/* ================= ATTENTION ================= */}
      <Card className="border-destructive">
        <CardHeader className="flex flex-row gap-3 items-center">
          <AlertTriangle className="h-6 w-6 text-destructive" />
          <div>
            <CardTitle>Attention Required</CardTitle>
            <CardDescription>
              Review failed voice commands, low stock items or system alerts
            </CardDescription>
          </div>
        </CardHeader>
      </Card>

      {/* ================= STATS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Users" value={users?.length ?? 0} icon={Users} />
        <StatCard title="Active Stores" value={stores?.length ?? 0} icon={Store} />
        <StatCard title="Orders Delivered" value={orders?.length ?? 0} icon={ShoppingBag} />
      </div>

      {/* ================= OPERATIONS ================= */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Operations</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ActionCard
            title="QR Menu Manager"
            description="Create and manage restaurant QR menus"
            href="/dashboard/owner/menu-manager"
            icon={QrCode}
          />
          <ActionCard
            title="Master Store & Products"
            description="Central product catalog management"
            href="/dashboard/owner/my-store"
            icon={Store}
          />
           <ActionCard
            title="Sales Reports"
            description="View daily and monthly sales data"
            href="/dashboard/admin/sales-report"
            icon={FileCode}
          />
        </div>
      </section>

      {/* ================= AI & VOICE ================= */}
      <section className="space-y-6 bg-muted/30 p-6 rounded-xl">
        <h2 className="text-2xl font-bold">AI & Voice Control</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ActionCard
            title="Voice Commands"
            description="Manage commands users can speak"
            href="/dashboard/voice-commands"
            icon={Mic}
          />
          <ActionCard
            title="Voice Errors"
            description="Review failed voice commands"
            href="/dashboard/admin/failed-commands"
            icon={Bot}
          />
          <ActionCard
            title="AI Training"
            description="Teach AI new aliases & meanings"
            href="/dashboard/admin/training-ground"
            icon={Lightbulb}
          />
          <ActionCard
            title="Ingredient AI Tester"
            description="Test recipe ingredient generation"
            href="/dashboard/admin/recipe-tester"
            icon={Beaker}
          />
        </div>
      </section>

      {/* ================= SYSTEM & DEBUGGING ================= */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">System & Debugging</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ActionCard
            title="Live Order Video"
            description="Set kitchen live stream URL"
            href="/dashboard/admin/site-config"
            icon={Video}
          />
          <ActionCard
            title="Image Management"
            description="Manage category & placeholder images"
            href="/dashboard/admin/image-management"
            icon={ImageIcon}
          />
          <ActionCard
            title="Firestore Rules"
            description="View database security rules"
            href="/dashboard/admin/security-rules"
            icon={Shield}
          />
          <ActionCard
            title="PWA Manifest"
            description="Edit Progressive Web App settings"
            href="/dashboard/admin/manifest-help"
            icon={FileCode}
          />
           <ActionCard
            title="Recipe Cache Code"
            description="View the source for the recipe caching logic."
            href="/dashboard/admin/cached-recipes-help"
            icon={BookOpen}
          />
           <ActionCard
            title="Admin Dashboard Code"
            description="View the source code for this dashboard."
            href="/dashboard/admin/dashboard-help"
            icon={FileCode}
          />
           <ActionCard
            title="'My Orders' Page Code"
            description="View the source for the customer's order history page."
            href="/dashboard/admin/my-orders-help"
            icon={Package}
          />
           <ActionCard
            title="'Store Orders' Page Code"
            description="View the source for the owner's order management page."
            href="/dashboard/admin/store-orders-help"
            icon={Store}
          />
           <ActionCard
            title="'My Store' Page Code"
            description="View the source for the owner's store management page."
            href="/dashboard/admin/my-store-help"
            icon={Store}
          />
          <ActionCard
            title="Menu Page Code"
            description="View the source code for the public-facing QR menu page."
            href="/dashboard/admin/menu-help"
            icon={FileCode}
          />
        </div>
      </section>
    </div>
  );
}
