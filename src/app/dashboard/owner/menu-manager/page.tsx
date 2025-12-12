
'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, setDoc, limit } from 'firebase/firestore';
import type { Store, Menu, MenuItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Upload, Sparkles, QrCode, Printer, Save, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import Image from 'next/image';
import { extractMenuItems } from '@/ai/flows/extract-menu-items-flow';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import QRCode from 'qrcode.react';

function MenuUploader({ onMenuExtracted }: { onMenuExtracted: (items: MenuItem[]) => void }) {
    const { toast } = useToast();
    const [isProcessing, startProcessing] = useTransition();
    const [menuImage, setMenuImage] = useState<string | null>(null);
    const [file, setFile] = useState<File | null>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setFile(file);
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
                <CardTitle>1. Upload Your Menu</CardTitle>
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

function MenuReviewer({ storeId, items, onSaveSuccess }: { storeId: string, items: MenuItem[], onSaveSuccess: (menuId: string) => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, startSave] = useTransition();

    const handleSaveMenu = () => {
        if (!firestore || !storeId) return;

        startSave(async () => {
            const newMenuRef = doc(collection(firestore, `stores/${storeId}/menus`));
            const menuData: Menu = {
                id: newMenuRef.id,
                storeId,
                items,
            };

            try {
                await setDoc(newMenuRef, menuData);
                toast({ title: 'Menu Saved!', description: 'Your new digital menu is now live.' });
                onSaveSuccess(newMenuRef.id);
            } catch (error) {
                console.error("Failed to save menu:", error);
                toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the menu to the database.' });
            }
        });
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>2. Review & Save Your Menu</CardTitle>
                <CardDescription>Review the items extracted by the AI. You can edit them later if needed.</CardDescription>
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
                        {items.map((item, index) => (
                            <TableRow key={index}>
                                <TableCell className="font-medium">{item.category}</TableCell>
                                <TableCell>{item.name}</TableCell>
                                <TableCell className="text-right">₹{item.price.toFixed(2)}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
                <Button onClick={handleSaveMenu} disabled={isSaving || items.length === 0} className="w-full">
                    {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Menu
                </Button>
            </CardContent>
        </Card>
    );
}

function QrCodeDisplay({ storeId }: { storeId: string }) {
    const { toast } = useToast();
    const menuUrl = `${window.location.origin}/menu/${storeId}`;

    const handlePrint = () => {
        const qrCodeElement = document.getElementById('qr-code-to-print');
        if (qrCodeElement) {
            const printWindow = window.open('', '', 'height=600,width=800');
            printWindow?.document.write('<html><head><title>Print QR Code</title>');
            printWindow?.document.write('<style>body { text-align: center; margin-top: 50px; } h1 { font-family: sans-serif; } </style>');
            printWindow?.document.write('</head><body>');
            printWindow?.document.write('<h1>Scan to view our menu!</h1>');
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
        }).catch(err => {
            toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy the link." });
        });
    };
    
    const handleCopyQRCode = () => {
        const canvas = document.querySelector('#qr-code-to-print canvas') as HTMLCanvasElement;
        if (canvas) {
            canvas.toBlob((blob) => {
                if(blob) {
                    navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]).then(() => {
                        toast({ title: "QR Code Copied!", description: "The QR code image has been copied to your clipboard." });
                    }).catch(err => {
                        toast({ variant: "destructive", title: "Copy Failed", description: "Could not copy the QR code image." });
                    });
                }
            });
        }
    };


    return (
        <Card>
            <CardHeader>
                <CardTitle>3. Your QR Code</CardTitle>
                <CardDescription>Your menu is ready! Print this QR code and place it on your tables.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center gap-4">
                <div id="qr-code-to-print" className="p-4 bg-white rounded-lg border">
                    <QRCode value={menuUrl} size={256} />
                </div>
                <p className="text-xs text-muted-foreground break-all">{menuUrl}</p>
                <div className="grid grid-cols-2 gap-2 w-full">
                    <Button onClick={handleCopyLink} variant="outline"><Copy className="mr-2 h-4 w-4" /> Copy Link</Button>
                    <Button onClick={handleCopyQRCode} variant="outline"><Copy className="mr-2 h-4 w-4" /> Copy QR</Button>
                </div>
                <Button onClick={handlePrint} className="w-full">
                    <Printer className="mr-2 h-4 w-4" /> Print QR Code
                </Button>
            </CardContent>
        </Card>
    );
}

export default function MenuManagerPage() {
    const { user, firestore } = useFirebase();
    const [extractedItems, setExtractedItems] = useState<MenuItem[]>([]);
    const [savedMenuId, setSavedMenuId] = useState<string | null>(null);

    const storeQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(collection(firestore, 'stores'), where('ownerId', '==', user.uid), limit(1));
    }, [firestore, user]);

    const { data: stores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
    const store = stores?.[0];

    if (storeLoading) {
        return <div className="container mx-auto py-12">Loading your store details...</div>;
    }

    if (!store) {
        return <div className="container mx-auto py-12">Please create a store first to manage a menu.</div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">QR Code Menu Generator</h1>
                <p className="text-lg text-muted-foreground mt-2">Create a digital menu for your restaurant in 3 simple steps.</p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <MenuUploader onMenuExtracted={setExtractedItems} />
                
                {extractedItems.length > 0 && (
                    <MenuReviewer storeId={store.id} items={extractedItems} onSaveSuccess={setSavedMenuId} />
                )}

                {savedMenuId && (
                    <QrCodeDisplay storeId={store.id} />
                )}
            </div>
        </div>
    );
}
