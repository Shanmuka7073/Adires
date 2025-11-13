
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Store, Truck, ShoppingBag, AlertCircle, ArrowRight, Settings, Mic, MessageSquareWarning, List, FileText, Server, Sparkles, Box, Code } from 'lucide-react';
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
import { getSystemStatus, getIngredientsForRecipe } from '@/app/actions';
import { useToast } from '@/hooks/use-toast';

const ADMIN_EMAIL = 'admin@gmail.com';

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

function AiTestCard() {
    const { firestore } = useFirebase();
    const [dish, setDish] = useState('');
    const [ingredients, setIngredients] = useState<string[]>([]);
    const [isPending, startTransition] = useTransition();
    const { toast } = useToast();
    
    // Fetch AI config on the client-side
    const configDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'siteConfig', 'aiFeatures') : null, [firestore]);
    const { data: aiConfig } = useDoc<SiteConfig>(configDocRef);

    const handleGetIngredients = () => {
        if (!aiConfig?.isRecipeApiEnabled) {
            toast({ variant: 'destructive', title: 'Feature Disabled', description: 'The Recipe AI feature is currently disabled by the admin.' });
            return;
        }
        if (!dish) {
            toast({ variant: 'destructive', title: 'Please enter a dish name.' });
            return;
        }
        startTransition(async () => {
            try {
                const result = await getIngredientsForRecipe({ dishName: dish });
                setIngredients(result.ingredients);
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: 'AI Error', description: (error as Error).message || 'Could not fetch ingredients.' });
            }
        });
    };

    return (
        <Card className="lg:col-span-3 border-primary/50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-primary" />
                    Test Gemini AI
                </CardTitle>
                <CardDescription>
                    Enter a dish name to verify that the Genkit flow and Gemini API are working correctly. This will fail if the corresponding feature is disabled in AI Feature Controls.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <Input 
                        placeholder="e.g., Chicken Biryani" 
                        value={dish}
                        onChange={(e) => setDish(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleGetIngredients()}
                    />
                    <Button onClick={handleGetIngredients} disabled={isPending}>
                        {isPending ? 'Loading...' : 'Get Ingredients'}
                    </Button>
                </div>
                {ingredients.length > 0 && (
                    <div className="p-4 bg-muted/50 rounded-lg">
                        <h4 className="font-semibold mb-2">Ingredients for {dish}:</h4>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                            {ingredients.map((item, i) => (
                                <li key={i}>{item}</li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

export default function AdminDashboardPage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    
    // Queries for stats
    const storesQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'stores'), where('isClosed', '!=', true)) : null, [firestore]);
    const partnersQuery = useMemoFirebase(() => firestore ? collection(firestore, 'deliveryPartners') : null, [firestore]);
    const deliveredOrdersQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'orders'), where('status', '==', 'Delivered')) : null, [firestore]);
    
    // Query to check for the master store
    const adminStoreQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'stores'), where('name', '==', 'LocalBasket'));
    }, [firestore]);

    const { data: stores, isLoading: storesLoading } = useCollection(storesQuery);
    const { data: partners, isLoading: partnersLoading } = useCollection(partnersQuery);
    const { data: deliveredOrders, isLoading: ordersLoading } = useCollection<Order>(deliveredOrdersQuery);
    const { data: adminStores, isLoading: adminStoreLoading } = useCollection<StoreType>(adminStoreQuery);

    const masterStoreExists = useMemo(() => adminStores && adminStores.length > 0, [adminStores]);

    const stats = useMemo(() => ({
        totalStores: stores?.length ?? 0,
        totalDeliveryPartners: partners?.length ?? 0,
        totalOrdersDelivered: deliveredOrders?.length ?? 0,
    }), [stores, partners, deliveredOrders]);

    const statsLoading = isUserLoading || storesLoading || partnersLoading || ordersLoading;

    useEffect(() => {
        if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
            router.replace('/dashboard');
        }
    }, [isUserLoading, user, router]);

    if (isUserLoading || adminStoreLoading || !user || user.email !== ADMIN_EMAIL) {
        return <p>Loading admin dashboard...</p>
    }

    const statItems = [
        { title: 'total-stores', value: stats.totalStores, icon: Store },
        { title: 'delivery-partners', value: stats.totalDeliveryPartners, icon: Truck },
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

             <div className="mt-12">
                <AiTestCard />
            </div>

            <div className="mt-16">
                 <h2 className="text-2xl font-bold text-center mb-8 font-headline">{t('admin-tools')}</h2>
                <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
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
                        title="Manage Grocery Packs"
                        description="Use AI to generate and manage weekly or monthly grocery packs."
                        href="/dashboard/owner/packs"
                        icon={Box}
                    />
                    <AdminActionCard 
                        title="voice-commands-control"
                        description="view-and-manage-the-voice-commands-users-can-say"
                        href="/dashboard/voice-commands"
                        icon={Mic}
                    />
                    <AdminActionCard 
                        title="Failed Voice Commands"
                        description="Review voice commands that the system failed to understand."
                        href="/dashboard/admin/failed-commands"
                        icon={MessageSquareWarning}
                    />
                     <AdminActionCard 
                        title="Debug GenAI API"
                        description="View the current Gemini API configuration and code for debugging."
                        href="/dashboard/admin/debug-genai"
                        icon={Code}
                    />
                     <AdminActionCard 
                        title="AI Feature Controls"
                        description="Enable or disable specific AI features across the entire site."
                        href="/dashboard/admin/site-config"
                        icon={Settings}
                    />
                </div>
            </div>
        </div>
    );
}
