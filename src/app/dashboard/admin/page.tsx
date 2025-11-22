
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Store, ShoppingBag, ArrowRight, Mic, List, FileText, Server, BookOpen, Beaker, Bot, FileSignature, Shield, BrainCircuit, Fingerprint, Voicemail, KeyRound, Bug, AlertTriangle, Download } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { collection, query, where } from 'firebase/firestore';
import type { Order, Store as StoreType, Product, ProductPrice, ProductVariant } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useAppStore } from '@/lib/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

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

function ProductInventory() {
    const { masterProducts, productPrices, fetchProductPrices, loading } = useAppStore();
    const { firestore } = useFirebase();

    useEffect(() => {
        if (firestore && masterProducts.length > 0) {
            const productNamesToFetch = masterProducts.map(p => p.name);
            fetchProductPrices(firestore, productNamesToFetch);
        }
    }, [firestore, masterProducts, fetchProductPrices]);
    
    const handleDownloadCSV = () => {
        const headers = ["Product Name", "Category", "Variant Weight", "Price", "Stock", "Status"];
        const rows: string[][] = [];

        masterProducts.forEach(product => {
            const priceData = productPrices[product.name.toLowerCase()];
            if (priceData?.variants) {
                priceData.variants.forEach(variant => {
                    const status = variant.stock <= 10 ? "LOW STOCK" : "OK";
                    rows.push([
                        `"${product.name}"`,
                        `"${product.category || 'N/A'}"`,
                        variant.weight,
                        String(variant.price),
                        String(variant.stock),
                        status
                    ]);
                });
            }
        });

        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n" 
            + rows.map(e => e.join(",")).join("\n");
        
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "inventory_report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Master Product Inventory</CardTitle>
                        <CardDescription>A complete overview of stock levels for all products.</CardDescription>
                    </div>
                    <Button onClick={handleDownloadCSV} variant="outline" size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Download Inventory
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Product</TableHead>
                                <TableHead>Variant</TableHead>
                                <TableHead>Price</TableHead>
                                <TableHead className="text-right">Stock</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {masterProducts.map(product => {
                                const priceData = productPrices[product.name.toLowerCase()];
                                if (!priceData || !priceData.variants || priceData.variants.length === 0) {
                                    return (
                                        <TableRow key={product.id}>
                                            <TableCell className="font-medium">{product.name}</TableCell>
                                            <TableCell colSpan={3} className="text-muted-foreground">No pricing or stock information.</TableCell>
                                        </TableRow>
                                    );
                                }
                                return priceData.variants.map((variant, index) => (
                                    <TableRow key={`${product.id}-${variant.sku}`}>
                                        <TableCell className="font-medium">{index === 0 ? product.name : ''}</TableCell>
                                        <TableCell>{variant.weight}</TableCell>
                                        <TableCell>₹{variant.price.toFixed(2)}</TableCell>
                                        <TableCell className={`text-right font-bold ${variant.stock <= 10 ? 'text-destructive' : ''}`}>
                                            {variant.stock}
                                        </TableCell>
                                    </TableRow>
                                ));
                            })}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
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
            
            <div className="mb-8">
                <ProductInventory />
            </div>

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
                    <AdminActionCard
                        title="Fingerprint Login Code"
                        description="View the source code for the WebAuthn fingerprint login feature."
                        href="/dashboard/admin/fingerprint-help"
                        icon={Fingerprint}
                    />
                     <AdminActionCard
                        title="Voice ID Code"
                        description="View the source code for the voiceprint verification feature."
                        href="/dashboard/admin/voice-id-help"
                        icon={Voicemail}
                    />
                    <AdminActionCard
                        title="WebAuthn API Code"
                        description="View the source code for the WebAuthn (fingerprint) API route."
                        href="/dashboard/admin/webauthn-api-help"
                        icon={Fingerprint}
                    />
                     <AdminActionCard
                        title="Server Actions Code"
                        description="View the source code for the main server actions file."
                        href="/dashboard/admin/actions-help"
                        icon={Server}
                    />
                     <AdminActionCard
                        title="Admin Init Code"
                        description="View the source code for the Firebase Admin SDK initialization."
                        href="/dashboard/admin/admin-init-help"
                        icon={KeyRound}
                    />
                     <AdminActionCard
                        title="Voice Commander Code"
                        description="View the source code for the main voice command processing logic."
                        href="/dashboard/admin/voice-commander-help"
                        icon={Mic}
                    />
                     <AdminActionCard
                        title="Checkout Loop Debug"
                        description="Isolate the specific code related to the checkout page command loop."
                        href="/dashboard/admin/checkout-loop-help"
                        icon={Bug}
                    />
                </div>
            </div>
        </div>
    );
}
