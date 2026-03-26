
'use client';

import { useState, useTransition, useMemo, useEffect, useCallback } from 'react';
import { useFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, doc, limit, getDocs, collectionGroup, setDoc, serverTimestamp } from 'firebase/firestore';
import type { Product, CanonicalProduct } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, Save, Sparkles, ImageIcon, Edit3, RefreshCw, Globe, Utensils, Scissors } from 'lucide-react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { generateProductImage } from '@/ai/flows/generate-product-image-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

const createSlug = (text: string) => {
    if(!text) return '';
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') 
      .replace(/[^\w-]+/g, '') 
      .replace(/--+/g, '-') 
      .replace(/^-+/, '') 
      .replace(/-+$/, ''); 
};

function ProductEditDialog({ 
    product, 
    isOpen, 
    onOpenChange, 
    onSave 
}: { 
    product: CanonicalProduct | null, 
    isOpen: boolean, 
    onOpenChange: (open: boolean) => void, 
    onSave: () => void 
}) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [isSaving, startSave] = useTransition();
    const [isGenerating, startGen] = useTransition();
    const [formData, setFormData] = useState({ name: '', imageUrl: '', category: '' });

    useEffect(() => {
        if (product) {
            setFormData({ 
                name: product.name, 
                imageUrl: product.imageUrl || '',
                category: product.category || ''
            });
        }
    }, [product]);

    const handleGenerateImage = () => {
        if (!formData.name) return;
        startGen(async () => {
            try {
                const res = await generateProductImage({ productName: formData.name });
                if (res.imageUrl) {
                    setFormData(prev => ({ ...prev, imageUrl: res.imageUrl }));
                    toast({ title: "AI Image Ready!" });
                }
            } catch (e) {
                toast({ variant: 'destructive', title: 'Generation Failed' });
            }
        });
    };

    const handleSave = () => {
        if (!firestore || !product) return;
        startSave(async () => {
            const canonicalRef = doc(firestore, 'canonicalCatalog', product.id);
            const updateData = {
                ...product,
                name: formData.name,
                imageUrl: formData.imageUrl,
                category: formData.category,
                updatedAt: serverTimestamp()
            };

            try {
                await setDoc(canonicalRef, updateData, { merge: true });
                toast({ title: "Master Catalog Updated" });
                onSave();
                onOpenChange(false);
            } catch (error: any) {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: canonicalRef.path,
                    operation: 'update',
                    requestResourceData: updateData
                }));
            }
        });
    };

    if (!product) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden max-w-lg p-0">
                <DialogHeader className="p-8 bg-primary/5 pb-4">
                    <DialogTitle className="text-xl font-black uppercase tracking-tight">Edit Master Entry</DialogTitle>
                    <DialogDescription className="font-bold opacity-40 uppercase text-[10px]">Changes reflect globally across all storefronts</DialogDescription>
                </DialogHeader>
                <div className="p-8 space-y-6">
                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-40">Standard Product Name</Label>
                        <Input 
                            value={formData.name} 
                            onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                            className="h-12 rounded-xl border-2 font-bold"
                        />
                    </div>

                    <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase opacity-40">Category Mapping</Label>
                        <Input 
                            value={formData.category} 
                            onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                            placeholder="e.g. Main Course, Fresh Vegetables"
                            className="h-12 rounded-xl border-2 font-bold"
                        />
                    </div>
                    
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase opacity-40">Master Visual Override</Label>
                        <div className="relative aspect-video rounded-2xl overflow-hidden border-2 bg-muted flex items-center justify-center">
                            {formData.imageUrl ? (
                                <Image src={formData.imageUrl} alt="Preview" fill className="object-cover" />
                            ) : (
                                <ImageIcon className="h-10 w-10 opacity-10" />
                            )}
                            {isGenerating && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm">
                                    <Loader2 className="h-8 w-8 animate-spin text-white" />
                                </div>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Input 
                                placeholder="Direct URL..." 
                                value={formData.imageUrl}
                                onChange={e => setFormData(prev => ({ ...prev, imageUrl: e.target.value }))}
                                className="h-10 rounded-xl border-2 text-xs"
                            />
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={handleGenerateImage} 
                                disabled={isGenerating || !formData.name}
                                className="rounded-xl h-10 w-10 shrink-0"
                            >
                                <Sparkles className="h-4 w-4 text-primary" />
                            </Button>
                        </div>
                    </div>
                </div>
                <DialogFooter className="p-8 bg-gray-50 border-t flex gap-2">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold">Cancel</Button>
                    <Button onClick={handleSave} disabled={isSaving} className="rounded-xl h-12 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                        {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />}
                        Commit Master Update
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function CatalogManagerPage() {
    const { firestore } = useFirebase();
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [editingProduct, setEditingProduct] = useState<CanonicalProduct | null>(null);
    const [isRefreshing, startRefresh] = useTransition();
    const [catalog, setCatalog] = useState<CanonicalProduct[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    const syncCatalog = useCallback(async () => {
        if (!firestore) return;
        setIsLoading(true);
        try {
            // A. Get master registry
            const canonicalSnap = await getDocs(collection(firestore, 'canonicalCatalog'));
            const canonicalMap = new Map(canonicalSnap.docs.map(doc => [doc.id, { ...doc.data(), id: doc.id } as CanonicalProduct]));

            // B. Get all existing store products via collectionGroup
            const productsQuery = query(collectionGroup(firestore, 'products'), limit(500));
            const productsSnap = await getDocs(productsQuery);
            
            productsSnap.forEach(docSnap => {
                const data = docSnap.data() as Product;
                const slug = createSlug(data.name);
                if (!canonicalMap.has(slug)) {
                    canonicalMap.set(slug, {
                        id: slug,
                        name: data.name,
                        category: data.category,
                        discoveredInStoreId: data.storeId,
                        discoveredAt: new Date().toISOString()
                    });
                }
            });

            setCatalog(Array.from(canonicalMap.values()).sort((a, b) => a.name.localeCompare(b.name)));
        } catch (error: any) {
            console.error("Catalog audit sync failed:", error);
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'products_collection_group',
                operation: 'list'
            }));
        } finally {
            setIsLoading(false);
        }
    }, [firestore]);

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) router.replace('/dashboard');
        if (isAdmin) syncCatalog();
    }, [isAdmin, isAdminLoading, router, syncCatalog]);

    const filteredCatalog = useMemo(() => {
        return catalog.filter(p => 
            p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            p.category?.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [catalog, searchTerm]);

    if (isAdminLoading || isLoading) return <div className="p-12 text-center flex flex-col items-center justify-center h-[60vh] gap-4"><Loader2 className="animate-spin h-10 w-10 text-primary opacity-20" /><p className="text-[10px] font-black uppercase tracking-widest opacity-40">Building Market Intelligence...</p></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32 animate-in fade-in duration-700">
            <ProductEditDialog 
                product={editingProduct} 
                isOpen={!!editingProduct} 
                onOpenChange={o => !o && setEditingProduct(null)}
                onSave={syncCatalog}
            />

            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">Market Catalog</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Cross-Store Discovery & Branding</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                        <Input 
                            placeholder="Search everything..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="pl-9 h-11 rounded-xl border-2 font-bold bg-white"
                        />
                    </div>
                    <Button variant="outline" size="sm" onClick={() => startRefresh(syncCatalog)} disabled={isRefreshing} className="rounded-full h-11 px-6 border-2 font-black text-[10px] uppercase tracking-widest shadow-sm">
                        <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isRefreshing && "animate-spin")} /> Force Audit Sync
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-lg p-6 bg-slate-900 text-white flex items-center gap-4">
                    <Globe className="h-10 w-10 text-primary opacity-40" />
                    <div>
                        <p className="text-3xl font-black italic leading-none">{catalog.length}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest text-primary mt-1">Unique Items Discovered</p>
                    </div>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-lg p-6 bg-white border-2 border-primary/10 flex items-center gap-4">
                    <Utensils className="h-10 w-10 text-orange-500 opacity-40" />
                    <div>
                        <p className="text-3xl font-black italic leading-none">{catalog.filter(p => p.businessType === 'restaurant').length}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">Restaurant Dishes</p>
                    </div>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-lg p-6 bg-white border-2 border-primary/10 flex items-center gap-4">
                    <Scissors className="h-10 w-10 text-blue-600 opacity-40" />
                    <div>
                        <p className="text-3xl font-black italic leading-none">{catalog.filter(p => p.businessType === 'salon').length}</p>
                        <p className="text-[8px] font-black uppercase tracking-widest opacity-40 mt-1">Salon Services</p>
                    </div>
                </Card>
            </div>

            <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                <Table>
                    <TableHeader className="bg-black/5">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Discovery Hub</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Category</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Status</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40 pr-8">Modify</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredCatalog.length > 0 ? (
                            filteredCatalog.map(p => (
                                <TableRow key={p.id} className="hover:bg-muted/30 transition-colors border-b border-black/5">
                                    <TableCell className="py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="relative h-14 w-14 rounded-2xl overflow-hidden border-2 bg-muted shrink-0 shadow-sm">
                                                <Image src={p.imageUrl || ADIRES_LOGO} alt={p.name} fill className="object-cover" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-black text-sm uppercase tracking-tight text-gray-950 truncate leading-tight">{p.name}</p>
                                                <p className="text-[8px] font-black text-primary opacity-40 uppercase tracking-widest mt-1">Slug: {p.id}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="px-3 py-1 rounded-lg bg-black/5 border border-black/5 w-fit">
                                            <p className="text-[10px] font-black uppercase tracking-tighter opacity-60">{p.category || 'Uncategorized'}</p>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        {p.discoveredInStoreId ? (
                                            <Badge variant="secondary" className="text-[7px] font-black uppercase tracking-widest">Discovered</Badge>
                                        ) : (
                                            <Badge variant="default" className="text-[7px] font-black uppercase tracking-widest">Master</Badge>
                                        )}
                                    </TableCell>
                                    <TableCell className="text-right pr-8">
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-10 w-10 rounded-xl hover:bg-primary/10 hover:text-primary transition-all group"
                                            onClick={() => setEditingProduct(p)}
                                        >
                                            <Edit3 className="h-5 w-5" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={4} className="p-32 text-center opacity-20">
                                    <Utensils className="h-12 w-12 mx-auto mb-4" />
                                    <p className="font-black uppercase tracking-widest text-xs">Zero products matched</p>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </Card>
        </div>
    );
}
