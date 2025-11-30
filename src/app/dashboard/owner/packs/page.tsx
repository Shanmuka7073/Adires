
'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, doc, deleteDoc, limit, setDoc } from 'firebase/firestore';
import type { Store, MonthlyPackage, ProductPrice, DayPlan } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Sparkles, Loader2, Save, ChevronDown } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useAppStore } from '@/lib/store';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateBreakfastPack, GenerateBreakfastPackOutput } from '@/ai/flows/generate-breakfast-pack-flow';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

const ADMIN_EMAIL = 'admin@gmail.com';

function AIPackGenerator({ storeId }: { storeId: string }) {
    const { toast } = useToast();
    const { productPrices, fetchProductPrices, masterProducts } = useAppStore();
    const [duration, setDuration] = useState('7days');
    const [familySize, setFamilySize] = useState(2);
    const [sidePreference, setSidePreference] = useState('');
    const [isGenerating, startGeneration] = useTransition();
    const [generatedPack, setGeneratedPack] = useState<GenerateBreakfastPackOutput | null>(null);
    const [isSaving, startSave] = useTransition();
    const { firestore } = useFirebase();

    useEffect(() => {
        if (firestore && masterProducts.length > 0) {
            fetchProductPrices(firestore, masterProducts.map(p => p.name));
        }
    }, [firestore, masterProducts, fetchProductPrices]);

    const handleGenerate = () => {
        startGeneration(async () => {
            setGeneratedPack(null);
            const prices = Object.entries(productPrices)
                .filter(([, data]) => data?.variants?.[0]?.price)
                .reduce((acc, [name, data]) => {
                    acc[name] = data!.variants[0].price;
                    return acc;
                }, {} as Record<string, number>);

            try {
                const result = await generateBreakfastPack({
                    duration,
                    familySize,
                    sideItemPreference: sidePreference,
                    productPrices: prices,
                });
                setGeneratedPack(result);
                toast({ title: "Breakfast Pack Generated!", description: "Review the generated pack below." });
            } catch (error) {
                console.error("AI Pack Generation failed:", error);
                toast({ variant: "destructive", title: "Generation Failed", description: "The AI could not generate a pack. Please try again." });
            }
        });
    };
    
    const handleSavePack = () => {
        if (!generatedPack || !firestore || !storeId) return;

        startSave(async () => {
            const newPack: Omit<MonthlyPackage, 'id'> = {
                storeId: storeId,
                name: generatedPack.packName,
                memberCount: familySize,
                price: generatedPack.estimatedCost,
                items: generatedPack.shoppingList.map(item => ({ name: item.itemName, quantity: item.quantity })),
                schedule: generatedPack.schedule,
            };

            try {
                const newDocRef = doc(collection(firestore, `stores/${storeId}/packages`));
                await setDoc(newDocRef, { ...newPack, id: newDocRef.id });
                toast({ title: "Pack Saved!", description: `"${newPack.name}" has been added to your store.` });
                setGeneratedPack(null);
            } catch (error) {
                 console.error("Failed to save pack:", error);
                 const permissionError = new FirestorePermissionError({
                    path: `stores/${storeId}/packages`,
                    operation: 'create',
                    requestResourceData: newPack,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ variant: "destructive", title: "Save Failed", description: "Could not save the generated pack." });
            }
        });
    };

    return (
        <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-6 w-6 text-primary" />
                    AI Breakfast Pack Generator
                </CardTitle>
                <CardDescription>
                    Automatically generate a weekly, 15-day, or monthly breakfast plan for your customers.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="duration">Plan Duration</Label>
                        <Select value={duration} onValueChange={setDuration}>
                            <SelectTrigger id="duration"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7days">7 Days</SelectItem>
                                <SelectItem value="15days">15 Days</SelectItem>
                                <SelectItem value="monthly">Monthly (30 Days)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="familySize">Family Size</Label>
                        <Input id="familySize" type="number" min="1" value={familySize} onChange={e => setFamilySize(Number(e.target.value))} />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="sidePreference">Side Item Preference (Optional)</Label>
                        <Input id="sidePreference" placeholder="e.g., Peanut Chutney" value={sidePreference} onChange={e => setSidePreference(e.target.value)} />
                    </div>
                </div>
                <Button onClick={handleGenerate} disabled={isGenerating} className="w-full">
                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Generate Pack with AI
                </Button>

                {generatedPack && (
                    <div className="border-t pt-6 space-y-6">
                        <h3 className="text-xl font-bold">{generatedPack.packName}</h3>
                        <div className="grid md:grid-cols-2 gap-6">
                             <Card>
                                <CardHeader><CardTitle>Meal Schedule</CardTitle></CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Main</TableHead><TableHead>Side</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {generatedPack.schedule.map(day => (
                                                <TableRow key={day.day}>
                                                    <TableCell>{day.day}</TableCell>
                                                    <TableCell>{day.mainItem}</TableCell>
                                                    <TableCell>{day.sideItem}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                             <Card>
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <CardTitle>Shopping List & Cost</CardTitle>
                                        <Badge variant="secondary" className="text-lg">₹{generatedPack.estimatedCost.toFixed(2)}</Badge>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                     <div className="flex flex-wrap gap-2">
                                        {generatedPack.shoppingList.map(item => (
                                            <Badge key={item.itemName} variant="outline">{item.itemName} ({item.quantity})</Badge>
                                        ))}
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                        <Button onClick={handleSavePack} disabled={isSaving} className="w-full">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                            Save This Pack
                        </Button>
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
                    <Accordion type="multiple" className="w-full">
                        {packages.map(pack => (
                             <AccordionItem value={pack.id} key={pack.id}>
                                <AccordionTrigger className="text-left hover:no-underline">
                                    <div className="flex justify-between items-center w-full">
                                        <div>
                                            <h4 className="font-bold">{pack.name}</h4>
                                            <p className="text-sm text-muted-foreground">{pack.items.length} items for {pack.memberCount} people</p>
                                            <p className="font-bold text-primary">₹{typeof pack.price === 'number' ? pack.price.toFixed(2) : '0.00'}</p>
                                        </div>
                                         <AlertDialog>
                                            <AlertDialogTrigger asChild>
                                                <Button variant="ghost" size="icon" className="mr-2" onClick={(e) => e.stopPropagation()} disabled={isDeleting}><Trash2 className="h-4 w-4 text-destructive" /></Button>
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
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="p-4 bg-muted/50 rounded-lg grid md:grid-cols-2 gap-6">
                                        <div>
                                            <h5 className="font-semibold mb-2">Shopping List:</h5>
                                            <div className="flex flex-wrap gap-2">
                                                {pack.items.map((item, index) => (
                                                    <Badge key={index} variant="secondary">{item.name} ({item.quantity})</Badge>
                                                ))}
                                            </div>
                                        </div>
                                        {pack.schedule && (
                                            <div>
                                                <h5 className="font-semibold mb-2">Meal Schedule:</h5>
                                                <Table>
                                                    <TableHeader><TableRow><TableHead>Day</TableHead><TableHead>Main</TableHead><TableHead>Side</TableHead></TableRow></TableHeader>
                                                    <TableBody>
                                                        {pack.schedule.map(day => (
                                                            <TableRow key={day.day}>
                                                                <TableCell>{day.day}</TableCell>
                                                                <TableCell>{day.mainItem}</TableCell>
                                                                <TableCell>{day.sideItem}</TableCell>
                                                            </TableRow>
                                                        ))}
                                                    </TableBody>
                                                </Table>
                                            </div>
                                        )}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                ) : (
                    <p className="text-center text-muted-foreground py-8">You haven't created any packs yet.</p>
                )}
            </CardContent>
        </Card>
    );
}


export default function ManagePacksPage() {
    const { user, firestore } = useFirebase();

    const storeQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        if (user.email === ADMIN_EMAIL) {
            return query(collection(firestore, 'stores'), where('name', '==', 'LocalBasket'), limit(1));
        }
        return query(collection(firestore, 'stores'), where('ownerId', '==', user.uid), limit(1));
    }, [firestore, user]);

    const { data: stores, isLoading: storeLoading } = useCollection<Store>(storeQuery);

    const store = useMemo(() => stores?.[0], [stores]);

    if (storeLoading) {
        return <div className="container mx-auto py-12 px-4 md:px-6">Loading store information...</div>;
    }

    if (!store) {
        return <div className="container mx-auto py-12 px-4 md:px-6">Could not find a store. Please create one first.</div>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-8">
            <div className="text-center">
                <h1 className="text-4xl font-bold font-headline">Manage Grocery Packs</h1>
                <p className="text-lg text-muted-foreground mt-2">Create and manage packs for your store: {store.name}</p>
            </div>
            <AIPackGenerator storeId={store.id} />
            <ExistingPacks storeId={store.id} />
        </div>
    );
}
