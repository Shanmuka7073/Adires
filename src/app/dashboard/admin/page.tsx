
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Store, Truck, ShoppingBag, ArrowRight, Mic, MessageSquareWarning, List, FileText, Server, Sparkles, Box, Code, ShieldAlert, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { collection, query, where, doc } from 'firebase/firestore';
import type { Order, Store as StoreType, SiteConfig } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { t } from '@/lib/locales';
import { useToast } from '@/hooks/use-toast';
import { getSystemStatus } from '@/app/actions';

const ADMIN_EMAIL = 'admin@gmail.com';

interface SystemStatus {
  llmStatus: 'Online' | 'Offline' | 'Degraded' | 'Unknown';
  serverDbStatus: 'Online' | 'Offline' | 'Unavailable' | 'Loading';
  counts: {
      users: number;
      stores: number;
      deliveryPartners: number;
      voiceCommands: number;
  }
}

function StatCard({ title, value, icon: Icon, loading, isLive = false }: { title: string, value: string | number, icon: React.ElementType, loading?: boolean, isLive?: boolean }) {
    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{t(title)}</CardTitle>
                 <div className="flex items-center gap-2">
                    {isLive && <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
                    <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent>
                {loading ? <Skeleton className="h-8 w-20" /> : <div className="text-2xl font-bold">{value}</div>}
            </CardContent>
        </Card>
    )
}

function CoreServicesStatusCard({ status, loading }: { status: SystemStatus, loading: boolean }) {
    
    const getStatusInfo = (isOnline: boolean) => {
        if (loading) return { color: 'text-yellow-500', icon: <Skeleton className="h-5 w-5 rounded-full" />, text: 'Checking...' };
        return isOnline 
            ? { color: 'text-green-500', icon: <CheckCircle className="h-5 w-5" />, text: 'Online' }
            : { color: 'text-destructive', icon: <XCircle className="h-5 w-5" />, text: 'Offline' };
    };

    const isDbOnline = status.serverDbStatus === 'Online';
    
    const services = [
        { name: 'User System', icon: Users, isOnline: isDbOnline && status.counts.users >= 0 },
        { name: 'Store Owner System', icon: Store, isOnline: isDbOnline && status.counts.stores >= 0 },
        { name: 'Delivery Partner System', icon: Truck, isOnline: isDbOnline && status.counts.deliveryPartners >= 0 },
        { name: 'Voice Commander', icon: Mic, isOnline: isDbOnline },
    ];

    return (
        <Card className="col-span-1 lg:col-span-3 border-primary/20 bg-primary/5">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Core Services Health</CardTitle>
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                    <Server className="h-4 w-4 text-muted-foreground" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {services.map(service => {
                        const statusInfo = getStatusInfo(service.isOnline);
                        return (
                            <div key={service.name} className="flex items-center gap-2 p-2 rounded-lg bg-background/50">
                                {statusInfo.icon}
                                <div>
                                    <p className="text-sm font-medium">{service.name}</p>
                                    <p className={`text-xs ${statusInfo.color}`}>{statusInfo.text}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}


function CreateMasterStoreCard() {
    return (
        <Alert variant="destructive" className="mb-8">
            <AlertCircle className="h-4 w-4" />
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
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
     const [status, setStatus] = useState<SystemStatus>({
        llmStatus: 'Offline',
        serverDbStatus: 'Loading',
        counts: { users: 0, stores: 0, deliveryPartners: 0, voiceCommands: 0 }
    });
    const [statusLoading, setStatusLoading] = useState(true);

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

    const statsLoading = isUserLoading || usersLoading || storesLoading || ordersLoading;
    
    // Effect to fetch system status periodically
    useEffect(() => {
        const fetchStatus = async () => {
            try {
                const serverStatus = await getSystemStatus();
                setStatus(prev => ({
                    ...prev,
                    serverDbStatus: serverStatus.serverDbStatus,
                    counts: serverStatus.counts
                }));
            } catch (error) {
                 setStatus(prev => ({ 
                    ...prev, 
                    serverDbStatus: 'Offline',
                    counts: { users: 0, stores: 0, deliveryPartners: 0, voiceCommands: 0 }
                }));
            } finally {
                if (statusLoading) setStatusLoading(false);
            }
        };

        fetchStatus();
        const intervalId = setInterval(fetchStatus, 5000);
        return () => clearInterval(intervalId);
    }, [statusLoading]);


    useEffect(() => {
        if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
            router.replace('/dashboard');
        }
    }, [isUserLoading, user, router]);

    if (isUserLoading || adminStoreLoading || !user || user.email !== ADMIN_EMAIL) {
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

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-8">
                 <CoreServicesStatusCard status={status} loading={statusLoading} />
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
                        title="Application Error Log"
                        description="Review errors caught in the application, such as permission denials."
                        href="/dashboard/admin/errors"
                        icon={ShieldAlert}
                    />
                    <AdminActionCard 
                        title="voice-commands-control"
                        description="view-and-manage-the-voice-commands-users-can-say"
                        href="/dashboard/voice-commands"
                        icon={Mic}
                    />
                     <AdminActionCard 
                        title="View Chicken Animation"
                        description="Check out the fun, flashy, waddling chicken animation."
                        href="/chicken"
                        icon={Sparkles}
                    />
                </div>
            </div>
        </div>
    );
}
