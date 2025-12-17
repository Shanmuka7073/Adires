
'use client';

import { useState, useTransition } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Loader2, PlusCircle, Trash2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

// Define the schema for a single restaurant ingredient
const ingredientSchema = z.object({
  name: z.string().min(2, 'Ingredient name is required.'),
  unit: z.string().min(1, 'Unit (e.g., kg, litre, pc) is required.'),
  cost: z.coerce.number().positive('Cost must be a positive number.'),
});

type IngredientFormValues = z.infer<typeof ingredientSchema>;

// Define the type for the Firestore document
type RestaurantIngredient = IngredientFormValues & { id: string };

export default function RestaurantInventoryPage() {
  const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
  const router = useRouter();
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isSaving, startSaveTransition] = useTransition();

  const inventoryQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, 'restaurantIngredients')) : null),
    [firestore]
  );
  const { data: ingredients, isLoading: ingredientsLoading } = useCollection<RestaurantIngredient>(inventoryQuery);

  const form = useForm<IngredientFormValues>({
    resolver: zodResolver(ingredientSchema),
    defaultValues: { name: '', unit: 'kg', cost: 0 },
  });

  if (!isAdminLoading && !isAdmin) {
    router.replace('/dashboard');
    return <p>Redirecting...</p>;
  }

  const onSubmit = (data: IngredientFormValues) => {
    if (!firestore) return;

    startSaveTransition(async () => {
      try {
        // Use the lowercase name as the document ID for easy lookup
        const docId = data.name.toLowerCase();
        const docRef = doc(firestore, 'restaurantIngredients', docId);
        await setDoc(docRef, data, { merge: true });
        toast({ title: 'Ingredient Saved!', description: `${data.name} has been added/updated.` });
        form.reset();
      } catch (error) {
        console.error('Failed to save ingredient:', error);
        toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the ingredient.' });
      }
    });
  };

  const handleDelete = async (ingredientId: string) => {
     if (!firestore) return;
     if (!confirm('Are you sure you want to delete this ingredient?')) return;

     try {
        await deleteDoc(doc(firestore, 'restaurantIngredients', ingredientId));
        toast({ title: 'Ingredient Deleted' });
     } catch (error) {
        console.error('Failed to delete ingredient:', error);
        toast({ variant: 'destructive', title: 'Deletion Failed' });
     }
  };

  if (isAdminLoading) {
    return <div className="container mx-auto py-12">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
            <div className="flex items-center gap-3">
                <ChefHat className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-3xl font-headline">Restaurant Ingredient Catalog</CardTitle>
                    <CardDescription>
                        Manage the master list of raw ingredients and their purchase costs for your restaurant operations.
                    </CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="space-y-8">
            <Card>
                <CardHeader>
                    <CardTitle>Add New Ingredient</CardTitle>
                </CardHeader>
                <CardContent>
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="grid md:grid-cols-4 items-end gap-4">
                             <FormField control={form.control} name="name" render={({ field }) => (
                                <FormItem className="md:col-span-2">
                                    <FormLabel>Ingredient Name</FormLabel>
                                    <FormControl><Input placeholder="e.g., Basmati Rice" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="unit" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Base Unit</FormLabel>
                                    <FormControl><Input placeholder="e.g., kg, litre, pc" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="cost" render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Cost per Unit (₹)</FormLabel>
                                    <FormControl><Input type="number" step="0.01" {...field} /></FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                             <Button type="submit" disabled={isSaving} className="md:col-span-4">
                                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
                                Save Ingredient
                            </Button>
                        </form>
                    </Form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Current Ingredient Costs</CardTitle>
                </CardHeader>
                <CardContent>
                    {ingredientsLoading ? (
                        <div className="space-y-2">
                            <Skeleton className="h-10 w-full" />
                            <Skeleton className="h-10 w-full" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ingredient</TableHead>
                                    <TableHead>Base Unit</TableHead>
                                    <TableHead>Cost per Unit</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ingredients?.map(ing => (
                                    <TableRow key={ing.id}>
                                        <TableCell className="font-medium capitalize">{ing.name}</TableCell>
                                        <TableCell>{ing.unit}</TableCell>
                                        <TableCell>₹{ing.cost.toFixed(2)}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => handleDelete(ing.id)}>
                                                <Trash2 className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </CardContent>
      </Card>
    </div>
  );
}
