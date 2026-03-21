'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Edit, Loader2 } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useMemo, useEffect, useState, useTransition, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { collection, query, where, doc, updateDoc, getDocs, limit } from 'firebase/firestore';
import type { Product, ProductPrice, ProductVariant, Store as StoreType } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useAppStore } from '@/lib/store';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Label } from '@/components/ui/label';


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
            <TableRow onClick={() => setIsEditing(!isEditing)} className="cursor-pointer hover:bg-muted/30 transition-colors">
                <TableCell className="font-bold text-gray-900">{product.name}</TableCell>
                <TableCell>
                    {priceData?.variants.map(v => (
                        <div key={v.sku} className="flex items-center gap-2">
                             <span className="font-bold text-[10px] uppercase opacity-40">{v.weight}:</span>
                             <span className="text-xs font-black text-primary">₹{v.price.toFixed(2)}</span>
                             <span className={v.stock <= 10 ? 'text-destructive text-[10px] font-black uppercase' : 'text-muted-foreground text-[10px] font-bold uppercase'}>
                                (Qty: {v.stock})
                             </span>
                        </div>
                    )) || <span className="text-[10px] font-black uppercase opacity-20 italic">No price data</span>}
                </TableCell>
                <TableCell className="text-right">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg" onClick={(e) => { e.stopPropagation(); setIsEditing(prev => !prev);}}>
                        <Edit className="h-4 w-4 opacity-40 group-hover:opacity-100" />
                        <span className="sr-only">Edit {product.name}</span>
                    </Button>
                </TableCell>
            </TableRow>
             {isEditing && (
                 <TableRow className="bg-muted/20">
                    <TableCell colSpan={3} className="p-0">
                        <div className="p-6 space-y-6 animate-in slide-in-from-top-2 duration-300">
                             <div className="flex justify-between items-center">
                                 <p className="font-black uppercase text-[10px] tracking-widest text-primary">Pricing Desk: {product.name}</p>
                                 <Button variant="ghost" size="icon" className="h-6 w-6 rounded-full" onClick={() => setIsEditing(false)}><Edit className="h-3 w-3 rotate-45" /></Button>
                             </div>
                             {variants.map((variant, index) => (
                                <div key={variant.sku} className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end bg-white p-4 rounded-2xl border-2 border-black/5 shadow-sm">
                                    <div className="space-y-1">
                                        <Label className="text-[8px] font-black uppercase tracking-widest opacity-40">Size/Weight</Label>
                                        <div className="font-mono text-xs font-bold text-gray-500 bg-muted/50 h-10 flex items-center px-3 rounded-lg border">{variant.weight}</div>
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[8px] font-black uppercase tracking-widest opacity-40">Retail Price (₹)</Label>
                                        <div className="relative">
                                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs opacity-30">₹</span>
                                            <Input
                                                type="number"
                                                value={variant.price}
                                                onChange={e => handleVariantChange(index, 'price', e.target.value)}
                                                className="h-10 rounded-xl border-2 font-black text-sm"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                         <Label className="text-[8px] font-black uppercase tracking-widest opacity-40">Stock Count</Label>
                                        <Input
                                            type="number"
                                            value={variant.stock}
                                            onChange={e => handleVariantChange(index, 'stock', e.target.value)}
                                            className="h-10 rounded-xl border-2 font-black text-sm"
                                        />
                                    </div>
                                </div>
                            ))}
                            <div className="flex gap-2 justify-end pt-2">
                                <Button variant="ghost" size="sm" className="rounded-xl font-bold" onClick={() => setIsEditing(false)}>Cancel</Button>
                                <Button size="sm" onClick={handleSave} disabled={isSaving} className="rounded-xl h-10 px-6 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Push Updates
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
    
    const [localPrices, setLocalPrices] = useState<Record<string, ProductPrice>>({});
    const [isPricesLoading, setIsPricesLoading] = useState(false);

    // 1. DYNAMIC DATA FETCHING: Removing dependence on AppStore masterProducts
    const chickenProductsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        // Search for the master store first to get its ID
        return query(collection(firestore, 'stores'), where('name', '==', 'LocalBasket'), limit(1));
    }, [firestore]);

    const { data: adminStores } = useCollection<StoreType>(chickenProductsQuery);
    const adminStore = adminStores?.[0];

    const masterChickenProductsQuery = useMemoFirebase(() => {
        if (!firestore || !adminStore) return null;
        // Fetch only chicken products from the master store
        return query(
            collection(firestore, `stores/${adminStore.id}/products`), 
            where('name', '>=', 'Chicken'), 
            where('name', '<=', 'Chicken\uf8ff')
        );
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
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Connecting to Specialized Pricing Desk...</p>
            </div>
        );
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32 animate-in fade-in duration-700">
            <div className="border-b pb-10 border-black/5">
                <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none">Chicken Desk</h1>
                <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Master Price & Inventory Audit</p>
            </div>
            
             <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 border-b border-black/5 pb-8">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                            <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                            <CardTitle className="text-xl font-black uppercase tracking-tight">Active Master Catalog</CardTitle>
                            <CardDescription className="text-xs font-bold opacity-40">Manage global prices for verified chicken items.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isPricesLoading && !chickenProducts ? (
                        <div className="p-12 text-center flex flex-col items-center gap-4 opacity-20">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Scanning Catalog...</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader className="bg-black/5">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Hub Identifier</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Variants (Price & Stock)</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40 pr-6">Action</TableHead>
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
                                {(!chickenProducts || chickenProducts.length === 0) && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="py-20 text-center opacity-20">
                                            <p className="font-black uppercase tracking-widest text-xs">No specialized items found</p>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
