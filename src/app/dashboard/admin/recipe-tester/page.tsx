
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Beaker, Check, AlertTriangle, ShoppingCart } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getIngredientsForDish } from '@/app/actions';
import type { GetIngredientsOutput } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { useRouter } from 'next/navigation';
import { RecipeCard } from '@/components/features/recipe-card';

export default function RecipeTesterPage() {
    const { toast } = useToast();
    const router = useRouter();
    const [isGenerating, startGeneration] = useTransition();
    const [dishName, setDishName] = useState('');
    const [result, setResult] = useState<GetIngredientsOutput | null>(null);

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
                    language: 'en', // For testing, we can hardcode to English
                });

                if (response.isSuccess && response.ingredients.length > 0) {
                    setResult(response);
                     toast({
                        title: 'Success!',
                        description: `Found ${response.ingredients.length} ingredients for "${dishName}".`,
                    });
                } else {
                     setResult({ isSuccess: false, ingredients: [], instructions: response.instructions, title: response.title, nutrition: response.nutrition });
                     toast({
                        title: 'AI Could Not Find Recipe',
                        description: `The model could not find ingredients for "${dishName}".`,
                        variant: 'destructive',
                    });
                }
            } catch (error) {
                console.error("AI Recipe Flow failed:", error);
                toast({
                    variant: 'destructive',
                    title: 'An Error Occurred',
                    description: 'The AI flow failed. Check the server console for details.',
                });
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
                    // Find the smallest variant (e.g., '1 pc', '100gm', '250gm')
                    const sortedVariants = [...priceData.variants].sort((a, b) => {
                        const weightA = parseInt(a.weight);
                        const weightB = parseInt(b.weight);
                        if (!isNaN(weightA) && !isNaN(weightB)) {
                            return weightA - weightB;
                        }
                        return a.weight.localeCompare(b.weight); // Fallback for non-numeric like '1 pc'
                    });
                    const smallestVariant = sortedVariants[0];
                    addItem(bestMatch.product, smallestVariant, 1);
                    itemsAdded++;
                }
            }
        });

        toast({
            title: 'Items Added to Cart',
            description: `Successfully added ${itemsAdded} out of ${result.ingredients.length} ingredients to your cart.`,
        });

        router.push('/cart');
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
             <div className="mb-8">
                <RecipeCard />
            </div>
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl font-headline">
                        <Beaker className="h-6 w-6 text-primary" />
                        AI Recipe Ingredient Tester
                    </CardTitle>
                    <CardDescription>
                        Manually test the AI's ability to find ingredients for a dish.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <label htmlFor="dishName" className="text-sm font-medium">Dish Name</label>
                        <Input
                            id="dishName"
                            placeholder="e.g., Chicken Biryani"
                            value={dishName}
                            onChange={(e) => setDishName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGetIngredients()}
                            disabled={isGenerating}
                        />
                    </div>

                    <Button onClick={handleGetIngredients} disabled={isGenerating} className="w-full">
                        {isGenerating ? (
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Generating...</>
                        ) : (
                            'Get Ingredients from AI'
                        )}
                    </Button>

                    {result && (
                        <div className="border-t pt-6 mt-6">
                            <h3 className="font-semibold text-lg mb-4">Result:</h3>
                            <Card className={result.isSuccess ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        {result.isSuccess ? <Check className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
                                        {result.isSuccess ? 'Success' : 'Failed'}
                                    </CardTitle>
                                </CardHeader>
                                {result.isSuccess && result.ingredients.length > 0 && (
                                    <CardContent className="space-y-4">
                                        <div className="flex flex-wrap gap-2">
                                            {result.ingredients.map((ing, index) => (
                                                <Badge key={index} variant="secondary">{ing.name} ({ing.quantity})</Badge>
                                            ))}
                                        </div>
                                         <Button onClick={handleAddAllToCart} className="w-full mt-4">
                                            <ShoppingCart className="mr-2 h-4 w-4" />
                                            Add All Ingredients to Cart
                                        </Button>
                                    </CardContent>
                                )}
                            </Card>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
