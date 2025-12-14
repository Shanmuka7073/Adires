
'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, limit } from 'firebase/firestore';
import type { Store, Menu, MenuItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Sparkles, Loader2, Save, QrCode, Printer, Copy, AlertTriangle, List } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAppStore } from '@/lib/store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateBreakfastPack, GenerateBreakfastPackOutput } from '@/ai/flows/generate-breakfast-pack-flow';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useCart } from '@/lib/cart';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import Image from 'next/image';
import QRCode from 'qrcode.react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';

function MenuUploader({ onMenuExtracted }: { onMenuExtracted: (items: MenuItem[]) => void }) {
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
                    onMenuExtracted(result.items);
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

function MenuDisplay({ store, menu, onReplace }: { store: Store, menu: Menu, onReplace: () => void }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const [isGenerating, startGeneration] = useTransition();
    const [generationProgress, setGenerationProgress] = useState(0);

    const handleGenerateAllIngredients = async () => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Error', description: 'Database connection not found.' });
            return;
        }
        startGeneration(async () => {
            let processedCount = 0;
            let successCount = 0;
            let failureCount = 0;
            const totalItems = menu.items.length;

            for (const item of menu.items) {
                try {
                    const cached = await getCachedRecipe(firestore, item.name, 'en');
                    if (cached) {
                        console.log(`Skipping cached item: ${item.name}`);
                        successCount++;
                    } else {
                        const recipe = await getIngredientsForDish({ dishName: item.name, language: 'en' });
                        if (recipe.isSuccess) {
                            await cacheRecipe(firestore, item.name, 'en', recipe);
                            successCount++;
                        } else {
                            failureCount++;
                        }
                    }
                } catch (error) {
                    console.error(`Failed to process ingredients for ${item.name}:`, error);
                    toast({
                        variant: 'destructive',
                        title: `Failed on: ${item.name}`,
                        description: (error as Error).message,
                        duration: 10000,
                    });
                    failureCount++;
                }
                processedCount++;
                setGenerationProgress((processedCount / totalItems) * 100);
            }
            toast({
                title: 'Bulk Generation Complete',
                description: `Successfully processed ${successCount} and failed on ${failureCount} out of ${totalItems} menu items.`,
            });
            setGenerationProgress(0); // Reset progress bar
        });
    };
    
    const tables = store.tables || [];

    return (
        <div className="grid md:grid-cols-2 gap-8">
            <Card>
                <CardHeader>
                    <CardTitle>Your Digital Menu</CardTitle>
                    <CardDescription>This is your currently active menu. You can replace it by uploading a new one.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="space-y-2">
                        <Button onClick={handleGenerateAllIngredients} disabled={isGenerating} className="w-full">
                            {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                            Generate All Ingredients
                        </Button>
                        {isGenerating && (
                            <div className="space-y-1">
                                <Progress value={generationProgress} />
                                <p className="text-xs text-center text-muted-foreground">Processing... {Math.round(generationProgress)}%</p>
                            </div>
                        )}
                    </div>
                     <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Category</TableHead>
                                <TableHead>Item Name</TableHead>
                                <TableHead className="text-right">Price</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {menu.items.map((item, index) => (
                                <TableRow key={index}>
                                    <TableCell className="font-medium">{item.category}</TableCell>
                                    <TableCell>{item.name}</TableCell>
                                    <TableCell className="text-right">₹{item.price.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                     <Button onClick={onReplace} variant="outline" className="w-full">Upload New Menu to Replace</Button>
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
    const [extractedItems, setExtractedItems] = useState<MenuItem[]>([]);
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

    const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);
    const existingMenu = menus?.[0];
    
    const handleSaveMenu = () => {
        if (!firestore || !store || extractedItems.length === 0) return;

        startSave(async () => {
            // If a menu already exists, we replace it (doc ID is known). Otherwise, create new.
            const menuRef = existingMenu ? doc(firestore, `stores/${store.id}/menus`, existingMenu.id) : doc(collection(firestore, `stores/${store.id}/menus`));
            
            const menuData: Menu = {
                id: menuRef.id,
                storeId: store.id,
                items: extractedItems,
            };

            try {
                await setDoc(menuRef, menuData, { merge: true });
                toast({ title: 'Menu Saved!', description: 'Your digital menu is now live.' });
                setExtractedItems([]); // Clear the form after saving
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

            {existingMenu && extractedItems.length === 0 ? (
                // If a menu exists and we are NOT in the middle of uploading a new one, show it.
                <MenuDisplay store={store} menu={existingMenu} onReplace={() => setExtractedItems([])} />
            ) : (
                // Show the upload/review flow if no menu exists OR if we have just extracted new items
                 <div className="grid md:grid-cols-2 gap-8">
                     <MenuUploader onMenuExtracted={setExtractedItems} />
                     {extractedItems.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle>2. Review & Save Your Menu</CardTitle>
                                <CardDescription>Review the items extracted by the AI. This will replace any existing menu.</CardDescription>
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
                                        {extractedItems.map((item, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">{item.category}</TableCell>
                                                <TableCell>{item.name}</TableCell>
                                                <TableCell className="text-right">₹{item.price.toFixed(2)}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                                <Button onClick={handleSaveMenu} disabled={isSaving || extractedItems.length === 0} className="w-full">
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
