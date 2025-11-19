
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Store, ShoppingBag, ArrowRight, Mic, List, FileText, Server, BookOpen, Beaker, Bot, FileSignature, Shield, BrainCircuit } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Store as StoreType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';

function StatCard({ title, value, icon: Icon, loading }: { title: string, value: string | number, icon: React.ElementType, loading?: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t(title)}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{value}</div>}
            </CardContent>
        </Card>
    )
}

function CreateMasterStoreCard() {
    return (
        <Alert variant="destructive" className="mb-8">
            <AlertTitle>{t('action-required-create-master-store')}</AlertTitle>
            <AlertDescription>
                {t('the-master-store-for-setting-platform-wide')}
                <Button asChild className="mt-4">
                    <Link href="/dashboard/owner/my-store">
                        {t('create-master-store')} <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </AlertDescription>
        </Alert>
    )
}

function AdminActionCard({ title, description, href, icon: Icon }: { title: string, description: string, href: string, icon: React.ElementType }) {
    return (
        <Link href={href} className="block hover:shadow-lg transition-shadow rounded-lg">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <Icon className="h-8 w-8 text-primary" />
                        <CardTitle>{t(title)}</CardTitle>
                    </div>
                </CardHeader>
                <CardContent>
                    <CardDescription>{t(description)}</CardDescription>
                </CardContent>
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
    
    const adminStoreQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'stores'), where('name', '==', 'LocalBasket'));
    }, [firestore]);


    const { data: users, isLoading: usersLoading } = useCollection(usersQuery);
    const { data: stores, isLoading: storesLoading } = useCollection(storesQuery);
    const { data: deliveredOrders, isLoading: ordersLoading } = useCollection<Order>(deliveredOrdersQuery);
    const { data: adminStores, isLoading: adminStoreLoading } = useCollection<StoreType>(adminStoreQuery);

    const masterStoreExists = useMemo(() => adminStores && adminStores.length > 0, [adminStores]);

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

    if (isAdminLoading || adminStoreLoading || !isAdmin) {
        return <p>Loading admin dashboard...</p>
    }

    const statItems = [
        { title: 'total-users', value: stats.totalUsers, icon: Users },
        { title: 'total-stores', value: stats.totalStores, icon: Store },
        { title: 'orders-delivered', value: stats.totalOrdersDelivered, icon: ShoppingBag },
    ];


    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">{t('admin-dashboard')}</h1>
                <p className="text-lg text-muted-foreground mt-2">{t('a-high-level-overview-of-your-application')}</p>
            </div>
            
            {!masterStoreExists && <CreateMasterStoreCard />}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {statItems.map(item => (
                    <StatCard 
                        key={item.title} 
                        title={item.title}
                        value={item.value}
                        icon={item.icon}
                        loading={statsLoading}
                    />
                ))}
            </div>

            <div className="mt-16">
                 <h2 className="text-2xl font-bold text-center mb-8 font-headline">{t('admin-tools')}</h2>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
                     <AdminActionCard 
                        title="System Status"
                        description="Check the health of backend services and APIs."
                        href="/dashboard/admin/system-status"
                        icon={Server}
                    />
                     <AdminActionCard 
                        title="View App Pitch"
                        description="Review and share the official app pitch document."
                        href="/dashboard/admin/pitch"
                        icon={FileText}
                    />
                    <AdminActionCard 
                        title="App Overview"
                        description="Get a complete breakdown of the app's features and design."
                        href="/dashboard/admin/app-overview"
                        icon={FileSignature}
                    />
                    <AdminActionCard 
                        title="manage-master-store-and-products"
                        description="add-or-edit-products-in-the-master-catalog"
                        href="/dashboard/owner/my-store"
                        icon={Store}
                    />
                     <AdminActionCard 
                        title="View Product List"
                        description="See a complete list of all products available on the platform."
                        href="/dashboard/admin/product-list"
                        icon={List}
                    />
                    <AdminActionCard 
                        title="voice-commands-control"
                        description="view-and-manage-the-voice-commands-users-can-say"
                        href="/dashboard/voice-commands"
                        icon={Mic}
                    />
                    <AdminActionCard
                        title="Failed Command Center"
                        description="Review failed voice commands and use AI to train the system."
                        href="/dashboard/admin/failed-commands"
                        icon={Bot}
                    />
                     <AdminActionCard
                        title="Asha AI Agent"
                        description="Use the conversational diagnostic assistant."
                        href="/dashboard/admin/asha-agent"
                        icon={BrainCircuit}
                    />
                    <AdminActionCard
                        title="Cached Recipes"
                        description="View and manage the AI-generated recipe ingredient cache."
                        href="/dashboard/admin/cached-recipes"
                        icon={BookOpen}
                    />
                    <AdminActionCard
                        title="recipe-tester"
                        description="Manually test the AI recipe ingredient generation."
                        href="/dashboard/admin/recipe-tester"
                        icon={Beaker}
                    />
                    <AdminActionCard
                        title="Security Rules"
                        description="View and copy the current Firestore security rules for debugging."
                        href="/dashboard/admin/security-rules"
                        icon={Shield}
                    />
                </div>
            </div>
        </div>
    );
}
