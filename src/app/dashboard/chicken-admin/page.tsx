'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Users, Store, ShoppingBag, ArrowRight, Mic, List, FileText, Server, BookOpen, Beaker, Bot, FileSignature, Shield, BrainCircuit, Fingerprint, Voicemail, KeyRound, Bug, AlertTriangle, Download, Search, Check, X, Loader2, BookCopy, Upload, MessageSquare, ImageIcon, Home, Lightbulb, Binary, TestTube, Cog, Share2, Monitor, Drama, Edit } from 'lucide-react';
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


function ProductInventoryRow({ product, priceData, onUpdate }: { product: Product, priceData: ProductPrice | null, onUpdate: () => void }) {
    const [isEditing, setIsEditing] = useState(false);
    const [variants, setVariants] = useState(priceData?.variants || []);
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
                             <span className="font-semibold">{v.weight}:</span>
                             <span>₹{v.price.toFixed(2)}</span>
                             <span className={v.stock <= 10 ? 'text-destructive' : 'text-muted-foreground'}>
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

export default function ChickenAdminDashboardPage() {
    const { firestore } = useFirebase();
    const router = useRouter();
    const { isChickenAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const { masterProducts, productPrices, fetchProductPrices, loading } = useAppStore();

    const fetchAllPrices = () => {
         if (firestore && masterProducts.length > 0) {
            const productNamesToFetch = masterProducts
                .filter(p => p.name.toLowerCase().includes('chicken'))
                .map(p => p.name);
            fetchProductPrices(firestore, productNamesToFetch);
        }
    }

    useEffect(() => {
        fetchAllPrices();
    }, [firestore, masterProducts]);

    useEffect(() => {
        if (!isAdminLoading && !isChickenAdmin) {
            router.replace('/dashboard');
        }
    }, [isAdminLoading, isChickenAdmin, router]);

    const chickenProducts = useMemo(() => {
        return masterProducts.filter(p => p.name.toLowerCase().includes('chicken'));
    }, [masterProducts]);

    if (isAdminLoading || loading) {
        return <div className="container mx-auto py-12">Loading Chicken Dashboard...</div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">Chicken Price Management</h1>
                <p className="text-lg text-muted-foreground mt-2">Update prices and stock for all chicken products.</p>
            </div>
            
             <Card>
                <CardHeader>
                    <CardTitle>Chicken Products</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Product</TableHead>
                                    <TableHead>Variants (Price & Stock)</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {chickenProducts.map(product => (
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
        </div>
    );
}
