
'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, limit, updateDoc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import type { Store, Menu, MenuItem, MenuTheme, CustomizationGroup, CustomizationOption } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Sparkles, Loader2, Save, QrCode, Printer, Copy, AlertTriangle, List, PlusCircle, Edit, ImageIcon, Check, Upload as UploadIcon, Link2, SwitchCamera, CheckCircle2, Plus, X } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import Link from 'next/link';
import QRCode from 'qrcode.react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { useForm, useFieldArray } from 'react-hook-form';
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
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

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

function CustomizationEditor({ control, register }: { control: any, register: any }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: "customizations"
    });

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black uppercase opacity-40">Options & Add-ons</Label>
                <Button type="button" variant="outline" size="sm" className="h-7 rounded-lg text-[8px] font-black uppercase" onClick={() => append({ title: '', options: [{ name: '', price: 0 }] })}>
                    <Plus className="h-3 w-3 mr-1" /> Add Group
                </Button>
            </div>
            
            {fields.map((field, index) => (
                <div key={field.id} className="p-4 rounded-2xl border-2 bg-muted/20 space-y-4 relative">
                    <Button type="button" variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => remove(index)}>
                        <X className="h-3 w-3" />
                    </Button>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[8px] font-black uppercase opacity-40">Group Name</Label>
                            <Input {...register(`customizations.${index}.title`)} placeholder="e.g., Spice Level" className="h-9 rounded-lg text-xs" />
                        </div>
                        <div className="flex items-center gap-4 pt-4">
                            <div className="flex items-center gap-2">
                                <Switch {...register(`customizations.${index}.required`)} />
                                <span className="text-[8px] font-black uppercase">Required</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Switch {...register(`customizations.${index}.multiSelect`)} />
                                <span className="text-[8px] font-black uppercase">Multi</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="space-y-2">
                        <Label className="text-[8px] font-black uppercase opacity-40">Options</Label>
                        <OptionsList nestIndex={index} control={control} register={register} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function OptionsList({ nestIndex, control, register }: { nestIndex: number, control: any, register: any }) {
    const { fields, append, remove } = useFieldArray({
        control,
        name: `customizations.${nestIndex}.options`
    });

    return (
        <div className="space-y-2">
            {fields.map((field, index) => (
                <div key={field.id} className="flex gap-2 items-center">
                    <Input {...register(`customizations.${nestIndex}.options.${index}.name`)} placeholder="Option name" className="h-8 rounded-lg text-[10px] flex-1" />
                    <div className="relative w-20">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[8px] opacity-40">₹</span>
                        <Input type="number" {...register(`customizations.${nestIndex}.options.${index}.price`)} className="h-8 rounded-lg text-[10px] pl-4" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => remove(index)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                </div>
            ))}
            <Button type="button" variant="ghost" size="sm" className="h-7 text-[8px] font-black uppercase" onClick={() => append({ name: '', price: 0 })}>
                <Plus className="h-3 w-3 mr-1" /> Add Option
            </Button>
        </div>
    );
}

function MenuUploader({ onMenuExtracted }: { onMenuExtracted: (data: { items: MenuItem[], theme: MenuTheme, businessType: 'restaurant' | 'salon' | 'grocery' }) => void }) {
    const [isProcessing, startProcessing] = useTransition();
    const { toast } = useToast();
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
                    const normalizedItems = result.items.map(item => ({
                        ...item,
                        id: createSlug(item.name),
                        isAvailable: true 
                    }));
                    onMenuExtracted({ 
                        items: normalizedItems, 
                        theme: result.theme, 
                        businessType: result.businessType 
                    });
                    toast({ title: "Menu Extracted!", description: `Identified as a ${result.businessType} business.` });
                } else {
                    throw new Error("No items found in image.");
                }
            } catch (error: any) {
                toast({ variant: 'destructive', title: 'Extraction Failed', description: error.message });
            }
        });
    };

    return (
        <Card className="rounded-3xl border-0 shadow-xl overflow-hidden bg-primary/5 border-2 border-dashed border-primary/20">
            <CardHeader className="text-center pb-2">
                <CardTitle className="text-xl font-black uppercase tracking-tight">AI Menu Scanner</CardTitle>
                <CardDescription className="text-xs font-bold opacity-40 uppercase">Upload a photo of your paper menu</CardDescription>
            </CardHeader>
            <CardContent className="p-8 flex flex-col items-center">
                <div className="h-24 w-24 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                    <ImageIcon className="h-10 w-10 text-primary" />
                </div>
                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
                <Button 
                    onClick={() => fileInputRef.current?.click()} 
                    disabled={isProcessing}
                    className="w-full h-14 rounded-2xl font-black uppercase tracking-widest shadow-xl shadow-primary/20"
                >
                    {isProcessing ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <UploadIcon className="mr-2 h-5 w-5" />}
                    {isProcessing ? 'AI is Reading Menu...' : 'Upload Menu Photo'}
                </Button>
                <p className="mt-4 text-[10px] font-black uppercase tracking-widest opacity-30 text-center">
                    Gemini AI will extract all dish names, prices, and your business vertical instantly.
                </p>
            </CardContent>
        </Card>
    );
}

function QRCodeDialog({ table, storeId }: { table: string, storeId: string }) {
    const [baseUrl, setBaseUrl] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        setBaseUrl(window.location.origin);
    }, []);

    const qrUrl = `${baseUrl}/menu/${storeId}?table=${encodeURIComponent(table)}`;

    const handlePrint = () => {
        const win = window.open('', '_blank');
        if (!win) return;
        const canvas = document.getElementById(`qr-${table}`) as HTMLCanvasElement;
        if (!canvas) return;
        
        win.document.write(`
            <html>
                <head>
                    <title>Table ${table} QR Code</title>
                    <style>
                        body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; font-family: sans-serif; text-align: center; }
                        .container { border: 4px solid #000; padding: 40px; border-radius: 40px; }
                        h1 { font-size: 48px; margin-bottom: 10px; }
                        p { font-size: 24px; margin-bottom: 30px; opacity: 0.6; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <h1>Table ${table}</h1>
                        <p>Scan to Order</p>
                        <img src="${canvas.toDataURL()}" width="400" height="400" />
                    </div>
                    <script>window.onload = () => { window.print(); window.close(); }</script>
                </body>
            </html>
        `);
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(qrUrl).then(() => {
            toast({ title: "Link Copied!" });
        });
    };

    return (
        <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl p-8 flex flex-col items-center text-center max-w-sm mx-auto">
            <DialogHeader className="mb-4">
                <DialogTitle className="text-xl font-black uppercase tracking-tight">Table {table}</DialogTitle>
                <DialogDescription>Place this QR code on the table for guests to scan and order.</DialogDescription>
            </DialogHeader>
            
            <div className="p-6 bg-white rounded-[2.5rem] shadow-inner border-4 border-black/5 mb-6 flex justify-center">
                <QRCode 
                    id={`qr-${table}`}
                    value={qrUrl} 
                    size={200} 
                    level="H" 
                    includeMargin={true} 
                />
            </div>

            <div className="grid grid-cols-2 gap-3 w-full">
                <Button onClick={handlePrint} className="h-12 rounded-xl font-black text-[10px] uppercase tracking-widest">
                    <Printer className="mr-2 h-4 w-4" /> Print
                </Button>
                <Button onClick={handleCopy} variant="outline" className="h-12 rounded-xl font-black text-[10px] uppercase tracking-widest border-2">
                    <Copy className="mr-2 h-4 w-4" /> Link
                </Button>
            </div>
        </DialogContent>
    );
}

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
    defaultValues: existingItem || { name: '', price: 0, category: '', description: '', imageUrl: '', dietary: 'veg', isAvailable: true, customizations: [] },
  });
  
  const [isSaving, startSave] = useTransition();
  const [isGenerating, startGeneration] = useTransition();
  const [isUploading, startUpload] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { storage } = useFirebase();

  useEffect(() => {
    form.reset(existingItem || { name: '', price: 0, category: '', description: '', imageUrl: '', dietary: 'veg', isAvailable: true, customizations: [] });
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
      <DialogContent className="max-w-4xl rounded-[2.5rem] border-0 shadow-2xl overflow-hidden h-[90vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-0 shrink-0">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Edit Menu Item</DialogTitle>
          <DialogDescription className="font-bold opacity-60">
            {existingItem ? `Update details for ${existingItem.name}.` : 'Add a new item to your menu.'}
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
                <ScrollArea className="flex-1 p-6 pt-2">
                    <div className="space-y-8 pb-10">
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
                                                <Switch checked={field.value !== false} onCheckedChange={field.onChange} />
                                                <span className="text-[10px] font-bold uppercase">{field.value !== false ? 'In Stock' : 'Sold Out'}</span>
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

                        <CustomizationEditor control={form.control} register={form.register} />
                    </div>
                </ScrollArea>
                
                <div className="p-6 border-t bg-gray-50 flex gap-3 shrink-0">
                   {existingItem && onDeleteItem && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild><Button type="button" variant="destructive" className="mr-auto rounded-xl font-black text-[10px] uppercase h-12" disabled={isSaving || isUploading}>Delete</Button></AlertDialogTrigger>
                        <AlertDialogContent className="rounded-[2rem] border-0 shadow-2xl"><AlertDialogHeader><AlertDialogTitle className="font-black uppercase tracking-tight">Remove Dish?</AlertDialogTitle><AlertDialogDescription className="font-bold">This will permanently delete &quot;{existingItem.name}&quot; from your digital menu.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter className="gap-2"><AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel><AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">Delete Item</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                    </AlertDialog>
                   )}
                    <DialogClose asChild><Button type="button" variant="ghost" className="rounded-xl font-bold h-12" disabled={isSaving}>Cancel</Button></DialogClose>
                    <Button type="submit" className="rounded-xl h-12 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20" disabled={isSaving || isUploading}>{isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save Item</Button>
                </div>
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
        if (isNew) { uI = [...menu.items, { ...itemData, id: createSlug(itemData.name), isAvailable: true }]; } 
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
        const currentStatus = it.isAvailable !== false; // Default to available
        const uI = menu.items.map(i => i.id === it.id ? { ...i, isAvailable: !currentStatus } : i);
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
                        <TableHeader className="bg-black/5"><TableRow><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Item</TableHead><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Stock</TableHead><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Specialist</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Edit</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {menu.items.map((it) => (
                                <TableRow key={it.id} className={cn("hover:bg-muted/30", it.isAvailable === false && "opacity-50")}>
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
                                        <Switch checked={it.isAvailable !== false} onCheckedChange={() => toggleAvailability(it)} />
                                    </TableCell>
                                    <TableCell>
                                        {cachedStatus[it.id] ? (
                                            <Badge className="rounded-md bg-green-500 text-white text-[8px] font-black uppercase">Cached</Badge>
                                        ) : (
                                            <Button 
                                                size="sm" 
                                                variant="ghost" 
                                                className="h-7 text-[8px] font-black uppercase tracking-widest opacity-40"
                                                onClick={() => handleGenerateIngredients(it)}
                                                disabled={isGenerating}
                                            >
                                                {isGenerating ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Cache'}
                                            </Button>
                                        )}
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
                                <Dialog key={t}>
                                    <DialogTrigger asChild>
                                        <Button variant="outline" className="h-14 rounded-2xl border-2 justify-between px-4 font-black uppercase text-[10px] tracking-widest">
                                            <span>{t}</span>
                                            <QrCode className="h-4 w-4 opacity-20" />
                                        </Button>
                                    </DialogTrigger>
                                    <QRCodeDialog table={t} storeId={store.id} />
                                </Dialog>
                            ))}
                        </div>
                    ) : <div className="text-center py-10 opacity-30"><p className="text-xs font-black uppercase tracking-widest mb-4">No tables found</p><Button asChild variant="secondary" className="rounded-xl font-black text-[10px] uppercase h-10 px-6"><Link href="/dashboard/owner/my-store">Go to Store Details</Link></Button></div>}
                </CardContent>
            </Card>
        </div>
    );
}

export default function MenuManagerPage() {
    const { user, firestore } = useFirebase(); 
    const [extractedData, setExtractedData] = useState<{items: MenuItem[], theme: MenuTheme, businessType: 'restaurant' | 'salon' | 'grocery'} | null>(null); 
    const { toast } = useToast(); 
    const [isSaving, startSave] = useTransition();
    const { setUserStore } = useAppStore();
    
    const { data: stores, isLoading: sL } = useCollection<Store>(useMemoFirebase(() => (firestore && user ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid), limit(1)) : null), [firestore, user]));
    const store = stores?.[0];
    
    const { data: menus, isLoading: mL, refetch: rM } = useCollection<Menu>(useMemoFirebase(() => (firestore && store ? query(collection(firestore, `stores/${store.id}/menus`)) : null), [firestore, store]));
    const existingMenu = menus?.[0];
    
    const handleSaveMenu = () => {
        if (!firestore || !store || !extractedData) return;
        startSave(async () => {
            const batch = writeBatch(firestore);
            
            // 1. Save Menu
            const mR = existingMenu ? doc(firestore, `stores/${store.id}/menus`, existingMenu.id) : doc(collection(firestore, `stores/${store.id}/menus`));
            const mD: Menu = { id: mR.id, storeId: store.id, items: extractedData.items.map(i => ({...i, id: i.id || createSlug(i.name), isAvailable: true })), theme: extractedData.theme };
            batch.set(mR, mD, { merge: true });

            // 2. Update Store Business Type (AI decided)
            const sR = doc(firestore, 'stores', store.id);
            const updatedStoreData = { businessType: extractedData.businessType };
            batch.update(sR, updatedStoreData);

            try { 
                await batch.commit(); 
                toast({ title: 'Menu Saved!', description: `Store updated to ${extractedData.businessType} mode.` }); 
                
                // CRITICAL: Update local Zustand state so the dashboard reflects the new vertical immediately
                setUserStore({ ...store, ...updatedStoreData });
                
                setExtractedData(null); 
                rM?.(); 
            } catch (e) { 
                toast({ variant: 'destructive', title: 'Save Failed' }); 
            }
        });
    };

    if (sL || mL) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;
    if (!store) return <div className="p-12 text-center"><p className="font-black uppercase tracking-widest text-xs opacity-40">Please create a store first.</p></div>;
    
    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="mb-12 border-b pb-10 border-black/5"><h1 className="text-5xl font-black font-headline tracking-tighter">Menu Control Center</h1><p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">STORE: {store.name}</p></div>
            {existingMenu && !extractedData ? (
                <MenuDisplay store={store} menu={existingMenu} onReplace={() => setExtractedData({ items: [], theme: existingMenu.theme || { backgroundColor: '#ffffff', primaryColor: '#000000', textColor: '#000000' }, businessType: store.businessType || 'restaurant' })} />
            ) : (
                 <div className="grid md:grid-cols-2 gap-8">
                     <MenuUploader onMenuExtracted={setExtractedData} />
                     {extractedData && (
                        <Card className="rounded-3xl border-0 shadow-xl overflow-hidden h-fit">
                            <CardHeader className="bg-primary/5 border-b border-black/5 pb-6">
                                <CardTitle className="text-xl font-black uppercase tracking-tight">Review Extraction</CardTitle>
                                <CardDescription className="text-xs font-bold opacity-40 uppercase">AI identified a <strong>{extractedData.businessType}</strong> menu</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <ScrollArea className="max-h-[50vh]"><Table><TableHeader className="bg-black/5"><TableRow><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Category</TableHead><TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Item</TableHead><TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Price</TableHead></TableRow></TableHeader><TableBody>{extractedData.items.map((i, idx) => (<TableRow key={idx}><TableCell className="text-[10px] font-bold opacity-60">{i.category}</TableCell><TableCell className="font-black text-xs">{i.name}</TableCell><TableCell className="text-right font-black text-xs">₹{i.price.toFixed(0)}</TableCell></TableRow>))}</TableBody></Table></ScrollArea>
                                <div className="p-6 bg-black/5 border-t border-black/5"><Button onClick={handleSaveMenu} disabled={isSaving || extractedData.items.length === 0} className="w-full rounded-2xl h-14 font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20">{isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{existingMenu ? 'Update Menu & Sync Vertical' : 'Create Digital Menu'}</Button><Button variant="ghost" onClick={() => setExtractedData(null)} className="w-full mt-4 text-[10px] font-black uppercase tracking-widest opacity-40">Cancel</Button></div>
                            </CardContent>
                        </Card>
                     )}
                 </div>
            )}
        </div>
    );
}
