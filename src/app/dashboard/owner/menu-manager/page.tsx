
'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, limit, updateDoc } from 'firebase/firestore';
import type { Store, Menu, MenuItem, MenuTheme } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Sparkles, Loader2, Save, QrCode, Printer, Copy, AlertTriangle, List, PlusCircle, Edit, ImageIcon, Check } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import QRCode from 'qrcode.react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { getIngredientsForDish } from '@/app/actions';
import { extractMenuItems } from '@/ai/flows/extract-menu-items-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { generateProductImage } from '@/ai/flows/generate-product-image-flow';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

// Helper to create a URL-friendly slug from a string
const createSlug = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-') 
      .replace(/[^\w-]+/g, '') 
      .replace(/--+/g, '-') 
      .replace(/^-+/, '') 
      .replace(/-+$/, ''); 
  };

// Schema for a single menu item
const menuItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Item name is required."),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  category: z.string().min(2, "Category is required."),
  imageUrl: z.string().url("Please enter a valid URL").optional().or(z.literal('')),
});
type MenuItemFormValues = z.infer<typeof menuItemSchema>;


function EditMenuDialog({
  isOpen,
  onOpenChange,
  onSave,
  existingItem,
  onDeleteItem,
}: {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (item: MenuItem, isNew: boolean) => Promise<void>;
  existingItem?: MenuItem | null;
  onDeleteItem?: (itemToDelete: MenuItem) => Promise<void>;
}) {
  const form = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: existingItem || { name: '', price: 0, category: '', description: '', imageUrl: '' },
  });
  const [isSaving, startSave] = useTransition();
  const [isGenerating, startGeneration] = useTransition();
  const { toast } = useToast();

  useEffect(() => {
    form.reset(existingItem || { name: '', price: 0, category: '', description: '', imageUrl: '' });
  }, [existingItem, form]);

  const handleSubmit = (data: MenuItemFormValues) => {
    startSave(async () => {
        await onSave(data as MenuItem, !existingItem);
        onOpenChange(false);
    });
  };
  
  const handleDelete = () => {
    if (existingItem && onDeleteItem) {
        startSave(async () => {
            await onDeleteItem(existingItem);
            onOpenChange(false);
        });
    }
  }

  const handleGenerateImage = () => {
      const name = form.getValues('name');
      if (!name) { toast({ variant: 'destructive', title: 'Name required' }); return; }
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
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{existingItem ? 'Edit Menu Item' : 'Add New Item'}</DialogTitle>
          <DialogDescription>
            {existingItem ? `Update details for ${existingItem.name}.` : 'Add a new item to your menu.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                 <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel>Item Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Chicken Biryani" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem><FormLabel>Category</FormLabel><FormControl><Input {...field} placeholder="e.g., Main Course" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="price" render={({ field }) => (
                            <FormItem><FormLabel>Price (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} /></FormControl><FormMessage /></FormItem>
                        )} />
                    </div>
                    <div className="space-y-4">
                        <Label>Dish Image</Label>
                        <div className="relative aspect-square rounded-2xl overflow-hidden border bg-muted flex items-center justify-center">
                            {form.watch('imageUrl') ? (
                                <Image src={form.watch('imageUrl')!} alt="Preview" fill className="object-cover" />
                            ) : <p className="text-[10px] uppercase font-black opacity-20">No Image</p>}
                        </div>
                        <div className="flex gap-2">
                            <Input placeholder="Image URL..." {...form.register('imageUrl')} className="flex-1" />
                            <Button type="button" variant="secondary" onClick={handleGenerateImage} disabled={isGenerating}>
                                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                 </div>
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel>Description (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="A short description of the dish." /></FormControl><FormMessage /></FormItem>
                )} />
                <DialogFooter className="pt-4">
                   {existingItem && onDeleteItem && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild><Button type="button" variant="destructive" className="mr-auto" disabled={isSaving}>Delete Item</Button></AlertDialogTrigger>
                        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will remove "{existingItem.name}" from your menu.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                    </AlertDialog>
                   )}
                    <DialogClose asChild><Button type="button" variant="outline" disabled={isSaving}>Cancel</Button></DialogClose>
                    <Button type="submit" disabled={isSaving}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Item</Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function MenuUploader({ onMenuExtracted }: { onMenuExtracted: (data: { items: MenuItem[], theme: MenuTheme }) => void }) {
    const { toast } = useToast();
    const [isProcessing, startProcessing] = useTransition();
    const [menuImage, setMenuImage] = useState<string | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (event) => setMenuImage(event.target?.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleExtract = () => {
        if (!menuImage) { toast({ variant: 'destructive', title: 'Select image' }); return; }
        startProcessing(async () => {
            try {
                const result = await extractMenuItems({ menuImage });
                if (result.items?.length > 0) {
                    onMenuExtracted({ items: result.items as any, theme: result.theme as any });
                    toast({ title: 'Menu Extracted!', description: `Found ${result.items.length} items.` });
                } else {
                    toast({ variant: 'destructive', title: 'No Items Found' });
                }
            } catch (error) { toast({ variant: 'destructive', title: 'Extraction Failed' }); }
        });
    };

    return (
        <Card>
            <CardHeader><CardTitle>1. Create Your Menu</CardTitle><CardDescription>Upload a picture of your physical menu. AI will convert it to a digital menu.</CardDescription></CardHeader>
            <CardContent className="space-y-4">
                <div className="w-full aspect-video relative rounded-md overflow-hidden border bg-muted flex items-center justify-center">{menuImage ? <Image src={menuImage} alt="Menu preview" fill className="object-contain" /> : <p className="text-muted-foreground opacity-20 font-black uppercase text-xs">Menu Photo</p>}</div>
                <Input type="file" accept="image/*" onChange={handleFileChange} disabled={isProcessing} />
                <Button onClick={handleExtract} disabled={!menuImage || isProcessing} className="w-full">{isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}{isProcessing ? 'Analyzing Menu...' : 'Extract Menu Items with AI'}</Button>
            </CardContent>
        </Card>
    );
}

function QRCodeDialog({ table, storeId }: { table: string, storeId: string }) {
    const [menuUrl, setMenuUrl] = useState('');
    const { toast } = useToast();
    useEffect(() => { if (typeof window !== 'undefined') setMenuUrl(`${window.location.origin}/menu/${storeId}?table=${encodeURIComponent(table)}`); }, [storeId, table]);
    
    const handlePrint = () => {
        const qrCodeElement = document.getElementById(`qr-code-container-${table}`);
        if (qrCodeElement) {
            const pW = window.open('', '', 'height=600,width=800');
            pW?.document.write(`<html><head><title>QR ${table}</title><style>body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; font-family: sans-serif; } .qr-container { padding: 40px; border: 4px solid black; border-radius: 40px; }</style></head><body><h1>Scan for ${table}</h1><div class="qr-container">${qrCodeElement.innerHTML}</div></body></html>`);
            pW?.document.close(); pW?.focus(); pW?.print();
        }
    };
    
    return (
        <DialogContent>
            <DialogHeader><DialogTitle>QR Code for {table}</DialogTitle></DialogHeader>
            <div className="flex flex-col items-center gap-4">
                 <div id={`qr-code-container-${table}`} className="p-6 bg-white rounded-[2.5rem] border-4 border-black relative">
                    {menuUrl ? <QRCode value={menuUrl} size={256} /> : <div className="w-[256px] h-[256px] bg-gray-200 animate-pulse" />}
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-4 py-2 rounded-xl border-4 border-black"><span className="text-4xl font-black text-black">{table}</span></div>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full">
                    <Button onClick={() => navigator.clipboard.writeText(menuUrl).then(() => toast({title:'Copied'}))} variant="outline"><Copy className="mr-2 h-4 w-4" /> Copy Link</Button>
                    <Button onClick={handlePrint} className="w-full"><Printer className="mr-2 h-4 w-4" /> Print QR Code</Button>
                </div>
            </div>
        </DialogContent>
    )
}

function MenuDisplay({ store, menu: initialMenu, onReplace }: { store: Store, menu: Menu, onReplace: () => void }) {
    const { toast } = useToast(); const { firestore } = useFirebase(); const [isGenerating, startGeneration] = useTransition(); const [menu, setMenu] = useState(initialMenu);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false); const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [cachedStatus, setCachedStatus] = useState<Record<string, boolean>>({});

    useEffect(() => { setMenu(initialMenu); }, [initialMenu]);

    const persistMenu = async (uM: Menu) => {
        if (!firestore) return false;
        try { await setDoc(doc(firestore, `stores/${store.id}/menus`, uM.id), uM, { merge: true }); return true; } catch (e) { return false; }
    };

    const handleSaveItem = async (itemData: MenuItem, isNew: boolean) => {
        let uI;
        if (isNew) { uI = [...menu.items, { ...itemData, id: createSlug(itemData.name) }]; } 
        else { uI = menu.items.map(i => i.id === editingItem?.id ? { ...i, ...itemData } : i); }
        const uM = { ...menu, items: uI }; setMenu(uM);
        if (!(await persistMenu(uM))) setMenu(menu); else toast({ title: "Saved!" });
    };

    const handleDeleteItem = async (it: MenuItem) => {
         const uI = menu.items.filter(i => i.id !== it.id);
         const uM = { ...menu, items: uI }; setMenu(uM);
         if (!(await persistMenu(uM))) setMenu(menu); else toast({ title: "Deleted" });
    }

    const handleGenerateIngredients = async (item: MenuItem) => {
        startGeneration(async () => {
            try {
                const result = await getIngredientsForDish({ dishName: item.name, language: 'en' });
                if (result.isSuccess) { toast({ title: 'Cached!' }); setCachedStatus(p => ({ ...p, [item.id]: true })); }
            } catch (e) { toast({ variant: 'destructive', title: 'Failed' }); }
        });
    };
    
    return (
        <div className="grid md:grid-cols-2 gap-8">
            {isEditDialogOpen && <EditMenuDialog isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSave={handleSaveItem} existingItem={editingItem} onDeleteItem={handleDeleteItem} />}
            <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-black/5 pb-6"><div className="flex justify-between items-center"><CardTitle className="text-xl font-black uppercase tracking-tight">Active Menu</CardTitle><Button size="sm" variant="outline" className="rounded-xl font-black text-[9px] uppercase border-2" onClick={() => { setEditingItem(null); setIsEditDialogOpen(true); }}>Add Item</Button></div></CardHeader>
                <CardContent className="p-0">
                     <Table>
                        <TableHeader className="bg-black/5"><TableRow><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Item</TableHead><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Status</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Edit</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {menu.items.map((it) => (
                                <TableRow key={it.id} className="hover:bg-muted/30">
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-10 w-10 rounded-xl overflow-hidden border bg-muted shrink-0"><Image src={it.imageUrl || ADIRES_LOGO} alt={it.name} fill className="object-cover" /></div>
                                            <div><p className="font-bold text-sm leading-tight">{it.name}</p><p className="text-[10px] font-black text-primary opacity-60">₹{it.price.toFixed(0)}</p></div>
                                        </div>
                                    </TableCell>
                                    <TableCell>{cachedStatus[it.id] ? <Badge className="rounded-md bg-green-500 text-white text-[8px] font-black uppercase">Cached</Badge> : <Button size="sm" variant="ghost" className="h-7 text-[8px] font-black uppercase tracking-widest opacity-40" onClick={() => handleGenerateIngredients(it)} disabled={isGenerating}>{isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cache'}</Button>}</TableCell>
                                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setEditingItem(it); setIsEditDialogOpen(true); }}><Edit className="h-4 w-4" /></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                     <div className="p-6 border-t border-black/5 bg-black/5"><Button onClick={onReplace} variant="destructive" className="w-full rounded-xl font-black text-[10px] uppercase tracking-widest h-12">Delete & Start Over</Button></div>
                </CardContent>
            </Card>
             <Card className="rounded-3xl border-0 shadow-xl overflow-hidden h-fit">
                <CardHeader className="bg-primary/5 border-b border-black/5 pb-6"><CardTitle className="text-xl font-black uppercase tracking-tight">Floor Map QR Codes</CardTitle><CardDescription className="text-xs font-bold opacity-40 uppercase">Unique scans for every table</CardDescription></CardHeader>
                <CardContent className="p-6 space-y-4">
                    {store.tables?.length ? (
                        <div className="grid grid-cols-2 gap-3">
                            {store.tables.map(t => (
                                <Dialog key={t}><DialogTrigger asChild><Button variant="outline" className="h-14 rounded-2xl border-2 justify-between px-4 font-black uppercase text-[10px] tracking-widest"><span>{t}</span><QrCode className="h-4 w-4 opacity-20" /></Button></DialogTrigger><QRCodeDialog table={t} storeId={store.id} /></Dialog>
                            ))}
                        </div>
                    ) : <div className="text-center py-10 opacity-30"><p className="text-xs font-black uppercase tracking-widest mb-4">No tables found</p><Button asChild variant="secondary" className="rounded-xl font-black text-[10px] uppercase"><Link href="/dashboard/owner/my-store">Go to Store Details</Link></Button></div>}
                </CardContent>
            </Card>
        </div>
    );
}

export default function MenuManagerPage() {
    const { user, firestore } = useFirebase(); const [extractedData, setExtractedData] = useState<{items: MenuItem[], theme: MenuTheme} | null>(null); const { toast } = useToast(); const [isSaving, startSave] = useTransition();
    const { data: stores, isLoading: sL } = useCollection<Store>(useMemoFirebase(() => (firestore && user ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid), limit(1)) : null), [firestore, user]));
    const store = stores?.[0];
    const { data: menus, isLoading: mL, refetch: rM } = useCollection<Menu>(useMemoFirebase(() => (firestore && store ? query(collection(firestore, `stores/${store.id}/menus`)) : null), [firestore, store]));
    const existingMenu = menus?.[0];
    
    const handleSaveMenu = () => {
        if (!firestore || !store || !extractedData) return;
        startSave(async () => {
            const mR = existingMenu ? doc(firestore, `stores/${store.id}/menus`, existingMenu.id) : doc(collection(firestore, `stores/${store.id}/menus`));
            const mD: Menu = { id: mR.id, storeId: store.id, items: extractedData.items.map(i => ({...i, id: i.id || createSlug(i.name) })), theme: extractedData.theme };
            try { await setDoc(mR, mD, { merge: true }); toast({ title: 'Menu Saved!' }); setExtractedData(null); rM?.(); } catch (e) { toast({ variant: 'destructive', title: 'Save Failed' }); }
        });
    };

    if (sL || mL) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;
    if (!store) return <div className="p-12 text-center"><p className="font-black uppercase tracking-widest text-xs opacity-40">Please create a store first.</p></div>;
    
    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="mb-12 border-b pb-10 border-black/5"><h1 className="text-5xl font-black font-headline tracking-tighter">Menu Control Center</h1><p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">STORE: {store.name}</p></div>
            {existingMenu && !extractedData ? (
                <MenuDisplay store={store} menu={existingMenu} onReplace={() => setExtractedData({ items: [], theme: existingMenu.theme || { backgroundColor: '#ffffff', primaryColor: '#000000', textColor: '#000000' } })} />
            ) : (
                 <div className="grid md:grid-cols-2 gap-8">
                     <MenuUploader onMenuExtracted={setExtractedData} />
                     {extractedData && (
                        <Card className="rounded-3xl border-0 shadow-2xl overflow-hidden h-fit">
                            <CardHeader className="bg-primary/5 border-b border-black/5 pb-6"><CardTitle className="text-xl font-black uppercase tracking-tight">Review Extraction</CardTitle><CardDescription className="text-xs font-bold opacity-40 uppercase">AI extracted {extractedData.items.length} items</CardDescription></CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="max-h-[50vh]"><Table><TableHeader className="bg-black/5"><TableRow><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Category</TableHead><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Item</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Price</TableHead></TableRow></TableHeader><TableBody>{extractedData.items.map((i, idx) => (<TableRow key={idx}><TableCell className="text-[10px] font-bold opacity-60">{i.category}</TableCell><TableCell className="font-black text-xs">{i.name}</TableCell><TableCell className="text-right font-black text-xs">₹{i.price.toFixed(0)}</TableCell></TableRow>))}</TableBody></Table></ScrollArea>
                                <div className="p-6 bg-black/5 border-t border-black/5"><Button onClick={handleSaveMenu} disabled={isSaving || extractedData.items.length === 0} className="w-full rounded-2xl h-14 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{existingMenu ? 'Replace with New Menu' : 'Create Digital Menu'}</Button><Button variant="ghost" onClick={() => setExtractedData(null)} className="w-full mt-4 text-[10px] font-black uppercase tracking-widest opacity-40">Cancel</Button></div>
                            </CardContent>
                        </Card>
                     )}
                 </div>
            )}
        </div>
    );
}
