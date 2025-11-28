
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Loader2, Sparkles, ShoppingCart, AlertCircle, Search } from 'lucide-react';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';
import { useAppStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { Badge } from '../ui/badge';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';

export function RecipeCard() {
    const { toast } = useToast();
    const [isGenerating, startGeneration] = useTransition();
    const [dishName, setDishName] = useState('');
    const [result, setResult] = useState<{ isSuccess: boolean; ingredients: string[] } | null>(null);

    const { masterProducts, productPrices } = useAppStore();
    const { addItem, clearCart } = useCart();
    
    const handleGetIngredients = async () => {
        if (!dishName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a dish name.' });
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
                    setResult({ 
                        isSuccess: true, 
                        ingredients: response.ingredients,
                    });
                     toast({
                        title: 'Recipe Found!',
                        description: `Found ${response.ingredients.length} ingredients for "${dishName}".`,
                    });
                } else {
                     setResult({ isSuccess: false, ingredients: [] });
                     toast({
                        variant: 'destructive',
                        title: 'Recipe Not Found',
                        description: `The AI could not find ingredients for "${dishName}".`,
                    });
                }
            } catch (error) {
                console.error("AI Recipe Flow failed:", error);
                toast({
                    variant: 'destructive',
                    title: 'An Error Occurred',
                    description: 'The AI flow failed. Please check the server console for details.',
                });
            }
        });
    };
    
    const handleAddAllToCart = () => {
        if (!result || !result.isSuccess || result.ingredients.length === 0) return;

        let itemsAdded = 0;
        
        result.ingredients.forEach(ingredientName => {
            let bestMatch = { product: null, score: 0 };

            masterProducts.forEach(product => {
                const similarity = calculateSimilarity(ingredientName.toLowerCase(), product.name.toLowerCase());
                if (similarity > bestMatch.score) {
                    bestMatch = { product, score: similarity };
                }
            });

            if (bestMatch.product && bestMatch.score > 0.7) {
                const priceData = productPrices[bestMatch.product.name.toLowerCase()];
                if (priceData?.variants?.[0]) {
                    const smallestVariant = priceData.variants[0];
                    addItem(bestMatch.product, smallestVariant, 1);
                    itemsAdded++;
                }
            }
        });

        toast({
            title: 'Items Added to Cart',
            description: `Successfully matched and added ${itemsAdded} out of ${result.ingredients.length} ingredients to your cart.`,
        });
    };

    return (
        <Card className="bg-gradient-to-br from-green-50 to-blue-50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline">
                    <ChefHat className="h-6 w-6 text-green-600" />
                    AI Recipe Finder
                </CardTitle>
                <CardDescription>What are you planning to cook today? Get an ingredient list instantly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="e.g., Chicken Biryani"
                            value={dishName}
                            onChange={(e) => setDishName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGetIngredients()}
                            disabled={isGenerating}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={handleGetIngredients} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Get Ingredients
                    </Button>
                </div>
                 {result && (
                    <div className="border-t pt-4">
                        {result.isSuccess ? (
                            <div className="space-y-4">
                                <div className="flex flex-wrap gap-2">
                                    {result.ingredients.map((ing, index) => (
                                        <Badge key={index} variant="secondary">{ing}</Badge>
                                    ))}
                                </div>
                                <Button onClick={handleAddAllToCart} className="w-full">
                                    <ShoppingCart className="mr-2 h-4 w-4" />
                                    Add All Available Ingredients to Cart
                                </Button>
                            </div>
                        ) : (
                            <Alert variant="destructive">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>Recipe Not Found</AlertTitle>
                                <AlertDescription>
                                    The AI couldn't find a recipe for "{dishName}". Please try a different dish.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
