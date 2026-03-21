'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { 
    Users, 
    Store, 
    ShoppingBag, 
    ArrowRight, 
    Server, 
    Bot, 
    Shield, 
    ImageIcon, 
    Lightbulb, 
    FileCode, 
    Video, 
    QrCode, 
    Loader2,
    RefreshCw,
    TrendingUp,
    Database,
    Zap,
    Lock,
    ShieldCheck,
    Smartphone,
    FileSignature
} from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Store as StoreType, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useAppStore } from '@/lib/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

function StatCard({ title, value, icon: Icon, loading }: { title: string, value: string | number, icon: React.ElementType, loading?: boolean }) {
    return (
        <Card className="rounded-[2rem] border-0 shadow-lg overflow-hidden group hover:shadow-2xl transition-all bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{t(title)}</span>
                <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-3xl font-black tracking-tighter">{value}</div>}
            </CardContent>
        </Card>
    )
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
        return <Skeleton className="h-24 w-full rounded-2xl" />;
    }

    return (
         <Accordion type="single" collapsible className="w-full mb-8">
            <AccordionItem value="store-owners" className="border-0">
                <AccordionTrigger className="hover:no-underline">
                     <div className="flex justify-between items-center w-full pr-4">
                        <div className="text-left">
                            <h2 className="text-xl font-black uppercase tracking-tight">Active Merchants ({storeOwners.length})</h2>
                            <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Verified store owners on platform</p>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <Card className="rounded-2xl border-0 shadow-inner bg-black/5 overflow-hidden">
                        <Table>
                            <TableHeader className="bg-black/5">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase">Owner Name</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Email</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Business</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {storeOwners.map(owner => {
                                    const store = getStoreForOwner(owner.id);
                                    return (
                                        <TableRow key={owner.id} className="border-b border-black/5 last:border-0">
                                            <TableCell className="font-bold text-xs">{owner.firstName} {owner.lastName}</TableCell>
                                            <TableCell className="text-xs opacity-60 font-mono">{owner.email}</TableCell>
                                            <TableCell className="font-black text-xs uppercase text-primary">{store?.name || '—'}</TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </Card>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
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
                            <CardTitle className="text-sm font-black uppercase tracking-tight">{t(title)}</CardTitle>
                            <CardDescription className="text-[10px] font-bold opacity-40 uppercase mt-1 leading-tight">{t(description)}</CardDescription>
                        </div>
                    </div>
                </CardHeader>
            </Card>
        </Link>
    );
}

export default function AdminDashboardPage() {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();

    // Queries for stats
    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const storesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'stores'), where('isClosed', '!=', true)) : null, [firestore]);
    const deliveredOrdersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'orders'), where('status', '==', 'Delivered')) : null, [firestore]);

    const { data: users, isLoading: usersLoading } = useCollection(usersQuery);
    const { data: stores, isLoading: storesLoading } = useCollection(storesQuery);
    const { data: deliveredOrders, isLoading: ordersLoading } = useCollection<Order>(deliveredOrdersQuery);

    const stats = useMemo(() => ({
        totalUsers: users?.length ?? 0,
        totalStores: stores?.length ?? 0,
        totalOrdersDelivered: deliveredOrders?.length ?? 0,
    }), [users, stores, deliveredOrders]);

    const statsLoading = isAdminLoading || usersLoading || storesLoading || ordersLoading;

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/dashboard');
        }
    }, [isAdminLoading, isAdmin, router]);

    if (isAdminLoading || !isAdmin) {
        return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32 animate-in fade-in duration-700">
            <div className="flex justify-between items-end border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">System Hub</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Administrative Operational Intelligence</p>
                </div>
                <Button variant="outline" size="sm" className="rounded-full h-10 px-4 border-2 font-black text-[10px] uppercase tracking-widest shadow-sm">
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
                </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="total-users" value={stats.totalUsers} icon={Users} loading={statsLoading} />
                <StatCard title="total-stores" value={stats.totalStores} icon={Store} loading={statsLoading} />
                <StatCard title="orders-delivered" value={stats.totalOrdersDelivered} icon={ShoppingBag} loading={statsLoading} />
            </div>

            <StoreOwnersList />

            <div className="space-y-6">
                 <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 px-1">Infrastructure Modules</h2>
                 <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                     <AdminActionCard 
                        title="System Status"
                        description="Live health check of platform services."
                        href="/dashboard/admin/system-status"
                        icon={Server}
                    />
                    <AdminActionCard 
                        title="App Overview"
                        description="Architecture & feature breakdown."
                        href="/dashboard/admin/app-overview"
                        icon={FileSignature}
                    />
                    <AdminActionCard 
                        title="Market Catalog"
                        description="Manage master products and prices."
                        href="/dashboard/owner/my-store"
                        icon={Store}
                    />
                    <AdminActionCard
                        title="Security Rules"
                        description="Production Firestore rule inspection."
                        href="/dashboard/admin/security-rules"
                        icon={Shield}
                    />
                    <AdminActionCard
                        title="Image Management"
                        description="Centralized asset control."
                        href="/dashboard/admin/image-management"
                        icon={ImageIcon}
                    />
                     <AdminActionCard 
                        title="PWA Settings"
                        description="Progressive Web App configuration."
                        href="/dashboard/admin/manifest-help"
                        icon={Smartphone}
                    />
                </div>
            </div>
        </div>
    );
}
