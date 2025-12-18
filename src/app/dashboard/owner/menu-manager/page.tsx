
'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, limit } from 'firebase/firestore';
import type { Store, Menu, MenuItem, MenuTheme } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Sparkles, Loader2, Save, QrCode, Printer, Copy, AlertTriangle, List, PlusCircle, Edit } from 'lucide-react';
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


// Schema for a single menu item
const menuItemSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Item name is required."),
  description: z.string().optional(),
  price: z.coerce.number().min(0, "Price must be a positive number."),
  category: z.string().min(2, "Category is required."),
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
  onSave: (item: MenuItem, isNew: boolean) => void;
  existingItem?: MenuItem | null;
  onDeleteItem?: (itemToDelete: MenuItem) => void;
}) {
  const form = useForm<MenuItemFormValues>({
    resolver: zodResolver(menuItemSchema),
    defaultValues: existingItem || { name: '', price: 0, category: '', description: '' },
  });

  useEffect(() => {
    form.reset(existingItem || { name: '', price: 0, category: '', description: '' });
  }, [existingItem, form]);

  const handleSubmit = (data: MenuItemFormValues) => {
    onSave(data as MenuItem, !existingItem);
    onOpenChange(false);
  };
  
  const handleDelete = () => {
    if (existingItem && onDeleteItem) {
        onDeleteItem(existingItem);
        onOpenChange(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existingItem ? 'Edit Menu Item' : 'Add New Item'}</DialogTitle>
          <DialogDescription>
            {existingItem ? `Update details for ${existingItem.name}.` : 'Add a new item to your menu.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
            <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                 <FormField control={form.control} name="name" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Item Name</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g., Chicken Biryani" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="category" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Category</FormLabel>
                        <FormControl><Input {...field} placeholder="e.g., Main Course" /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                 <FormField control={form.control} name="price" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Price (₹)</FormLabel>
                        <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <FormField control={form.control} name="description" render={({ field }) => (
                    <FormItem>
                        <FormLabel>Description (Optional)</FormLabel>
                        <FormControl><Textarea {...field} placeholder="A short description of the dish." /></FormControl>
                        <FormMessage />
                    </FormItem>
                )} />
                <DialogFooter className="pt-4">
                   {existingItem && onDeleteItem && (
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                             <Button type="button" variant="destructive" className="mr-auto">Delete Item</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>This will permanently remove "{existingItem.name}" from your menu.</AlertDialogDescription>
                            </AlertDialogHeader>
                             <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                   )}
                    <DialogClose asChild><Button type="button" variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit">Save Item</Button>
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
            reader.onload = (event) => {
                setMenuImage(event.target?.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleExtract = () => {
        if (!menuImage) {
            toast({ variant: 'destructive', title: 'Please select an image first.' });
            return;
        }

        startProcessing(async () => {
            try {
                const result = await extractMenuItems({ menuImage });
                if (result.items && result.items.length > 0) {
                    onMenuExtracted({ items: result.items, theme: result.theme });
                    toast({ title: 'Menu Extracted!', description: `Found ${result.items.length} items. Please review and save.` });
                } else {
                    toast({ variant: 'destructive', title: 'No Items Found', description: 'The AI could not find any menu items in the image.' });
                }
            } catch (error) {
                console.error("Menu extraction failed:", error);
                toast({ variant: 'destructive', title: 'Extraction Failed', description: 'An error occurred while analyzing the menu.' });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>1. Create Your Menu</CardTitle>
                <CardDescription>Upload a clear picture of your restaurant menu. The AI will read it and extract the items.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="w-full aspect-video relative rounded-md overflow-hidden border bg-muted flex items-center justify-center">
                    {menuImage ? (
                        <Image src={menuImage} alt="Menu preview" fill className="object-contain" />
                    ) : (
                        <p className="text-muted-foreground">Image preview</p>
                    )}
                </div>
                <Input type="file" accept="image/*" onChange={handleFileChange} disabled={isProcessing} />
                <Button onClick={handleExtract} disabled={!menuImage || isProcessing} className="w-full">
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    {isProcessing ? 'Analyzing Menu...' : 'Extract Menu Items with AI'}
                </Button>
            </CardContent>
        </Card>
    );
}

function QRCodeDialog({ table, storeId }: { table: string, storeId: string }) {
    const [menuUrl, setMenuUrl] = useState('');
    const { toast } = useToast();

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const url = `${window.location.origin}/menu/${storeId}?table=${encodeURIComponent(table)}`;
            setMenuUrl(url);
        }
    }, [storeId, table]);
    
    const handlePrint = () => {
        const qrCodeElement = document.getElementById(`qr-code-container-${table}`);
        if (qrCodeElement) {
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow?.document.write('<html><head><title>Print QR Code for ' + table + '</title>');
            printWindow?.document.write('<style>body { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; text-align: center; } h1 { font-family: sans-serif; } .qr-container { position: relative; display: inline-block; } .qr-text { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); background: white; padding: 4px 8px; border-radius: 4px; font-size: 24px; font-weight: bold; font-family: sans-serif; border: 2px solid black; } </style>');
            printWindow?.document.write('</head><body>');
            printWindow?.document.write(`<h1>Scan for ${table}</h1>`);
            printWindow?.document.write(qrCodeElement.innerHTML);
            printWindow?.document.write('</body></html>');
            printWindow?.document.close();
            printWindow?.focus();
            printWindow?.print();
        }
    };
    
    const handleCopyLink = () => {
        navigator.clipboard.writeText(menuUrl).then(() => {
            toast({ title: "Link Copied!", description: "The menu URL has been copied to your clipboard." });
        }).catch(() => {
            toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy the link." });
        });
    };

    return (
        <DialogContent>
            <DialogHeader>
                <DialogTitle>QR Code for {table}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4">
                 <div id={`qr-code-container-${table}`} className="p-4 bg-white rounded-lg border relative">
                    {menuUrl ? (
                        <>
                            <QRCode value={menuUrl} size={256} />
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-3 py-1 rounded border-2 border-black">
                                <span className="text-3xl font-extrabold text-black">{table}</span>
                            </div>
                        </>
                    ) : <div className="w-[256px] h-[256px] bg-gray-200 animate-pulse" />}
                </div>
                <p className="text-xs text-muted-foreground break-all">{menuUrl || 'Generating URL...'}</p>
                <div className="grid grid-cols-2 gap-2 w-full">
                    <Button onClick={handleCopyLink} variant="outline" disabled={!menuUrl}><Copy className="mr-2 h-4 w-4" /> Copy Link</Button>
                    <Button onClick={handlePrint} className="w-full" disabled={!menuUrl}>
                        <Printer className="mr-2 h-4 w-4" /> Print QR Code
                    </Button>
                </div>
            </div>
        </DialogContent>
    )
}

function MenuDisplay({ store, menu: initialMenu, onReplace }: { store: Store, menu: Menu, onReplace: () => void }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [isGenerating, startGeneration] = useTransition();
    const [isSaving, startSave] = useTransition();
    const [menu, setMenu] = useState(initialMenu);
    
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
    const [cachedStatus, setCachedStatus] = useState<Record<string, boolean>>({});
    const [checkingCache, setCheckingCache] = useState(true);

    // Update local state if the initialMenu from props changes
    useEffect(() => {
        setMenu(initialMenu);
    }, [initialMenu]);

     // Check cache status for all items on load and when menu changes
    useEffect(() => {
        const checkAllItemsCache = async () => {
            if (!firestore || !menu?.items) {
                setCheckingCache(false);
                return;
            }
            setCheckingCache(true);
            const status: Record<string, boolean> = {};
            // This now needs to call a server action
            // For now, we'll assume nothing is cached.
            menu.items.forEach(item => status[item.id] = false);
            setCachedStatus(status);
            setCheckingCache(false);
        };
        checkAllItemsCache();
    }, [firestore, menu]);

    const handleEditItem = (item: MenuItem) => {
        setEditingItem(item);
        setIsEditDialogOpen(true);
    }
    
    const handleAddNewItem = () => {
        setEditingItem(null);
        setIsEditDialogOpen(true);
    }

    const handleSaveItem = (itemData: MenuItem, isNew: boolean) => {
        let updatedItems;
        if (isNew) {
            const maxId = Math.max(0, ...menu.items.map(i => parseInt((i.id || '0').split('-')[1] || '0')));
            const newItem = { ...itemData, id: `temp-${maxId + 1}` };
            updatedItems = [...menu.items, newItem];
        } else {
            updatedItems = menu.items.map(item => item.id === editingItem?.id ? { ...item, ...itemData } : item);
        }
        const updatedMenu = { ...menu, items: updatedItems };
        setMenu(updatedMenu);
    };

    const handleDeleteItem = (itemToDelete: MenuItem) => {
         const updatedItems = menu.items.filter(item => item.id !== itemToDelete.id);
         const updatedMenu = { ...menu, items: updatedItems };
         setMenu(updatedMenu);
    }

    const handleSaveMenu = async () => {
        if (!firestore || !store) return;
        startSave(async () => {
            const menuRef = doc(firestore, `stores/${store.id}/menus`, menu.id);
            try {
                await setDoc(menuRef, { ...menu }, { merge: true });
                toast({ title: "Menu Saved!", description: "Your changes have been saved." });
            } catch (error) {
                 toast({ variant: 'destructive', title: "Save Failed", description: "Could not save menu changes." });
                 console.error("Menu save failed:", error);
            }
        });
    }

    const handleGenerateIngredients = async (item: MenuItem) => {
        startGeneration(async () => {
            try {
                const result = await getIngredientsForDish({ dishName: item.name, language: 'en' });
                if (result.success) {
                    toast({ title: 'Ingredients Generated!', description: `Successfully created and cached recipe for ${item.name}.` });
                    setCachedStatus(prev => ({ ...prev, [item.id]: true }));
                } else {
                    throw new Error("AI failed to generate a recipe.");
                }
            } catch (error) {
                console.error(`Failed to process ingredients for ${item.name}:`, error);
                toast({
                    variant: 'destructive',
                    title: `Failed for: ${item.name}`,
                    description: (error as Error).message,
                });
            }
        });
    };
    
    const tables = store.tables || [];

    return (
        <div className="grid md:grid-cols-2 gap-8">
            {isEditDialogOpen && (
                 <EditMenuDialog 
                    isOpen={isEditDialogOpen}
                    onOpenChange={setIsEditDialogOpen}
                    onSave={handleSaveItem}
                    existingItem={editingItem}
                    onDeleteItem={handleDeleteItem}
                 />
            )}
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle>Your Digital Menu</CardTitle>
                         <Button onClick={handleSaveMenu} disabled={isSaving}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save All Changes
                        </Button>
                    </div>
                    <CardDescription>This is your currently active menu. You can add, edit, or remove items below.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={handleAddNewItem} variant="outline" className="w-full">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add New Menu Item
                    </Button>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Item Name</TableHead>
                                <TableHead>Ingredients</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {menu.items.map((item, index) => (
                                <TableRow key={item.id || index}>
                                    <TableCell className="font-medium">{item.category}</TableCell>
                                    <TableCell>{item.name} <span className="text-muted-foreground">(₹{item.price.toFixed(2)})</span></TableCell>
                                    <TableCell>
                                        {checkingCache ? (
                                            <Skeleton className="h-6 w-20" />
                                        ) : cachedStatus[item.id] ? (
                                            <Badge variant="default" className="bg-green-100 text-green-800">Cached</Badge>
                                        ) : (
                                            <Button size="sm" variant="secondary" onClick={() => handleGenerateIngredients(item)} disabled={isGenerating}>
                                                {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate'}
                                            </Button>
                                        )}
                                    </TableCell>
                                     <TableCell className="text-right">
                                        <Button variant="ghost" size="icon" onClick={() => handleEditItem(item)}>
                                            <Edit className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                     <Button onClick={onReplace} variant="destructive" className="w-full mt-4">Upload New Menu to Replace</Button>
                </CardContent>
            </Card>
             <Card>
                <CardHeader>
                    <CardTitle>Your Table QR Codes</CardTitle>
                    <CardDescription>Generate a unique QR code for each table in your restaurant.</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center gap-4">
                    <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Developer Note</AlertTitle>
                        <AlertDescription>
                            This QR code will only work on a publicly deployed version of the app, not in the local development environment.
                        </AlertDescription>
                    </Alert>
                    
                    {tables.length > 0 ? (
                        <div className="w-full space-y-2">
                            {tables.map(table => (
                                <Dialog key={table}>
                                    <DialogTrigger asChild>
                                        <Button variant="secondary" className="w-full justify-between">
                                            <span>{table}</span>
                                            <QrCode className="h-4 w-4" />
                                        </Button>
                                    </DialogTrigger>
                                    <QRCodeDialog table={table} storeId={store.id} />
                                </Dialog>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-center py-4">You haven't added any tables yet. Go to "My Store" to add them.</p>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}


export default function MenuManagerPage() {
    const { user, firestore } = useFirebase();
    const [extractedData, setExtractedData] = useState<{items: MenuItem[], theme: MenuTheme} | null>(null);
    const { toast } = useToast();
    const [isSaving, startSave] = useTransition();

    const storeQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'stores'), where('ownerId', '==', user.uid), limit(1));
    }, [firestore, user]);

    const { data: stores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
    const store = stores?.[0];

    const menuQuery = useMemoFirebase(() => {
        if (!firestore || !store) return null;
        return query(collection(firestore, `stores/${store.id}/menus`));
    }, [firestore, store]);

    const { data: menus, isLoading: menuLoading, refetch: refetchMenu } = useCollection<Menu>(menuQuery);
    const existingMenu = menus?.[0];
    
    const handleSaveMenu = () => {
        if (!firestore || !store || !extractedData) return;

        startSave(async () => {
            const menuRef = existingMenu ? doc(firestore, `stores/${store.id}/menus`, existingMenu.id) : doc(collection(firestore, `stores/${store.id}/menus`));
            
            const menuData: Menu = {
                id: menuRef.id,
                storeId: store.id,
                items: extractedData.items.map((item, index) => ({...item, id: item.id || `item-${Date.now()}-${index}` })),
                theme: extractedData.theme,
            };

            try {
                await setDoc(menuRef, menuData, { merge: true });
                toast({ title: 'Menu Saved!', description: 'Your digital menu is now live.' });
                setExtractedData(null); // Clear the form after saving
                if(refetchMenu) refetchMenu();
            } catch (error) {
                console.error("Failed to save menu:", error);
                toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the menu to the database.' });
            }
        });
    };

    if (storeLoading || menuLoading) {
        return <div className="container mx-auto py-12">Loading your store details...</div>;
    }

    if (!store) {
        return <div className="container mx-auto py-12">Please create a store first to manage a menu.</div>;
    }
    
    // Main Render Logic
    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">QR Code Menu Generator</h1>
                <p className="text-lg text-muted-foreground mt-2">Manage the digital menu for your restaurant: {store.name}</p>
            </div>

            {existingMenu && !extractedData ? (
                <MenuDisplay store={store} menu={existingMenu} onReplace={() => { /* This functionality needs to be reconsidered */ }} />
            ) : (
                 <div className="grid md:grid-cols-2 gap-8">
                     <MenuUploader onMenuExtracted={setExtractedData} />
                     {extractedData && (
                        <Card>
                            <CardHeader>
                                <CardTitle>2. Review & Save Your Menu</CardTitle>
                                <CardDescription>Review the items extracted by the AI. This will {existingMenu ? 'replace' : 'create'} your menu.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Item Name</TableHead>
                                            <TableHead className="text-right">Price</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {extractedData.items.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">{item.category}</TableCell>
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell className="text-right">₹{item.price.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <Button onClick={handleSaveMenu} disabled={isSaving || extractedData.items.length === 0} className="w-full">
                                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                    {existingMenu ? 'Save & Replace Menu' : 'Save Menu'}
                                </Button>
                            </CardContent>
                        </Card>
                     )}
                 </div>
            )}
        </div>
    );
}
