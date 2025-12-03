'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Store, ShoppingBag, ArrowRight, Mic, List, FileText, Server, BookOpen, Beaker, Bot, FileSignature, Shield, BrainCircuit, Fingerprint, Voicemail, KeyRound, Bug, AlertTriangle, Download, Search, Check, X, Loader2, BookCopy, Upload, MessageSquare, ImageIcon, Home, Lightbulb, Binary, TestTube, Cog, Share2, Monitor, Drama, Edit, BarChart3, FileCode } from 'lucide-react';
import Link from 'next/link';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect, useState, useTransition, useRef } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { collection, query, where, doc, updateDoc, writeBatch } from 'firebase/firestore';
import type { Order, Store as StoreType, Product, ProductPrice, ProductVariant, User } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/locales';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useAppStore } from '@/lib/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { bulkUploadRecipes, importProductsFromUrl } from '@/app/actions';


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

function ProductUrlImporterCard() {
    const { toast } = useToast();
    const [isImporting, startImportTransition] = useTransition();
    const [url, setUrl] = useState('');
    const { fetchInitialData } = useAppStore();
    const { firestore } = useFirebase();

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
                    if (firestore) {
                        await fetchInitialData(firestore);
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
                    Import products from a publicly accessible CSV file URL. The format should be: `name,category,description,imageUrl,weight,price`.
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

function BulkRecipeUploadCard() {
    const { toast } = useToast();
    const [isUploading, startUploadTransition] = useTransition();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        startUploadTransition(async () => {
            try {
                const text = await file.text();
                const result = await bulkUploadRecipes(text);

                if (result.success) {
                    toast({
                        title: 'Upload Complete!',
                        description: `Successfully processed and added ${result.count} recipes.`,
                    });
                } else {
                    throw new Error(result.error || 'An unknown error occurred during upload.');
                }

            } catch (error: any) {
                console.error("CSV Upload failed:", error);
                toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
            } finally {
                if(fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Bulk Recipe Upload</CardTitle>
                <CardDescription>
                    Upload a CSV file of recipes to pre-populate the AI cache. The format should be: `dish_name,ingredients` (with ingredients separated by "|").
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    disabled={isUploading}
                    className="mb-4"
                />
                 {isUploading ? (
                    <div className="flex items-center gap-2 mt-4 text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Processing your file... this may take some time.</span>
                    </div>
                ) : (
                    <Button onClick={() => fileInputRef.current?.click()} className="w-full">
                        <Upload className="mr-2 h-4 w-4" />
                        Choose CSV and Upload
                    </Button>
                )}
            </CardContent>
        </Card>
    );
}

function ProductInventory() {
    const { masterProducts, productPrices, fetchProductPrices, loading } = useAppStore();
    const { firestore } = useFirebase();
    const [searchTerm, setSearchTerm] = useState('');

    const fetchAllPrices = () => {
         if (firestore && masterProducts.length > 0) {
            const productNamesToFetch = masterProducts.map(p => p.name);
            fetchProductPrices(firestore, productNamesToFetch);
        }
    }

    useEffect(() => {
        fetchAllPrices();
    }, [firestore, masterProducts]);
    
    const handleDownloadCSV = () => {
        const headers = ["Product Name", "Category", "Variant Weight", "Price", "Stock", "Status"];
        const rows: string[][] = [];

        filteredProducts.forEach(product => {
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

    const filteredProducts = useMemo(() => {
        if (!searchTerm) return masterProducts;
        return masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [masterProducts, searchTerm]);

    return (
        <Accordion type="single" collapsible className="w-full mb-8">
            <AccordionItem value="inventory">
                <AccordionTrigger>
                     <div className="flex justify-between items-center w-full pr-4">
                        <div>
                            <h2 className="text-xl font-bold font-headline">Master Product Inventory</h2>
                            <p className="text-sm text-muted-foreground text-left">A complete overview of stock levels for all products.</p>
                        </div>
                    </div>
                </AccordionTrigger>
                <AccordionContent>
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                                <div className="flex items-center gap-2 w-full">
                                    <div className="relative flex-grow">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input 
                                            placeholder="Search products..." 
                                            className="pl-9"
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>
                                    <Button onClick={handleDownloadCSV} variant="outline" size="sm">
                                        <Download className="mr-2 h-4 w-4" />
                                        Download
                                    </Button>
                                </div>
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
                                            <TableHead>Category</TableHead>
                                            <TableHead>Variants (Price & Stock)</TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredProducts.map(product => (
                                            <ProductInventoryRow 
                                                key={product.id}
                                                product={product} 
                                                priceData={productPrices[product.name.toLowerCase()]}
                                                onUpdate={fetchAllPrices}
                                            />
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}

function ProductInventoryRow({ product, priceData, onUpdate }: { product: Product, priceData: ProductPrice | null, onUpdate: () => void }) {
    const [isEditing, setIsEditing] = useState(false);
    const [variants, setVariants] = useState(priceData?.variants || []);
    const [isSaving, startSaveTransition] = useTransition();
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const { isAdmin, isChickenAdmin } = useAdminAuth();

    const canEdit = isAdmin || (isChickenAdmin && product.name.toLowerCase().includes('chicken'));


    useEffect(() => {
        setVariants(priceData?.variants || []);
    }, [priceData]);

    const handleVariantChange = (index: number, field: 'price' | 'stock', value: string) => {
        const newVariants = [...variants];
        const numValue = field === 'price' ? parseFloat(value) : parseInt(value, 10);
        if (!isNaN(numValue)) {
            newVariants[index] = { ...newVariants[index], [field]: numValue };
            setVariants(newVariants);
        }
    };
    
    const handleSave = () => {
        if (!firestore) return;
        
        startSaveTransition(async () => {
            const priceDocRef = doc(firestore, 'productPrices', product.name.toLowerCase());
            try {
                await updateDoc(priceDocRef, { variants });
                toast({ title: 'Success', description: `${product.name} has been updated.` });
                setIsEditing(false);
                onUpdate();
            } catch (error) {
                console.error("Failed to update product price:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not save changes.' });
            }
        });
    };

    return (
        <>
            <TableRow onClick={() => canEdit && setIsEditing(!isEditing)} className={canEdit ? "cursor-pointer" : ""}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>{product.category}</TableCell>
                <TableCell>
                    {priceData?.variants.map(v => (
                        <div key={v.sku} className="flex items-center gap-2">
                             <span className="font-semibold">{v.weight}:</span>
                             <span>₹{v.price.toFixed(2)}</span>
                             <span className={v.stock <= 10 ? 'text-destructive' : 'text-muted-foreground'}>
                                (Stock: {v.stock})
                             </span>
                        </div>
                    )) || 'No price data'}
                </TableCell>
                 <TableCell className="text-right">
                    {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => setIsEditing(prev => !prev)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit prices for {product.name}</span>
                        </Button>
                    )}
                </TableCell>
            </TableRow>
             {isEditing && canEdit && (
                 <TableRow>
                    <TableCell colSpan={4} className="p-0">
                        <div className="p-4 bg-muted/50 space-y-4">
                             <p className="font-semibold text-sm">Editing Prices: {product.name}</p>
                             {variants.map((variant, index) => (
                                <div key={variant.sku} className="grid grid-cols-3 gap-4 items-center">
                                    <div className="font-mono text-sm">{variant.weight}</div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-sm">₹</span>
                                        <Input
                                            type="number"
                                            value={variant.price}
                                            onChange={e => handleVariantChange(index, 'price', e.target.value)}
                                            className="h-8"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1">
                                         <span className="text-sm">Stock:</span>
                                        <Input
                                            type="number"
                                            value={variant.stock}
                                            onChange={e => handleVariantChange(index, 'stock', e.target.value)}
                                            className="h-8"
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="flex gap-2 justify-end">
                                <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleSave} disabled={isSaving}>
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Save
                                </Button>
                            </div>
                        </div>
                    </TableCell>
                 </TableRow>
            )}
        </>
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
    const { isAdmin, isChickenAdmin, isLoading: isAdminLoading } = useAdminAuth();

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
        if (!isAdminLoading && !isAdmin && !isChickenAdmin) {
            router.replace('/dashboard');
        }
         // Redirect chicken admin to their specific page
        if (!isAdminLoading && isChickenAdmin) {
            router.replace('/dashboard/chicken-admin');
        }
    }, [isAdminLoading, isAdmin, isChickenAdmin, router]);

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
            
            <ProductInventory />
            
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
                    <BulkRecipeUploadCard />
                     <AdminActionCard 
                        title="manage-master-store-and-products"
                        description="add-or-edit-products-in-the-master-catalog"
                        href="/dashboard/owner/my-store"
                        icon={Store}
                    />
                    <AdminActionCard 
                        title="voice-commands-control"
                        description="view-and-manage-the-voice-commands-users-can-say"
                        href="/dashboard/voice-commands"
                        icon={Mic}
                    />
                     <AdminActionCard 
                        title="Sales Reports"
                        description="View daily and monthly sales reports categorized by product type."
                        href="/dashboard/admin/sales-report"
                        icon={BarChart3}
                    />
                     <AdminActionCard 
                        title="Sales Report Code"
                        description="View the source code for the sales report feature."
                        href="/dashboard/admin/sales-report-help"
                        icon={FileCode}
                    />
                    <AdminActionCard
                        title="Failed Command Center"
                        description="Review failed voice commands and use AI to train the system."
                        href="/dashboard/admin/failed-commands"
                        icon={Bot}
                    />
                    <AdminActionCard
                        title="AI Training Ground"
                        description="Paste any text to teach the AI new product aliases and concepts."
                        href="/dashboard/admin/training-ground"
                        icon={Lightbulb}
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
