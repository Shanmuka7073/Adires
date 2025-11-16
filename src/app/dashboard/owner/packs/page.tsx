
'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, addDoc, doc, deleteDoc, limit } from 'firebase/firestore';
import type { Store, MonthlyPackage } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const ADMIN_EMAIL = 'admin@gmail.com';


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
            <ExistingPacks storeId={store.id} />
        </div>
    );
}
