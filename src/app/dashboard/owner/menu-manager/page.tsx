
'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, limit, updateDoc, deleteDoc, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { Store, Menu, MenuItem, MenuTheme, CustomizationGroup, CustomizationOption } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Sparkles, Loader2, Save, QrCode, Printer, Copy, AlertTriangle, List, PlusCircle, Edit, ImageIcon, Check, Upload as UploadIcon, Link2, SwitchCamera, CheckCircle2, Plus, X, ExternalLink, Camera } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import Link from 'next/link';
import { QRCodeCanvas } from 'qrcode.react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { extractMenuItems } from '@/ai/flows/extract-menu-items-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateProductImage } from '@/ai/flows/generate-product-image-flow';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { cn, createSlug } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/hooks/use-admin-auth';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

const menuItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Item name is required."),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  category: z.string().min(2, "Category is required."),
  imageUrl: z.string().url("Please enter a valid URL").optional().or(z.literal('')),
  dietary: z.enum(['veg', 'non-veg']).optional().or(z.literal('')),
  isAvailable: z.boolean().default(true),
  customizations: z.array(z.object({
      title: z.string().min(1, "Group title is required"),
      required: z.boolean().optional(),
      multiSelect: z.boolean().optional(),
      options: z.array(z.object({
          name: z.string().min(1, "Option name is required"),
          price: z.coerce.number().min(0)
      }))
  })).optional()
});
type MenuItemFormValues = z.infer<typeof menuItemSchema>;

function MenuDisplay({ store, menu: initialMenu, onUpdate }: { store: Store, menu: Menu, onUpdate: () => void }) {
    const { toast } = useToast(); 
    const { firestore } = useFirebase(); 
    const { incrementWriteCount } = useAppStore();
    const [menu, setMenu] = useState(initialMenu);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); 
    const [isAIScanOpen, setIsAIScanOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [newZoneName, setNewZoneName] = useState('');
    const [isAddingZone, startAddingZone] = useTransition();

    useEffect(() => { setMenu(initialMenu); }, [initialMenu]);

    const persistMenu = (uM: Menu) => {
        if (!firestore) return;
        const batch = writeBatch(firestore);
        batch.set(doc(firestore, `stores/${store.id}/menus`, uM.id), uM, { merge: true }); 
        batch.commit().catch(e => console.error("Menu persist failed:", e));
        incrementWriteCount(1);
    };

    const handleSaveItem = async (itemData: MenuItem, isNew: boolean) => {
        let uI;
        if (isNew) { uI = [...menu.items, { ...itemData, id: createSlug(itemData.name), isAvailable: true }]; } 
        else { uI = menu.items.map(i => i.id === editingItem?.id ? { ...i, ...itemData } : i); }
        const uM = { ...menu, items: uI }; 
        setMenu(uM);
        persistMenu(uM);
        toast({ title: "Item Saved!" });
    };

    const handleDeleteItem = async (it: MenuItem) => {
         const uI = menu.items.filter(i => i.id !== it.id);
         const uM = { ...menu, items: uI }; 
         setMenu(uM);
         persistMenu(uM);
         toast({ title: "Item Removed" });
    }

    const toggleAvailability = async (it: MenuItem) => {
        const currentStatus = it.isAvailable !== false;
        const uI = menu.items.map(i => i.id === it.id ? { ...i, isAvailable: !currentStatus } : i);
        const uM = { ...menu, items: uI }; 
        setMenu(uM);
        persistMenu(uM);
        toast({ title: "Availability Updated" });
    };

    const handleAddZone = () => {
        if (!newZoneName.trim() || !firestore) return;
        startAddingZone(async () => {
            const currentTables = store.tables || [];
            const updatedTables = [...new Set([...currentTables, newZoneName.trim()])];
            updateDoc(doc(firestore, 'stores', store.id), { tables: updatedTables })
                .catch(e => toast({ variant: 'destructive', title: "Update Failed" }));
            setNewZoneName('');
            incrementWriteCount(1);
        });
    }

    const handleRemoveZone = (zone: string) => {
        if (!firestore) return;
        const updatedTables = (store.tables || []).filter(t => t !== zone);
        updateDoc(doc(firestore, 'stores', store.id), { tables: updatedTables });
        incrementWriteCount(1);
    }
    
    return (
        <div className="grid lg:grid-cols-3 gap-8">
            <EditMenuItemDialog isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSave={handleSaveItem} existingItem={editingItem} onDeleteItem={handleDeleteItem} />
            <Dialog open={isAIScanOpen} onOpenChange={setIsAIScanOpen}>
                <DialogContent className="max-w-3xl rounded-[2.5rem] p-0 border-0 overflow-hidden">
                    <MenuOnboardingTool storeId={store.id} onComplete={() => { setIsAIScanOpen(false); onUpdate(); }} businessType={store.businessType} />
                </DialogContent>
            </Dialog>

            <Card className="lg:col-span-2 rounded-3xl border-0 shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 border-b border-black/5 pb-6">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle className="text-xl font-black uppercase tracking-tight">Digital Menu</CardTitle>
                            <CardDescription className="text-[10px] font-bold opacity-40 uppercase">Independent Store Catalog</CardDescription>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button size="sm" variant="outline" className="flex-1 sm:flex-none rounded-xl font-black text-[9px] uppercase border-2 h-10 px-4 bg-white" onClick={() => setIsAIScanOpen(true)}>
                                <Sparkles className="h-4 w-4 mr-2 text-primary" /> AI Scan
                            </Button>
                            <Button size="sm" className="flex-1 sm:flex-none rounded-xl font-black text-[9px] uppercase h-10 px-4" onClick={() => { setEditingItem(null); setIsEditDialogOpen(true); }}>
                                <PlusCircle className="h-4 w-4 mr-2" /> Add Item
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                     <Table>
                        <TableHeader className="bg-black/5">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Item</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Stock</TableHead>
                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40 pr-6">Edit</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {menu.items.map((it) => (
                                <TableRow key={it.id} className={cn("hover:bg-muted/30 transition-colors", it.isAvailable === false && "opacity-50")}>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-12 w-12 rounded-2xl overflow-hidden border-2 bg-muted shrink-0 shadow-sm">
                                                <Image src={it.imageUrl || ADIRES_LOGO} alt={it.name} fill className="object-cover" />
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-black text-sm uppercase tracking-tight text-gray-950 truncate leading-tight">{it.name}</p>
                                                <p className="text-[10px] font-black text-primary opacity-60">₹{it.price.toFixed(0)}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-2">
                                            <Switch checked={it.isAvailable !== false} onCheckedChange={() => toggleAvailability(it)} />
                                            <span className="text-[8px] font-black uppercase opacity-40">{it.isAvailable !== false ? 'In' : 'Out'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl hover:bg-black/5" onClick={() => { setEditingItem(it); setIsEditDialogOpen(true); }}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>

             <Card className="rounded-3xl border-0 shadow-xl overflow-hidden h-fit bg-white">
                <CardHeader className="bg-primary/5 border-b border-black/5 pb-6">
                    <CardTitle className="text-xl font-black uppercase tracking-tight text-gray-950">Floor Map QR Hub</CardTitle>
                    <CardDescription className="text-xs font-bold opacity-40 uppercase tracking-widest">Table & Seat assignments</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                    <div className="flex gap-2">
                        <Input placeholder="Table (e.g. T-1)" value={newZoneName} onChange={e => setNewZoneName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleAddZone()} className="h-12 rounded-xl border-2 font-black uppercase text-xs" />
                        <Button onClick={handleAddZone} disabled={!newZoneName.trim() || isAddingZone} className="h-12 w-12 rounded-xl shrink-0 shadow-lg">
                            {isAddingZone ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-5 w-5" />}
                        </Button>
                    </div>
                    <div className="space-y-3">
                        {store.tables?.map(t => (
                            <div key={t} className="flex gap-2">
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="flex-1 h-14 rounded-2xl border-2 justify-between px-5 font-black uppercase text-xs tracking-widest hover:border-primary">
                                            <span>{t}</span>
                                            <QrCode className="h-5 w-5 text-primary opacity-20" />
                                        </Button>
                                    </DialogTrigger>
                                    <QRCodeDialog table={t} store={store} />
                                </Dialog>
                                <Button variant="ghost" size="icon" className="h-14 w-12 rounded-2xl text-destructive hover:bg-red-50" onClick={() => handleRemoveZone(t)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function EditMenuItemDialog({ isOpen, onOpenChange, onSave, existingItem, onDeleteItem }: any) {
  const form = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: existingItem || { name: '', price: 0, category: '', description: '', imageUrl: '', dietary: 'veg', isAvailable: true, customizations: [] },
  });
  
  const [isSaving, startSave] = useTransition();
  const [isGenerating, startGeneration] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    form.reset(existingItem || { name: '', price: 0, category: '', description: '', imageUrl: '', dietary: 'veg', isAvailable: true, customizations: [] });
  }, [existingItem, form]);

  const handleGenerateImage = () => {
      const name = form.getValues('name');
      if (!name) return;
      startGeneration(async () => {
          try {
              const res = await generateProductImage({ productName: name });
              if (res.imageUrl) {
                  form.setValue('imageUrl', res.imageUrl);
                  toast({ title: 'AI Image Ready!' });
              }
          } catch (e) { toast({ variant: 'destructive', title: 'Generation Failed' }); }
      });
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl rounded-[2.5rem] border-0 shadow-2xl overflow-hidden h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Edit Menu Item</DialogTitle>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit((data) => startSave(async () => { await onSave(data, !existingItem); onOpenChange(false); }))} className="flex-1 flex flex-col min-h-0">
                <ScrollArea className="flex-1 p-6">
                    <div className="grid md:grid-cols-2 gap-6 mb-10">
                        <div className="space-y-4">
                            <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Item Name</FormLabel><FormControl><Input {...field} className="rounded-xl h-12 border-2" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="category" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Category</FormLabel><FormControl><Input {...field} className="rounded-xl h-12 border-2" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="price" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Price (₹)</FormLabel><FormControl><Input type="number" {...field} className="rounded-xl h-12 border-2" /></FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                        <div className="space-y-4">
                            <Label className="text-[10px] font-black uppercase opacity-40">Photo</Label>
                            <div className="relative aspect-square rounded-[2rem] overflow-hidden border-2 bg-muted flex items-center justify-center">
                                {form.watch('imageUrl') ? <Image src={form.watch('imageUrl')!} alt="Preview" fill className="object-cover" /> : <ImageIcon className="h-10 w-10 opacity-20" />}
                                {isGenerating && <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm"><Loader2 className="h-8 w-8 animate-spin text-white" /></div>}
                            </div>
                            <Button type="button" variant="outline" className="w-full h-10 rounded-xl font-black text-[10px] uppercase" onClick={handleGenerateImage} disabled={isGenerating}>
                                <Sparkles className="h-4 w-4 mr-2" /> AI Generate
                            </Button>
                        </div>
                    </div>
                </ScrollArea>
                <div className="p-6 border-t bg-gray-50 flex gap-3">
                    <Button type="submit" className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" disabled={isSaving}>
                        {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Item
                    </Button>
                </div>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function MenuOnboardingTool({ storeId, onComplete, businessType }: { storeId: string, onComplete: () => void, businessType: string | undefined }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { incrementWriteCount } = useAppStore();
    const [isProcessing, startProcessing] = useTransition();
    const [isSaving, startSave] = useTransition();
    const [extractedData, setExtractedData] = useState<{items: MenuItem[], theme: MenuTheme, businessType: 'restaurant' | 'salon' | 'grocery'} | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        startProcessing(async () => {
            try {
                const reader = new FileReader();
                const imageData = await new Promise<string>((resolve) => {
                    reader.onload = (e) => resolve(e.target?.result as string);
                    reader.readAsDataURL(file);
                });
                const result = await extractMenuItems({ menuImage: imageData });
                if (result && result.items) {
                    setExtractedData({
                        items: result.items.map(i => ({ ...i, id: createSlug(i.name), isAvailable: true })),
                        theme: result.theme,
                        businessType: result.businessType
                    });
                    toast({ title: "Menu Scanned!" });
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'AI Extraction Failed' });
            }
        });
    };

    const handleSaveMenu = () => {
        if (!firestore || !extractedData) return;
        startSave(async () => {
            const batch = writeBatch(firestore);
            const menuRef = doc(collection(firestore, `stores/${storeId}/menus`));
            batch.set(menuRef, { id: menuRef.id, storeId, items: extractedData.items, theme: extractedData.theme });
            batch.update(doc(firestore, 'stores', storeId), { businessType: extractedData.businessType });
            await batch.commit().catch(e => console.error(e));
            toast({ title: "Menu Live!" });
            incrementWriteCount(1);
            onComplete();
        });
    };

    return (
        <div className="p-8 space-y-8 bg-white">
            <div className="text-center space-y-2">
                <div className="h-16 w-16 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto text-primary">
                    <Camera className="h-8 w-8" />
                </div>
                <h2 className="text-2xl font-black uppercase tracking-tight">AI Menu Scanner</h2>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Digitize your business instantly</p>
            </div>

            {extractedData ? (
                <div className="space-y-6">
                    <ScrollArea className="h-64 rounded-2xl border-2 shadow-inner">
                        <Table>
                            <TableHeader className="bg-black/5">
                                <TableRow>
                                    <TableHead className="text-[9px] font-black uppercase">Item</TableHead>
                                    <TableHead className="text-right text-[9px] font-black uppercase">Price</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {extractedData.items.map((i, idx) => (
                                    <TableRow key={idx} className="border-b last:border-0 border-black/5">
                                        <TableCell className="font-bold text-xs uppercase">{i.name}</TableCell>
                                        <TableCell className="text-right font-black text-primary">₹{i.price}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                    <div className="flex gap-2">
                        <Button onClick={handleSaveMenu} disabled={isSaving} className="flex-1 h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20">
                            {isSaving ? <Loader2 className="animate-spin h-5 w-5" /> : <CheckCircle2 className="mr-2 h-5 w-5" />}
                            Import to My Store
                        </Button>
                        <Button variant="ghost" onClick={() => setExtractedData(null)} className="h-14 rounded-2xl font-bold px-6">Retry</Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center">
                    <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                    <Button onClick={() => fileInputRef.current?.click()} disabled={isProcessing} className="w-full h-16 rounded-[2rem] font-black uppercase tracking-widest shadow-xl shadow-primary/20 text-sm">
                        {isProcessing ? <Loader2 className="mr-2 h-6 w-6 animate-spin" /> : <UploadIcon className="mr-2 h-6 w-6" />}
                        {isProcessing ? 'AI is reading...' : 'Upload Menu Photo'}
                    </Button>
                    <p className="text-[9px] font-bold opacity-40 uppercase mt-6 text-center leading-relaxed">
                        The AI will extract categories, items, and pricing.<br/>Independent store catalog will be created.
                    </p>
                </div>
            )}
        </div>
    );
}

function ManageStoreView({ store, isAdmin, onUpdate }: { store: Store; isAdmin: boolean, onUpdate: () => void }) {
    const { firestore } = useFirebase();
    const menuQuery = useMemoFirebase(() => (firestore && store.id) ? query(collection(firestore, `stores/${store.id}/menus`), limit(1)) : null, [firestore, store.id]);
    const { data: menus, isLoading } = useCollection<Menu>(menuQuery);
    const menu = menus?.[0];

    if (isLoading) return <div className="p-20 text-center opacity-20"><Loader2 className="animate-spin h-10 w-10 mx-auto" /></div>;

    return (
      <div className="animate-in fade-in slide-in-from-bottom-2 duration-700">
        {menu ? (
            <MenuDisplay store={store} menu={menu} onUpdate={onUpdate} />
        ) : (
            <div className="max-w-2xl mx-auto">
                <MenuOnboardingTool storeId={store.id} onComplete={onUpdate} businessType={store.businessType} />
            </div>
        )}
      </div>
    );
}

function QRCodeDialog({ table, store }: { table: string, store: Store }) {
    const [baseUrl, setBaseUrl] = useState('');
    useEffect(() => setBaseUrl(window.location.origin), []);
    const qrUrl = `${baseUrl}/menu/${store.id}?table=${encodeURIComponent(table)}`;
    return (
        <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl p-8 flex flex-col items-center text-center max-w-sm mx-auto">
            <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-black uppercase tracking-tight">{table}</DialogTitle>
                <DialogDescription>Branded QR Access Point</DialogDescription>
            </DialogHeader>
            <div className="p-6 bg-white rounded-[2.5rem] shadow-inner border-4 border-black/5 mb-6 flex justify-center">
                <QRCodeCanvas value={qrUrl} size={256} level="H" includeMargin={true} />
            </div>
            <div className="grid grid-cols-2 gap-3 w-full">
                <Button onClick={() => window.print()} className="h-12 rounded-xl font-black text-[10px] uppercase tracking-widest"><Printer className="mr-2 h-4 w-4" /> Print</Button>
                <Button variant="outline" asChild className="h-12 rounded-xl font-black text-[10px] uppercase tracking-widest border-2"><a href={qrUrl} target="_blank">Open</a></Button>
            </div>
        </DialogContent>
    );
}

export default function MenuManagerPage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    const { isAdmin, isLoading: isRoleLoading } = useAdminAuth();
    const { stores, userStore, fetchUserStore } = useAppStore();

    const ownerStoreQuery = useMemoFirebase(() => {
        if (!firestore || !user || isAdmin) return null;
        return query(collection(firestore, 'stores'), where('ownerId', '==', user.uid), limit(1));
    }, [firestore, user, isAdmin]);

    const { data: ownerStores, isLoading: isOwnerStoreLoading, refetch } = useCollection<Store>(ownerStoreQuery);
    const myStore = useMemo(() => ownerStores?.[0] || stores.find(s => s.ownerId === user?.uid), [ownerStores, stores, user?.uid]);

    useEffect(() => { if (!isUserLoading && !user) router.push('/login'); }, [isUserLoading, user, router]);

    if (isUserLoading || isRoleLoading || isOwnerStoreLoading) return <div className="p-12 text-center h-[80vh] flex flex-col items-center justify-center opacity-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;

    if (!myStore) return <div className="p-12 text-center py-32"><p className="font-black uppercase tracking-widest text-xs opacity-40">Store profile not found.</p></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32">
            <div className="flex flex-col justify-end border-b pb-10 border-black/5">
                <h1 className="text-3xl md:text-6xl font-black font-headline tracking-tight uppercase leading-none text-gray-950 truncate">{myStore.name}</h1>
                <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Catalog & QR Control Hub</p>
            </div>
            <ManageStoreView store={myStore} isAdmin={isAdmin} onUpdate={() => refetch && refetch()} />
        </div>
    );
}
