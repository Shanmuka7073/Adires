'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Store, ShoppingBag, ArrowRight, Server, Smartphone, Video, Shield, ImageIcon, Home, FileCode, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Store as StoreType, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';

function StatCard({ title, value, icon: Icon, loading }: { title: string, value: string | number, icon: React.ElementType, loading?: boolean }) {
    return (
        <Card className="rounded-[2rem] border-0 shadow-lg overflow-hidden group hover:shadow-2xl transition-all bg-white">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <span className="text-[10px] font-black uppercase tracking-widest opacity-40">{t(title)}</span>
                <Icon className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold tracking-tighter">{value}</div>}
            </CardContent>
        </Card>
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

export default function PwaSettingsPage() {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();

    // Queries for stats
    const usersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'users') : null, [firestore]);
    const storesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'stores'), where('isClosed', '!=', true)) : null, [firestore]);
    const deliveredOrdersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'orders'), where('status', '==', 'Delivered')) : null, [firestore]);

    const { data: users, isLoading: usersLoading } = useCollection<User>(usersQuery);
    const { data: stores, isLoading: storesLoading } = useCollection<StoreType>(storesQuery);
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
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none">PWA Settings</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Progressive Web App Configuration</p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <StatCard title="total-users" value={stats.totalUsers} icon={Users} loading={statsLoading} />
                <StatCard title="total-stores" value={stats.totalStores} icon={Store} loading={statsLoading} />
                <StatCard title="orders-delivered" value={stats.totalOrdersDelivered} icon={ShoppingBag} loading={statsLoading} />
            </div>

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
                        title="PWA Manifest"
                        description="Configure app installation settings."
                        href="/dashboard/admin/manifest-help"
                        icon={Smartphone}
                    />
                    <AdminActionCard
                        title="Image Management"
                        description="Centralized asset control."
                        href="/dashboard/admin/image-management"
                        icon={ImageIcon}
                    />
                </div>
            </div>
        </div>
    );
}
