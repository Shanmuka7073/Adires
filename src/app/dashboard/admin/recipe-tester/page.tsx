
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Beaker, Check, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getMealDbRecipe } from '@/app/actions';

export default function RecipeTesterPage() {
    const { toast } = useToast();
    const [isGenerating, startGeneration] = useTransition();
    const [dishName, setDishName] = useState('');
    const [result, setResult] = useState<{ isSuccess: boolean; reason: string; ingredients: string[], instructions?: string } | null>(null);

    const handleGetIngredients = async () => {
        if (!dishName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a dish name.' });
            return;
        }

        setResult(null);
        startGeneration(async () => {
            try {
                const response = await getMealDbRecipe(dishName);
                if (response.error) {
                    setResult({ isSuccess: false, reason: response.error, ingredients: [] });
                    toast({
                        title: 'Could not find recipe',
                        description: response.error,
                        variant: 'destructive',
                    });
                } else {
                    setResult({ 
                        isSuccess: true, 
                        reason: `Recipe found for "${dishName}"`,
                        ingredients: response.ingredients || [],
                        instructions: response.instructions,
                    });
                     toast({
                        title: 'Success!',
                        description: `Found a recipe for "${dishName}".`,
                    });
                }
            } catch (error) {
                console.error("TheMealDB fetch failed:", error);
                toast({
                    variant: 'destructive',
                    title: 'An Error Occurred',
                    description: 'The recipe fetch failed. Check the console for details.',
                });
            }
        });
    };

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-2xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-2xl font-headline">
                        <Beaker className="h-6 w-6 text-primary" />
                        Recipe Database Tester
                    </CardTitle>
                    <CardDescription>
                        Manually test the ability to find ingredients for a dish from TheMealDB API.
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
                            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Fetching...</>
                        ) : (
                            'Get Recipe'
                        )}
                    </Button>

                    {result && (
                        <div className="border-t pt-6 mt-6">
                            <h3 className="font-semibold text-lg mb-4">Result:</h3>
                            <Card className={result.isSuccess ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        {result.isSuccess ? <Check className="h-5 w-5 text-green-600" /> : <AlertTriangle className="h-5 w-5 text-red-600" />}
                                        {result.isSuccess ? 'Recipe Found' : 'Failed'}
                                    </CardTitle>
                                    <CardDescription>{result.reason}</CardDescription>
                                </CardHeader>
                                {result.isSuccess && result.ingredients.length > 0 && (
                                    <CardContent className="space-y-4">
                                        <div>
                                            <h4 className="font-semibold mb-2">Ingredients</h4>
                                            <div className="flex flex-wrap gap-2">
                                                {result.ingredients.map((ing, index) => (
                                                    <Badge key={index} variant="secondary">{ing}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                         {result.instructions && (
                                            <div>
                                                <h4 className="font-semibold mt-4 mb-2">Instructions</h4>
                                                <p className="text-sm whitespace-pre-wrap">{result.instructions}</p>
                                            </div>
                                        )}
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
