
'use client';

import { useState, useTransition, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, doc, deleteDoc } from 'firebase/firestore';
import type { Store, MonthlyPackage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { generatePack } from '@/app/actions';
import { Loader2, Sparkles, PlusCircle, Trash2 } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const ADMIN_EMAIL = 'admin@gmail.com';

function PackGenerator({ storeId }: { storeId: string }) {
    const { toast } = useToast();
    const [isGenerating, startGeneration] = useTransition();
    const [familySize, setFamilySize] = useState(2);
    const [duration, setDuration] = useState<'weekly' | 'monthly' | '3-day'>('weekly');
    const [generatedItems, setGeneratedItems] = useState<{ name: string; quantity: string }[] | null>(null);
    const { firestore } = useFirebase();

    const handleGenerate = () => {
        startGeneration(async () => {
            try {
                const result = await generatePack({ packType: duration, familySize });
                setGeneratedItems(result.items);
                toast({ title: "Pack Generated!", description: "Review the items below and save the pack." });
            } catch (error) {
                console.error(error);
                toast({ variant: 'destructive', title: "Generation Failed", description: (error as Error).message });
            }
        });
    };

    const handleSavePack = async () => {
        if (!firestore || !generatedItems || !storeId) return;

        const packName = `${duration.charAt(0).toUpperCase() + duration.slice(1)} Pack for ${familySize}`;
        const newPack: Omit<MonthlyPackage, 'id' | 'price'> = {
            storeId,
            name: packName,
            memberCount: familySize,
            items: generatedItems,
        };

        try {
            const packCollectionRef = collection(firestore, `stores/${storeId}/packages`);
            await addDoc(packCollectionRef, newPack);
            toast({ title: "Pack Saved!", description: `${packName} has been added to your store.` });
            setGeneratedItems(null);
        } catch (error) {
            console.error("Failed to save pack:", error);
            const permissionError = new FirestorePermissionError({
                path: `stores/${storeId}/packages`,
                operation: 'create',
                requestResourceData: newPack,
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> AI Grocery Pack Generator</CardTitle>
                <CardDescription>Create pre-defined grocery packs for your customers using AI.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid sm:grid-cols-3 gap-4">
                    <div>
                        <label className="text-sm font-medium">Family Size</label>
                        <Input type="number" min="1" value={familySize} onChange={(e) => setFamilySize(parseInt(e.target.value) || 1)} />
                    </div>
                    <div>
                        <label className="text-sm font-medium">Duration</label>
                        <Select value={duration} onValueChange={(value: any) => setDuration(value)}>
                            <SelectTrigger><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="3-day">3-Day (Vegetables)</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={handleGenerate} disabled={isGenerating} className="self-end">
                        {isGenerating ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</> : 'Generate Pack'}
                    </Button>
                </div>

                {generatedItems && (
                    <div className="border-t pt-4 space-y-4">
                        <h3 className="font-semibold">Generated Items for a {duration} pack for {familySize}:</h3>
                        <div className="max-h-60 overflow-y-auto rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Item Name</TableHead>
                                        <TableHead>Quantity</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {generatedItems.map((item, index) => (
                                        <TableRow key={index}>
                                            <TableCell>{item.name}</TableCell>
                                            <TableCell>{item.quantity}</TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="flex gap-2">
                             <Button onClick={handleSavePack} className="w-full"><PlusCircle className="mr-2 h-4 w-4" /> Save This Pack</Button>
                             <Button variant="outline" onClick={() => setGeneratedItems(null)}>Clear</Button>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

function ExistingPacks({ storeId }: { storeId: string }) {
    const { firestore } = useFirebase();
    const [isDeleting, startDelete] = useTransition();
    const { toast } = useToast();

    const packagesQuery = useMemoFirebase(() => {
        if (!firestore || !storeId) return null;
        return query(collection(firestore, `stores/${storeId}/packages`));
    }, [firestore, storeId]);

    const { data: packages, isLoading } = useCollection<MonthlyPackage>(packagesQuery);
    
    const handleDelete = (packId: string) => {
        startDelete(async () => {
             if (!firestore || !storeId) return;
             try {
                await deleteDoc(doc(firestore, `stores/${storeId}/packages`, packId));
                toast({ title: "Pack Deleted", description: "The grocery pack has been removed."});
             } catch (error) {
                console.error("Failed to delete pack:", error);
                toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not remove the pack." });
             }
        });
    }

    if (isLoading) {
        return <p>Loading existing packs...</p>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>Your Saved Packs</CardTitle>
                <CardDescription>These are the packs currently available for your store.</CardDescription>
            </CardHeader>
            <CardContent>
                {packages && packages.length > 0 ? (
                    <div className="space-y-4">
                        {packages.map(pack => (
                             <Card key={pack.id} className="p-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h4 className="font-bold">{pack.name}</h4>
                                        <p className="text-sm text-muted-foreground">{pack.items.length} items</p>
                                    </div>
                                     <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button variant="ghost" size="icon" disabled={isDeleting}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                                <AlertDialogDescription>This will permanently delete the "{pack.name}". This action cannot be undone.</AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                                <AlertDialogAction onClick={() => handleDelete(pack.id)} className="bg-destructive hover:bg-destructive/90">Delete</AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                                <div className="mt-2 text-xs text-muted-foreground">
                                    {pack.items.map(i => i.name).slice(0, 5).join(', ')}{pack.items.length > 5 ? '...' : ''}
                                </div>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <p className="text-center text-muted-foreground py-8">You haven't created any packs yet.</p>
                )}
            </CardContent>
        </Card>
    );
}


export default function ManagePacksPage() {
    const { user, firestore } = useFirebase();

    // The admin manages packs in the master "LocalBasket" store
    const storeNameForQuery = user?.email === ADMIN_EMAIL ? 'LocalBasket' : '';

    const storeQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        if (user.email === ADMIN_EMAIL) {
            return query(collection(firestore, 'stores'), where('name', '==', 'LocalBasket'), limit(1));
        }
        return query(collection(firestore, 'stores'), where('ownerId', '==', user.uid), limit(1));
    }, [firestore, user]);

    const { data: stores, isLoading } = useCollection<Store>(storeQuery);

    const store = useMemo(() => stores?.[0], [stores]);

    if (isLoading) {
        return <div className="container mx-auto py-12 px-4 md:px-6">Loading store information...</div>;
    }

    if (!store) {
        return <div className="container mx-auto py-12 px-4 md:px-6">Could not find a store. Please create one first.</div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-8">
            <div className="text-center">
                <h1 className="text-4xl font-bold font-headline">Manage Grocery Packs</h1>
                <p className="text-lg text-muted-foreground mt-2">Create and manage AI-generated packs for your store: {store.name}</p>
            </div>
            <PackGenerator storeId={store.id} />
            <ExistingPacks storeId={store.id} />
        </div>
    );
}
