
'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, limit, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { Store, Menu, MenuItem, MenuTheme } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Sparkles, Loader2, Save, QrCode, Printer, Copy, AlertTriangle, List, PlusCircle, Edit, ImageIcon, Check, Upload as UploadIcon, Link2, SwitchCamera, CheckCircle2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode.react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Textarea } from '@/components/ui/textarea';
import { getIngredientsForDish } from '@/app/actions';
import { extractMenuItems } from '@/ai/flows/extract-menu-items-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { generateProductImage } from '@/ai/flows/generate-product-image-flow';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

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

const menuItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Item name is required."),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  category: z.string().min(2, "Category is required."),
  imageUrl: z.string().url("Please enter a valid URL").optional().or(z.literal('')),
  dietary: z.enum(['veg', 'non-veg']).optional(),
  isAvailable: z.boolean().default(true),
});
type MenuItemFormValues = z.infer<typeof menuItemSchema>;

function EditMenuItemDialog({
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
    defaultValues: existingItem || { name: '', price: 0, category: '', description: '', imageUrl: '', dietary: 'veg', isAvailable: true },
  });
  
  const [isSaving, startSave] = useTransition();
  const [isGenerating, startGeneration] = useTransition();
  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { storage } = useFirebase();

  useEffect(() => {
    form.reset(existingItem || { name: '', price: 0, category: '', description: '', imageUrl: '', dietary: 'veg', isAvailable: true });
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

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !storage) return;

    startUpload(async () => {
        try {
            const storageRef = ref(storage, `menu-items/${Date.now()}-${file.name}`);
            const uploadTask = uploadBytesResumable(storageRef, file);

            uploadTask.on(
                'state_changed',
                null,
                (error) => {
                    console.error("Upload failed", error);
                    toast({ variant: 'destructive', title: 'Upload Failed', description: error.message });
                },
                () => {
                    getDownloadURL(uploadTask.snapshot.ref).then((downloadURL) => {
                        form.setValue('imageUrl', downloadURL);
                        toast({ title: 'Image Uploaded!' });
                    });
                }
            );
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Upload Error', description: error.message });
        }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl rounded-[2.5rem] border-0 shadow-2xl overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Edit Menu Item</DialogTitle>
          <DialogDescription className="font-bold opacity-60">
            {existingItem ? `Update details for ${existingItem.name}.` : 'Add a new item to your menu.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6 p-6 pt-2">
                 <div className="grid md:grid-cols-2 gap-8">
                    <div className="space-y-4">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Item Name</FormLabel><FormControl><Input {...field} placeholder="e.g., Chicken Biryani" className="rounded-xl h-12 border-2" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="category" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Category</FormLabel><FormControl><Input {...field} placeholder="e.g., Main Course" className="rounded-xl h-12 border-2" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField control={form.control} name="price" render={({ field }) => (
                                <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Price (₹)</FormLabel><FormControl><Input type="number" step="0.01" {...field} className="rounded-xl h-12 border-2" /></FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="isAvailable" render={({ field }) => (
                                <FormItem className="flex flex-col">
                                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Availability</FormLabel>
                                    <div className="flex items-center h-12 gap-2 px-2 border-2 rounded-xl bg-muted/20">
                                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                                        <span className="text-[10px] font-bold uppercase">{field.value ? 'In Stock' : 'Sold Out'}</span>
                                    </div>
                                </FormItem>
                            )} />
                        </div>
                        <FormField control={form.control} name="dietary" render={({ field }) => (
                            <FormItem className="space-y-2">
                                <FormLabel className="text-[10px] font-black uppercase opacity-40">Dietary Preference</FormLabel>
                                <FormControl>
                                    <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="veg" id="veg" />
                                            <Label htmlFor="veg" className="text-xs font-bold uppercase">Vegetarian</Label>
                                        </div>
                                        <div className="flex items-center space-x-2">
                                            <RadioGroupItem value="non-veg" id="non-veg" />
                                            <Label htmlFor="non-veg" className="text-xs font-bold uppercase">Non-Veg</Label>
                                        </div>
                                    </RadioGroup>
                                </FormControl>
                            </FormItem>
                        )} />
                    </div>
                    
                    <div className="space-y-4">
                        <Label className="text-[10px] font-black uppercase opacity-40">Item Visuals</Label>
                        <div className="relative aspect-square rounded-[2rem] overflow-hidden border-2 bg-muted flex items-center justify-center group">
                            {form.watch('imageUrl') ? (
                                <Image src={form.watch('imageUrl')!} alt="Preview" fill className="object-cover" />
                            ) : (
                                <div className="text-center opacity-20">
                                    <ImageIcon className="h-12 w-12 mx-auto mb-2" />
                                    <p className="text-[10px] font-black uppercase">No Photo</p>
                                </div>
                            )}
                            {(isUploading || isGenerating) && (
                                <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-sm transition-all">
                                    <Loader2 className="h-10 w-10 animate-spin text-white" />
                                </div>
                            )}
                        </div>
                        
                        <div className="space-y-3">
                            <div className="flex gap-2">
                                <div className="relative flex-grow">
                                    <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                                    <Input placeholder="Paste image URL..." {...form.register('imageUrl')} className="rounded-xl h-10 border-2 text-xs pl-9" />
                                </div>
                                <Button type="button" variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0" onClick={handleGenerateImage} disabled={isGenerating || isUploading} title="AI Generate Photo">
                                    {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 text-primary" />}
                                </Button>
                            </div>
                            <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
                            <Button type="button" variant="secondary" className="w-full h-10 rounded-xl font-black text-[10px] uppercase tracking-widest" onClick={() => fileInputRef.current?.click()} disabled={isUploading || isGenerating}>
                                <UploadIcon className="mr-2 h-4 w-4" /> Upload from Device
                            </Button>
                        </div>
                    </div>
                 </div>
                 
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Description (Optional)</FormLabel><FormControl><Textarea {...field} placeholder="A short description of the dish." className="rounded-xl min-h-[80px] border-2" /></FormControl><FormMessage /></FormItem>
                )} />
                
                <DialogFooter className="pt-4 gap-3">
                   {existingItem && onDeleteItem && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild><Button type="button" variant="destructive" className="mr-auto rounded-xl font-black text-[10px] uppercase h-12" disabled={isSaving || isUploading}>Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[2rem] border-0 shadow-2xl"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase tracking-tight">Remove Dish?</AlertDialogTitle><AlertDialogDescription className="font-bold">This will permanently delete &quot;{existingItem.name}&quot; from your digital menu.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">Delete Item</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                    </AlertDialog>
                   )}
                    <DialogClose asChild><Button type="button" variant="ghost" className="rounded-xl font-bold h-12" disabled={isSaving}>Cancel</Button></DialogClose>
                    <Button type="submit" className="rounded-xl h-12 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" disabled={isSaving || isUploading}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Item</Button>
                </DialogFooter>
            </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
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

    const toggleAvailability = async (it: MenuItem) => {
        const uI = menu.items.map(i => i.id === it.id ? { ...i, isAvailable: !i.isAvailable } : i);
        const uM = { ...menu, items: uI }; setMenu(uM);
        if (!(await persistMenu(uM))) { setMenu(menu); toast({ variant: 'destructive', title: 'Toggle Failed' }); }
    };

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
            {isEditDialogOpen && <EditMenuItemDialog isOpen={isEditDialogOpen} onOpenChange={setIsEditDialogOpen} onSave={handleSaveItem} existingItem={editingItem} onDeleteItem={handleDeleteItem} />}
            <Card className="rounded-3xl border-0 shadow-xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-black/5 pb-6"><div className="flex justify-between items-center"><CardTitle className="text-xl font-black uppercase tracking-tight">Active Menu</CardTitle><Button size="sm" variant="outline" className="rounded-xl font-black text-[9px] uppercase border-2 h-8 px-4" onClick={() => { setEditingItem(null); setIsEditDialogOpen(true); }}>Add Item</Button></div></CardHeader>
                <CardContent className="p-0">
                     <Table>
                        <TableHeader className="bg-black/5"><TableRow><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Item</TableHead><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Stock</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Edit</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {menu.items.map((it) => (
                                <TableRow key={it.id} className={cn("hover:bg-muted/30", !it.isAvailable && "opacity-50")}>
                                    <TableCell className="py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-10 w-10 rounded-xl overflow-hidden border bg-muted shrink-0"><Image src={it.imageUrl || ADIRES_LOGO} alt={it.name} fill className="object-cover" /></div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <p className="font-bold text-sm leading-tight truncate">{it.name}</p>
                                                    {it.dietary && <div className={cn("h-2.5 w-2.5 rounded-sm border-2", it.dietary === 'veg' ? 'border-green-600 bg-green-600' : 'border-red-600 bg-red-600')}></div>}
                                                </div>
                                                <p className="text-[10px] font-black text-primary opacity-60">₹{it.price.toFixed(0)}</p>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Switch checked={it.isAvailable} onCheckedChange={() => toggleAvailability(it)} />
                                    </TableCell>
                                    <TableCell className="text-right"><Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => { setEditingItem(it); setIsEditDialogOpen(true); }}><Edit className="h-4 w-4" /></Button></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                     <div className="p-6 border-t border-black/5 bg-black/5"><Button onClick={onReplace} variant="destructive" className="w-full rounded-xl font-black text-[10px] uppercase tracking-widest h-12 shadow-lg">Delete & Start Over</Button></div>
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
                    ) : <div className="text-center py-10 opacity-30"><p className="text-xs font-black uppercase tracking-widest mb-4">No tables found</p><Button asChild variant="secondary" className="rounded-xl font-black text-[10px] uppercase h-10 px-6"><Link href="/dashboard/owner/my-store">Go to Store Details</Link></Button></div>}
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
