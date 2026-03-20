'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Store, ShoppingBag, ArrowRight, Server, Search, Check, X, Loader2, Download, Video, Mic, List, Bot, Shield, ImageIcon, Home, Lightbulb, FileCode } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useMemo, useState, useTransition, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Store as StoreType, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useAppStore } from '@/lib/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { importProductsFromUrl, bulkUploadRecipes } from '@/app/actions';

interface StatCardProps {
    title: string;
    value: string | number;
    icon: React.ElementType;
    loading?: boolean;
}

function StatCard({ title, value, icon: Icon, loading }: StatCardProps) {
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

function ProductUrlImporterCard() {
    const { toast } = useToast();
    const [isImporting, startImportTransition] = useTransition();
    const [url, setUrl] = useState('');
    const { fetchInitialData } = useAppStore();
    const { firestore, user } = useFirebase();

    const handleImport = () => {
        if (!url) {
            toast({ variant: 'destructive', title: 'URL is required.' });
            return;
        }

        startImportTransition(async () => {
            try {
                const result = await importProductsFromUrl(url);
                if (result.success) {
                    toast({
                        title: 'Import Complete!',
                        description: `Successfully imported ${result.count} products.`,
                    });
                    setUrl('');
                    if (firestore && user) {
                        await fetchInitialData(firestore, user.uid);
                    }
                } else {
                    throw new Error(result.error || 'An unknown error occurred.');
                }
            } catch (error: any) {
                console.error("URL Import failed:", error);
                toast({ variant: 'destructive', title: 'Import Failed', description: error.message });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Product URL Importer</CardTitle>
                <CardDescription>
                    Import products from a publicly accessible CSV file URL.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Input
                    type="url"
                    placeholder="https://example.com/products.csv"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    disabled={isImporting}
                />
                 {isImporting ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Importing from URL... this may take some time.</span>
                    </div>
                ) : (
                    <Button onClick={handleImport} className="w-full">
                        <Download className="mr-2 h-4 w-4" />
                        Fetch & Import Products
                    </Button>
                )}
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
            
            <StoreOwnersList />

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
                    <ProductUrlImporterCard />
                     <AdminActionCard 
                        title="manage-master-store-and-products"
                        description="add-or-edit-products-in-the-master-catalog"
                        href="/dashboard/owner/my-store"
                        icon={Store}
                    />
                     <AdminActionCard 
                        title="Live Order Video"
                        description="Set the live video URL shown to customers after they order."
                        href="/dashboard/admin/site-config"
                        icon={Video}
                    />
                    <AdminActionCard
                        title="Security Rules"
                        description="View and copy the current Firestore security rules for debugging."
                        href="/dashboard/admin/security-rules"
                        icon={Shield}
                    />
                    <AdminActionCard
                        title="Image Management"
                        description="Manage all placeholder and category images."
                        href="/dashboard/admin/image-management"
                        icon={ImageIcon}
                    />
                </div>
            </div>
        </div>
    );
}
