
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Loader2, Sparkles, ShoppingCart, AlertCircle, Search, Volume2, Copy } from 'lucide-react';
import { getIngredientsForDish, GetIngredientsOutput } from '@/ai/flows/recipe-ingredients-flow';
import { useAppStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { Badge } from '../ui/badge';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirebase } from '@/firebase';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { Ingredient, InstructionStep } from '@/lib/types';

function RecipeContent({ result, onAddToCart, onSpeak, isSpeaking, onCopyIngredients, onCopyInstructions }: { result: GetIngredientsOutput, onAddToCart: () => void, onSpeak: () => void, isSpeaking: boolean, onCopyIngredients: () => void, onCopyInstructions: () => void }) {
    
    const renderInstructions = (instructions: InstructionStep[]) => {
        if (!instructions || instructions.length === 0) return <p className="text-muted-foreground">No instructions provided.</p>;

        return (
            <div className="space-y-4">
                {instructions.map((step, index) => (
                    <div key={index} className="p-4 bg-gray-50 border-l-4 border-primary rounded-r-lg">
                        <h4 className="font-bold text-base text-primary mb-2">{step.title}</h4>
                        <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                            {step.actions.map((action, actionIndex) => (
                                <li key={actionIndex}>{action}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div>
                 <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-lg">Ingredients</h4>
                    <Button variant="ghost" size="icon" onClick={onCopyIngredients}>
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Copy Ingredients</span>
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {result.ingredients.map((ing, index) => (
                        <Badge key={index} variant="secondary" className="text-sm py-1 px-3">{ing.name} - {ing.quantity}</Badge>
                    ))}
                </div>
            </div>
             <div>
                <div className="flex items-center justify-between mb-2">
                     <h4 className="font-semibold text-lg">Instructions</h4>
                     <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={onCopyInstructions}>
                           <Copy className="h-4 w-4" />
                           <span className="sr-only">Copy Instructions</span>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={onSpeak} disabled={isSpeaking}>
                            {isSpeaking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Volume2 className="h-4 w-4" />}
                        </Button>
                     </div>
                </div>
                {renderInstructions(result.instructions)}
            </div>
            <Button onClick={onAddToCart} className="w-full mt-4" size="lg">
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
                     setResult({ isSuccess: false, ingredients: [], instructions: [], title: '' });
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

        const textToSpeak = result.instructions.map(step => `${step.title}. ${step.actions.join('. ')}`).join('\n\n');

        startSpeaking(() => {
            try {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel(); // Stop any previous speech
                    const utterance = new SpeechSynthesisUtterance(textToSpeak);
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
    
    const handleCopy = (textToCopy: string, type: 'Ingredients' | 'Instructions') => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            toast({ title: `${type} Copied!`, description: `The ${type.toLowerCase()} have been copied to your clipboard.` });
        }).catch(err => {
            toast({ variant: 'destructive', title: 'Copy Failed', description: 'Could not copy text to clipboard.' });
        });
    };

    const handleCopyIngredients = () => {
        if (!result?.ingredients) return;
        const ingredientsText = result.ingredients.map(ing => `${ing.name} - ${ing.quantity}`).join('\n');
        handleCopy(ingredientsText, 'Ingredients');
    };

    const handleCopyInstructions = () => {
        if (!result?.instructions) return;
        const instructionsText = result.instructions.map(step => `${step.title}\n- ${step.actions.join('\n- ')}`).join('\n\n');
        handleCopy(instructionsText, 'Instructions');
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
                                     <h3 className="font-bold text-xl">{result.title}</h3>
                                     <TabsList>
                                        <TabsTrigger value="en">English</TabsTrigger>
                                        <TabsTrigger value="te">తెలుగు</TabsTrigger>
                                    </TabsList>
                                </div>
                                <TabsContent value={currentLanguage}>
                                   <RecipeContent 
                                        result={result} 
                                        onAddToCart={handleAddAllToCart} 
                                        onSpeak={handleSpeakInstructions} 
                                        isSpeaking={isSpeaking}
                                        onCopyIngredients={handleCopyIngredients}
                                        onCopyInstructions={handleCopyInstructions}
                                    />
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
