
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
} from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, updateDoc } from 'firebase/firestore';
import { useMemo, useEffect, useState, useTransition, useRef } from 'react';
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

function StoreOwnersList() {
    const { firestore } = useFirebase();
    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const storesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'stores') : null, [firestore]);

    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
    const { data: stores, isLoading: storesLoading } = useCollection<StoreType>(storesQuery);
    
    const storeOwners = useMemo(() => {
        if (!users || !stores) return [];
        const storeOwnerIds = new Set(stores.map(s => s.ownerId));
        return users.filter(u => storeOwnerIds.has(u.id));
    }, [users, stores]);

    const getStoreForOwner = (ownerId: string) => {
        return stores?.find(s => s.ownerId === ownerId);
    }

    if (usersLoading || storesLoading) {
        return <Skeleton className="h-24 w-full" />;
    }

    return (
         <Accordion type="single" collapsible className="w-full mb-8">
            <AccordionItem value="store-owners">
                <AccordionTrigger>
                     <div className="flex justify-between items-center w-full pr-4">
                        <div>
                            <h2 className="text-xl font-bold font-headline">Store Owners ({storeOwners.length})</h2>
                            <p className="text-sm text-muted-foreground text-left">A list of all users who have created a store.</p>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <Card>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Owner Name</TableHead>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Store Name</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {storeOwners.map(owner => {
                                        const store = getStoreForOwner(owner.id);
                                        return (
                                            <TableRow key={owner.id}>
                                                <TableCell className="font-medium">{owner.firstName} {owner.lastName}</TableCell>
                                                <TableCell>{owner.email}</TableCell>
                                                <TableCell>{store?.name || 'N/A'}</TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    )
}


/* ---------------- STAT CARD ---------------- */

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

function LowStockAlerts() {
    const { productPrices, masterProducts, fetchProductPrices, loading } = useAppStore();
    const { firestore } = useFirebase();

    useEffect(() => {
        if (firestore && masterProducts.length > 0) {
            const productNamesToFetch = masterProducts.map(p => p.name);
            fetchProductPrices(firestore, productNamesToFetch);
        }
    }, [firestore, masterProducts, fetchProductPrices]);

    const lowStockItems = useMemo(() => {
        const items: { productName: string; variant: ProductVariant }[] = [];
        if (!productPrices) return items;

        Object.values(productPrices).forEach(priceData => {
            if (priceData && priceData.variants) {
                priceData.variants.forEach(variant => {
                    if (variant.stock <= 10) {
                        items.push({ productName: priceData.productName, variant });
                    }
                });
            }
        });
        return items;
    }, [productPrices]);

    if (loading) {
        return (
            <div className="space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
            </div>
        )
    }

    if (lowStockItems.length === 0) {
        return null;
    }

    return (
        <div className="mb-8">
            <h2 className="text-2xl font-bold text-center mb-4 font-headline text-destructive">Low Stock Alerts</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {lowStockItems.map(({ productName, variant }, index) => (
                    <Alert key={`${productName}-${index}`} variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Low Stock: {productName}</AlertTitle>
                        <AlertDescription>
                            The variant "{variant.weight}" has only <strong>{variant.stock}</strong> items left.
                        </AlertDescription>
                    </Alert>
                ))}
            </div>
        </div>
    )
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
      <Card className="hover:shadow-md transition h-full">
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
        <h1 className="text-4xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Platform overview, operations & system control
        </p>
      </div>

      {/* ================= STATS ================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard title="Total Users" value={stats.totalUsers} icon={Users} loading={statsLoading} />
        <StatCard title="Active Stores" value={stats.totalStores} icon={Store} loading={statsLoading} />
        <StatCard title="Orders Delivered" value={stats.totalOrdersDelivered} icon={ShoppingBag} loading={statsLoading} />
      </div>
      
      <LowStockAlerts />
      <StoreOwnersList />

      {/* ================= OPERATIONS ================= */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold">Operations</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <CreateRestaurantUserForm />
          <ActionCard
            title="QR Menu Manager"
            description="Create and manage restaurant QR menus"
            href="/dashboard/owner/menu-manager"
            icon={QrCode}
          />
           <ActionCard
            title="Restaurant Ingredient Costs"
            description="Manage the cost price of raw ingredients for restaurants."
            href="/dashboard/admin/restaurant-inventory"
            icon={ChefHat}
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
            href="/dashboard/owner/sales-report"
            icon={BarChart3}
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
            title="Asha AI Agent"
            description="Use the conversational diagnostic assistant."
            href="/dashboard/admin/asha-agent"
            icon={BrainCircuit}
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
        <h2 className="text-2xl font-bold">System & Debugging (Seek Help)</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
           <ActionCard
            title="System Status"
            description="Check the health of backend services and APIs."
            href="/dashboard/admin/system-status"
            icon={Server}
          />
           <ActionCard
            title="App Pitch"
            description="Review and share the official app pitch document."
            href="/dashboard/admin/pitch"
            icon={FileText}
          />
          <ActionCard
            title="App Overview"
            description="Get a complete breakdown of the app's features and design."
            href="/dashboard/admin/app-overview"
            icon={FileSignature}
          />
          <ActionCard
            title="Economics Breakdown"
            description="Explanation of how the app calculates profit and efficiency."
            href="/dashboard/admin/economics-breakdown"
            icon={TrendingUp}
          />
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
            title="Security Rules"
            description="View database security rules"
            href="/dashboard/admin/security-rules"
            icon={Shield}
          />
           <ActionCard
            title="Firebase Rules"
            description="View the root firestore.rules file."
            href="/dashboard/admin/firebase-rules-help"
            icon={Shield}
          />
           <ActionCard
            title="Performance Audit"
            description="View a detailed breakdown of Firestore usage and costs."
            href="/dashboard/admin/performance-audit"
            icon={BarChart3}
          />
          <ActionCard
            title="PWA Manifest"
            description="Edit Progressive Web App settings"
            href="/dashboard/admin/manifest-help"
            icon={FileCode}
          />
           <ActionCard
            title="Recipe Cache Code"
            description="View the source code for the recipe caching logic."
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
          <ActionCard
            title="Sales Report Code"
            description="View the source code for the sales and profit analysis report."
            href="/dashboard/admin/sales-report-help"
            icon={BarChart3}
          />
          <ActionCard
            title="Voice Commander Code"
            description="View source for the main voice command processing logic."
            href="/dashboard/admin/voice-commander-help"
            icon={Mic}
          />
           <ActionCard
            title="Checkout Loop Debug"
            description="Isolate the specific code related to the checkout page command loop."
            href="/dashboard/admin/checkout-loop-help"
            icon={Bug}
          />
        </div>
      </section>
    </div>
  );
}

    
