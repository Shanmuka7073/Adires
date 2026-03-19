
'use client';

import { useState, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Beaker, Check, AlertTriangle, ShoppingCart, BookUp, PlusCircle, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getIngredientsForDish, addIngredientsToCatalog } from '@/app/actions';
import type { GetIngredientsOutput, Ingredient, RestaurantIngredient } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useRouter } from 'next/navigation';
import { RecipeCard } from '@/components/features/recipe-card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Label } from '@/components/ui/label';

// Dialog to add ingredients to the master cost catalog
function AddToCatalogDialog({
  isOpen,
  onClose,
  ingredients,
}: {
  isOpen: boolean;
  onClose: () => void;
  ingredients: Ingredient[];
}) {
  const { toast } = useToast();
  const [isSaving, startSave] = useTransition();
  const [ingredientCosts, setIngredientCosts] = useState<Record<string, { cost: string; unit: string }>>(
    ingredients.reduce((acc, ing) => {
      acc[ing.name] = { cost: '0', unit: ing.unit || 'kg' };
      return acc;
    }, {} as Record<string, { cost: string; unit: string }>)
  );

  const handleCostChange = (name: string, field: 'cost' | 'unit', value: string) => {
    setIngredientCosts(prev => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  };

  const handleSaveToCatalog = async () => {
    startSave(async () => {
      const ingredientsToSave: Omit<RestaurantIngredient, 'id'>[] = Object.entries(ingredientCosts).map(([name, data]) => ({
        name,
        unit: data.unit,
        cost: parseFloat(data.cost) || 0,
      }));

      const result = await addIngredientsToCatalog(ingredientsToSave);
      if (result.success) {
        toast({ title: 'Success!', description: `${result.count} ingredients were added/updated in your cost catalog.` });
        onClose();
      } else {
        toast({ variant: 'destructive', title: 'Save Failed', description: result.error });
      }
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl rounded-[2.5rem] border-0 shadow-2xl overflow-hidden p-0">
        <DialogHeader className="p-8 bg-primary/5 border-b border-black/5">
          <DialogTitle className="text-2xl font-black uppercase tracking-tight">Populate Cost Catalog</DialogTitle>
          <DialogDescription className="font-bold opacity-60">Set your purchase cost for these raw ingredients.</DialogDescription>
        </DialogHeader>
        <div className="p-8 max-h-[50vh] overflow-y-auto">
            <Table>
                <TableHeader className="bg-black/5">
                    <TableRow>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Ingredient</TableHead>
                        <TableHead className="text-[10px] font-black uppercase tracking-widest">Base Unit</TableHead>
                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest">Cost (₹)</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {ingredients.map(ing => (
                        <TableRow key={ing.name} className="hover:bg-muted/30">
                            <TableCell className="font-black text-xs uppercase">{ing.name}</TableCell>
                            <TableCell>
                                <Input 
                                    value={ingredientCosts[ing.name]?.unit || 'kg'}
                                    onChange={(e) => handleCostChange(ing.name, 'unit', e.target.value)}
                                    className="h-8 rounded-lg border-2 text-[10px] font-black uppercase w-20"
                                />
                            </TableCell>
                            <TableCell>
                                <Input
                                    type="number"
                                    value={ingredientCosts[ing.name]?.cost || '0'}
                                    onChange={(e) => handleCostChange(ing.name, 'cost', e.target.value)}
                                    className="h-8 rounded-lg border-2 text-right font-black text-xs w-24 ml-auto"
                                />
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
        <DialogFooter className="p-8 bg-gray-50 border-t flex gap-3">
          <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">Cancel</Button>
          <Button onClick={handleSaveToCatalog} disabled={isSaving} className="rounded-xl px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BookUp className="mr-2 h-4 w-4" />}
            Sync Costs to Analytics
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default function RecipeTesterPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isGenerating, startGeneration] = useTransition();
    const [dishName, setDishName] = useState('');
    const [result, setResult] = useState<GetIngredientsOutput | null>(null);
    const [isCatalogDialogOpen, setIsCatalogDialogOpen] = useState(false);

    const { masterProducts, productPrices } = useAppStore();
    const { addItem, clearCart } = useCart();

    const handleGetIngredients = async () => {
        if (!dishName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a name.' });
            return;
        }

        setResult(null);
        startGeneration(async () => {
            try {
                const response = await getIngredientsForDish({
                    dishName: dishName,
                    language: 'en',
                });

                if (response.isSuccess && response.ingredients.length > 0) {
                    setResult(response);
                     toast({ title: 'Specialist Found Details!' });
                } else {
                     setResult(null);
                     toast({ title: 'Not Found', variant: 'destructive' });
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'Error' });
            }
        });
    };
    
    const handleAddAllToCart = () => {
        if (!result || !result.isSuccess || result.ingredients.length === 0) return;

        clearCart();
        let itemsAdded = 0;
        
        result.ingredients.forEach(ingredient => {
            let bestMatch: { product: any, score: number } | null = null;

            masterProducts.forEach(product => {
                const similarity = calculateSimilarity(ingredient.name.toLowerCase(), product.name.toLowerCase());
                if (!bestMatch || similarity > bestMatch.score) {
                    bestMatch = { product, score: similarity };
                }
            });

            if (bestMatch && bestMatch.product && bestMatch.score > 0.7) {
                const priceData = productPrices[bestMatch.product.name.toLowerCase()];
                if (priceData && priceData.variants && priceData.variants.length > 0) {
                    const smallestVariant = [...priceData.variants].sort((a, b) => parseInt(a.weight) - parseInt(b.weight))[0];
                    addItem(bestMatch.product, smallestVariant, 1);
                    itemsAdded++;
                }
            }
        });

        toast({ title: 'Items Added to Cart' });
        router.push('/cart');
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-4xl space-y-8">
            {result?.isSuccess && (
                <AddToCatalogDialog
                    isOpen={isCatalogDialogOpen}
                    onClose={() => setIsCatalogDialogOpen(false)}
                    ingredients={result.ingredients}
                />
            )}

            <div className="flex flex-col md:flex-row justify-between items-end gap-6 border-b pb-10 border-black/5">
                <div className="space-y-1">
                    <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic">Item Specialist</h1>
                    <p className="text-muted-foreground font-black uppercase text-[10px] tracking-[0.3em] opacity-40">Composition & Cost Engineering</p>
                </div>
                <div className="flex items-center gap-4 text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-4 py-2 rounded-full border border-primary/10">
                    <Sparkles className="h-3 w-3" />
                    AI Reasoning: Online
                </div>
            </div>

            <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 border-b border-black/5 p-8">
                    <div className="flex gap-3">
                        <div className="relative flex-grow">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 opacity-30" />
                            <Input
                                placeholder="Enter any dish or service (e.g., Chicken Biryani)..."
                                value={dishName}
                                onChange={(e) => setDishName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleGetIngredients()}
                                disabled={isGenerating}
                                className="h-14 rounded-2xl border-2 pl-12 text-lg font-bold"
                            />
                        </div>
                        <Button onClick={handleGetIngredients} disabled={isGenerating} className="h-14 rounded-2xl px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                            {isGenerating ? <Loader2 className="animate-spin" /> : <Beaker className="h-5 w-5" />}
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="p-8">
                    {result ? (
                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="flex justify-between items-center">
                                <h3 className="text-3xl font-black uppercase tracking-tight">{result.title}</h3>
                                <Badge variant="outline" className="rounded-xl font-black uppercase text-[10px] tracking-widest h-8 px-4 border-2">{result.itemType}</Badge>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {result.ingredients.map((ing, i) => (
                                    <div key={i} className="p-4 rounded-2xl bg-muted/30 border-2 border-transparent flex justify-between items-center group hover:border-primary/20 transition-all">
                                        <span className="font-black text-xs uppercase tracking-tight opacity-60 group-hover:opacity-100">{ing.name}</span>
                                        <span className="font-black text-xs text-primary">{ing.quantity}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-6 border-t border-black/5">
                                <Button onClick={() => setIsCatalogDialogOpen(true)} className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                                    <BookUp className="mr-2 h-5 w-5" /> Sync to Cost Catalog
                                </Button>
                                <Button onClick={handleAddAllToCart} variant="outline" className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2">
                                    <ShoppingCart className="mr-2 h-5 w-5" /> Add to Grocery List
                                </Button>
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-20 opacity-20">
                            <Sparkles className="h-16 w-16 mx-auto mb-4" />
                            <p className="font-black uppercase tracking-widest text-xs">Enter a dish to begin analysis</p>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
