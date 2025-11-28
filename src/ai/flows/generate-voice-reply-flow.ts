'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Loader2, Sparkles, ShoppingCart, AlertCircle, Search, Volume2 } from 'lucide-react';
import { getIngredientsForDish, GetIngredientsOutput } from '@/ai/flows/recipe-ingredients-flow';
import { useAppStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { Badge } from '../ui/badge';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirebase } from '@/firebase';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { Ingredient } from '@/lib/types';

function RecipeContent({ result, onAddToCart, onSpeak, isSpeaking }: { result: GetIngredientsOutput, onAddToCart: () => void, onSpeak: () => void, isSpeaking: boolean }) {
    
    // Helper function to parse instructions into list items
    const renderInstructions = (instructions: string) => {
        if (!instructions) return null;
        // Split by newline, then filter out any empty lines
        const steps = instructions.split(/\n/).filter(line => line.trim() !== '');
        
        return (
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                {steps.map((step, index) => (
                    <li key={index} className="pl-2">
                        {/* Remove the leading number and period from the original string */}
                        {step.replace(/^\d+\.\s*/, '')}
                    </li>
                ))}
            </ol>
        );
    };

    return (
        <div className="space-y-4">
            <div>
                <h4 className="font-semibold mb-2">Ingredients</h4>
                <div className="flex flex-wrap gap-2">
                    {result.ingredients.map((ing, index) => (
                        <Badge key={index} variant="secondary">{ing.name} - {ing.quantity}</Badge>
                    ))}
                </div>
            </div>
             <div>
                <div className="flex items-center justify-between mb-2">
                     <h4 className="font-semibold">Instructions</h4>
                     <Button variant="ghost" size="icon" onClick={onSpeak} disabled={isSpeaking}>
                        {isSpeaking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                     </Button>
                </div>
                <div className="prose prose-sm max-w-none">
                    {renderInstructions(result.instructions)}
                </div>
            </div>
            <Button onClick={onAddToCart} className="w-full mt-4">
                <ShoppingCart className="mr-2 h-4 w-4" />
                Add All Available Ingredients to Cart
            </Button>
        </div>
    )
}


export function RecipeCard() {
    const { toast } = useToast();
    const [isGenerating, startGeneration] = useTransition();
    const [isSpeaking, startSpeaking] = useTransition();
    const [dishName, setDishName] = useState('');
    const [result, setResult] = useState<GetIngredientsOutput | null>(null);
    const [currentLanguage, setCurrentLanguage] = useState<'en' | 'te'>('en');
    const { firestore } = useFirebase();

    const { masterProducts, productPrices } = useAppStore();
    const { addItem } = useCart();
    
    const handleGetIngredients = async (lang: 'en' | 'te' = currentLanguage) => {
        if (!dishName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a dish name.' });
            return;
        }
        
        setCurrentLanguage(lang);
        setResult(null);
        startGeneration(async () => {
            try {
                if (!firestore) throw new Error("Firestore not available");

                const cached = await getCachedRecipe(firestore, dishName, lang);
                if (cached) {
                    setResult(cached);
                    toast({ title: 'Recipe Loaded from Cache!', description: 'This recipe was instantly loaded from our database.' });
                    return;
                }

                const response = await getIngredientsForDish({
                    dishName: dishName,
                    language: lang,
                });

                if (response.isSuccess && response.ingredients.length > 0) {
                    setResult(response);
                    await cacheRecipe(firestore, dishName, lang, response);
                } else {
                     setResult({ isSuccess: false, ingredients: [], instructions: '', title: '' });
                     toast({
                        variant: 'destructive',
                        title: 'Recipe Not Found',
                        description: `The AI could not find a recipe for "${dishName}".`,
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
        
        result.ingredients.forEach((ingredient: Ingredient) => {
            let bestMatch: { product: any, score: number } | null = null;

            masterProducts.forEach(product => {
                const similarity = calculateSimilarity(ingredient.name.toLowerCase(), product.name.toLowerCase());
                if (!bestMatch || similarity > bestMatch.score) {
                    bestMatch = { product, score: similarity };
                }
            });

            if (bestMatch && bestMatch.score > 0.7) {
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

    const handleSpeakInstructions = () => {
        if (!result?.instructions) return;

        startSpeaking(() => {
            try {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel(); // Stop any previous speech
                    const utterance = new SpeechSynthesisUtterance(result.instructions);
                    utterance.lang = currentLanguage === 'te' ? 'te-IN' : 'en-IN';
                    
                    utterance.onend = () => {
                       // Optional: handle end of speech
                    };

                    window.speechSynthesis.speak(utterance);
                } else {
                    throw new Error("Speech synthesis not supported by this browser.");
                }
            } catch (error) {
                console.error("Text-to-speech failed:", error);
                toast({ variant: 'destructive', title: 'Could not read aloud.', description: (error as Error).message });
            }
        });
    };

    return (
        <Card className="bg-gradient-to-br from-green-50 to-blue-50">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline">
                    <ChefHat className="h-6 w-6 text-green-600" />
                    AI Recipe Finder
                </CardTitle>
                <CardDescription>What are you planning to cook today? Get a full recipe instantly.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder="e.g., Chicken Biryani"
                            value={dishName}
                            onChange={(e) => setDishName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGetIngredients('en')}
                            disabled={isGenerating}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={() => handleGetIngredients('en')} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Get Recipe
                    </Button>
                </div>
                 {result && (
                    <div className="border-t pt-4">
                        {result.isSuccess ? (
                            <Tabs defaultValue="en" value={currentLanguage} onValueChange={(value) => handleGetIngredients(value as 'en' | 'te')}>
                                <div className="flex justify-between items-center mb-2">
                                     <h3 className="font-bold text-lg">{result.title}</h3>
                                     <TabsList>
                                        <TabsTrigger value="en">English</TabsTrigger>
                                        <TabsTrigger value="te">తెలుగు</TabsTrigger>
                                    </TabsList>
                                </div>
                                <TabsContent value={currentLanguage}>
                                   <RecipeContent result={result} onAddToCart={handleAddAllToCart} onSpeak={handleSpeakInstructions} isSpeaking={isSpeaking} />
                                </TabsContent>
                            </Tabs>
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