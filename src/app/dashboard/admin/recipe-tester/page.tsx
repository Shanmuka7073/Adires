
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Beaker, Check, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';

export default function RecipeTesterPage() {
    const { toast } = useToast();
    const [isGenerating, startGeneration] = useTransition();
    const [dishName, setDishName] = useState('');
    const [result, setResult] = useState<{ isSuccess: boolean; reason: string; ingredients: string[] } | null>(null);

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

                if (response.isSuccess) {
                    setResult({ 
                        isSuccess: true, 
                        reason: `AI successfully found ingredients for "${dishName}"`,
                        ingredients: response.ingredients,
                    });
                     toast({
                        title: 'Success!',
                        description: `Found ${response.ingredients.length} ingredients for "${dishName}".`,
                    });
                } else {
                     setResult({ isSuccess: false, reason: `The AI could not determine the ingredients for "${dishName}". It may not be a known dish.`, ingredients: [] });
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

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
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
                                    <CardDescription>{result.reason}</CardDescription>
                                </CardHeader>
                                {result.isSuccess && result.ingredients.length > 0 && (
                                    <CardContent>
                                        <div className="flex flex-wrap gap-2">
                                            {result.ingredients.map((ing, index) => (
                                                <Badge key={index} variant="secondary">{ing}</Badge>
                                            ))}
                                        </div>
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
