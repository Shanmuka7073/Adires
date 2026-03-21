
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Edit, Loader2 } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { collection, query, where, doc, updateDoc, getDocs } from 'firebase/firestore';
import type { Product, ProductPrice, ProductVariant } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useAppStore } from '@/lib/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';


function ProductInventoryRow({ product, priceData, onUpdate }: { product: Product, priceData: ProductPrice | null, onUpdate: () => void }) {
    const [isEditing, setIsEditing] = useState(false);
    const [variants, setVariants] = useState<ProductVariant[]>(priceData?.variants || []);
    const [isSaving, startSaveTransition] = useTransition();
    const { firestore } = useFirebase();
    const { toast } = useToast();

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
            <TableRow onClick={() => setIsEditing(!isEditing)} className="cursor-pointer">
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell>
                    {priceData?.variants.map(v => (
                        <div key={v.sku} className="flex items-center gap-2">
                             <span className="font-semibold text-xs">{v.weight}:</span>
                             <span className="text-xs font-black text-primary">₹{v.price.toFixed(2)}</span>
                             <span className={v.stock <= 10 ? 'text-destructive text-[10px] font-bold' : 'text-muted-foreground text-[10px]'}>
                                (Stock: {v.stock})
                             </span>
                        </div>
                    )) || 'No price data'}
                </TableCell>
                <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setIsEditing(prev => !prev);}}>
                        <Edit className="h-4 w-4" />
                        <span className="sr-only">Edit prices for {product.name}</span>
                    </Button>
                </TableCell>
            </TableRow>
             {isEditing && (
                 <TableRow>
                    <TableCell colSpan={3} className="p-0">
                        <div className="p-4 bg-muted/50 space-y-4">
                             <p className="font-semibold text-sm">Editing Prices: {product.name}</p>
                             {variants.map((variant, index) => (
                                <div key={variant.sku} className="grid grid-cols-3 gap-4 items-center">
                                    <div className="font-mono text-[10px] uppercase font-bold">{variant.weight}</div>
                                    <div className="flex items-center gap-1">
                                        <span className="text-xs">₹</span>
                                        <Input
                                            type="number"
                                            value={variant.price}
                                            onChange={e => handleVariantChange(index, 'price', e.target.value)}
                                            className="h-8 rounded-lg"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1">
                                         <span className="text-xs">Stock:</span>
                                        <Input
                                            type="number"
                                            value={variant.stock}
                                            onChange={e => handleVariantChange(index, 'stock', e.target.value)}
                                            className="h-8 rounded-lg"
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

export default function ChickenAdminDashboardPage() {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { isChickenAdmin, isLoading: isAuthLoading } = useAdminAuth();
    const { stores, fetchInitialData } = useAppStore();
    
    const [localPrices, setLocalPrices] = useState<Record<string, ProductPrice>>({});
    const [isPricesLoading, setIsPricesLoading] = useState(false);

    // Fetch master store chicken products
    const chickenProductsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // First find the master store
        return query(collection(firestore, 'stores'), where('name', '==', 'LocalBasket'), limit(1));
    }, [firestore]);

    const { data: adminStores } = useCollection<StoreType>(chickenProductsQuery);
    const adminStore = adminStores?.[0];

    const masterChickenProductsQuery = useMemoFirebase(() => {
        if (!firestore || !adminStore) return null;
        return query(collection(firestore, `stores/${adminStore.id}/products`), where('name', '>=', 'Chicken'), where('name', '<=', 'Chicken\uf8ff'));
    }, [firestore, adminStore]);

    const { data: chickenProducts, isLoading: productsLoading } = useCollection<Product>(masterChickenProductsQuery);

    const fetchAllPrices = useCallback(async () => {
         if (firestore && chickenProducts && chickenProducts.length > 0) {
            setIsPricesLoading(true);
            try {
                const batchNames = chickenProducts.map(p => p.name.toLowerCase());
                const priceQuery = query(collection(firestore, 'productPrices'), where('productName', 'in', batchNames));
                const snap = await getDocs(priceQuery);
                const priceMap: Record<string, ProductPrice> = {};
                snap.docs.forEach(d => {
                    const data = d.data() as ProductPrice;
                    priceMap[data.productName] = data;
                });
                setLocalPrices(priceMap);
            } catch (e) {
                console.error("Price fetch failed", e);
            } finally {
                setIsPricesLoading(false);
            }
        }
    }, [firestore, chickenProducts]);

    useEffect(() => {
        if (chickenProducts) fetchAllPrices();
    }, [chickenProducts, fetchAllPrices]);

    useEffect(() => {
        if (!isAuthLoading && !isChickenAdmin) {
            router.replace('/dashboard');
        }
    }, [isAuthLoading, isChickenAdmin, router]);

    if (isAuthLoading || productsLoading) {
        return (
            <div className="container mx-auto py-12 px-4 md:px-6 flex flex-col items-center justify-center h-[60vh] gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Verifying Inventory Permissions...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-8 pb-32">
            <div className="border-b pb-10 border-black/5">
                <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic leading-none">Chicken Desk</h1>
                <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Specialized Price Management</p>
            </div>
            
             <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-black/5">
                    <CardTitle className="text-xl font-black uppercase tracking-tight">Active Inventory</CardTitle>
                    <CardDescription className="text-xs font-bold opacity-40">Update prices and stock levels for all verified chicken products.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    {isPricesLoading && !chickenProducts ? (
                        <div className="p-12 space-y-4">
                            <Skeleton className="h-12 w-full rounded-xl" />
                            <Skeleton className="h-12 w-full rounded-xl" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-black/5">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Product</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Variants (Price & Stock)</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {chickenProducts?.map(product => (
                                    <ProductInventoryRow 
                                        key={product.id}
                                        product={product} 
                                        priceData={localPrices[product.name.toLowerCase()]}
                                        onUpdate={fetchAllPrices}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
