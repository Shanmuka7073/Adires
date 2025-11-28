
'use client';

import { useState, useTransition, useEffect } from 'react';
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
import { Ingredient, InstructionStep, Product, ProductVariant } from '@/lib/types';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

function RecipeContent({ result, onAddToCart, onSpeak, isSpeaking, onCopyIngredients, onCopyInstructions }: { result: GetIngredientsOutput, onAddToCart: (selected: Ingredient[]) => void, onSpeak: (text: string) => void, isSpeaking: boolean, onCopyIngredients: () => void, onCopyInstructions: () => void }) {
    
    const [selectedIngredients, setSelectedIngredients] = useState<Ingredient[]>([]);
    const [ingredientMatches, setIngredientMatches] = useState<Record<string, { product: Product, variant: ProductVariant } | null>>({});
    const { masterProducts, productPrices } = useAppStore();
    const [totalPrice, setTotalPrice] = useState(0);
    const [dialogOpen, setDialogOpen] = useState(false);
    const [variantChoices, setVariantChoices] = useState<{ ingredient: Ingredient, products: Product[] } | null>(null);

    const findBestVariant = (product: Product): ProductVariant | null => {
        const priceData = productPrices[product.name.toLowerCase()];
        if (!priceData?.variants?.length) return null;

        const sortedVariants = [...priceData.variants].sort((a, b) => {
            const weightA = parseInt(a.weight);
            const weightB = parseInt(b.weight);
            if (!isNaN(weightA) && !isNaN(weightB)) return weightA - weightB;
            return a.weight.localeCompare(b.weight);
        });
        return sortedVariants[0];
    };
    
    const findProductForIngredient = (ingredient: Ingredient): { product: Product, variant: ProductVariant }[] => {
        // Simple "first word" matching strategy as requested.
        const firstWord = ingredient.name.split(/[\s,-(]/)[0].toLowerCase();
        
        const matches: { product: Product, score: number }[] = [];

        masterProducts.forEach(product => {
            const productNameLower = product.name.toLowerCase();
            // Check if the product name is exactly the first word of the ingredient.
            if (productNameLower === firstWord) {
                 matches.push({ product, score: 100 }); // High score for exact match
            }
        });
        
        if (matches.length === 0) return [];

        // Sort by score if ever needed in the future, but with this logic, it's a direct match.
        matches.sort((a, b) => b.score - a.score);

        return matches.map(match => {
            const variant = findBestVariant(match.product);
            return variant ? { product: match.product, variant } : null;
        }).filter((item): item is { product: Product, variant: ProductVariant } => item !== null);
    };

    useEffect(() => {
        const newMatches: Record<string, { product: Product, variant: ProductVariant } | null> = {};
        result.ingredients.forEach(ingredient => {
            const potentialMatches = findProductForIngredient(ingredient);
            if (potentialMatches.length > 0) {
                // With the new logic, we just take the first match.
                newMatches[ingredient.name] = potentialMatches[0];
            } else {
                newMatches[ingredient.name] = null;
            }
        });
        setIngredientMatches(newMatches);
        // Pre-select all available ingredients
        setSelectedIngredients(result.ingredients.filter(ing => newMatches[ing.name]));
    }, [result.ingredients, masterProducts, productPrices]);
    
    useEffect(() => {
        const newTotal = selectedIngredients.reduce((total, ing) => {
            const match = ingredientMatches[ing.name];
            return total + (match ? match.variant.price : 0);
        }, 0);
        setTotalPrice(newTotal);
    }, [selectedIngredients, ingredientMatches]);


    const handleSelectIngredient = (ingredient: Ingredient, checked: boolean) => {
        if (checked) {
             const potentialMatches = findProductForIngredient(ingredient);
             if (potentialMatches.length > 1) {
                 setVariantChoices({ ingredient, products: potentialMatches.map(p => p.product) });
                 setDialogOpen(true);
             } else {
                setSelectedIngredients(prev => [...prev, ingredient]);
             }
        } else {
            setSelectedIngredients(prev => prev.filter(i => i.name !== ingredient.name));
        }
    };
    
    const handleVariantSelection = (product: Product) => {
        if (variantChoices) {
            const variant = findBestVariant(product);
            if (variant) {
                setIngredientMatches(prev => ({
                    ...prev,
                    [variantChoices.ingredient.name]: { product, variant }
                }));
                 setSelectedIngredients(prev => [...prev, variantChoices.ingredient]);
            }
        }
        setDialogOpen(false);
        setVariantChoices(null);
    };

    const renderInstructions = (instructions: InstructionStep[]) => {
        if (!instructions || instructions.length === 0) return <p className="text-muted-foreground">No instructions provided.</p>;
        // ... (instruction rendering logic remains the same)
        return (
            <ol className="space-y-4">
                {instructions.map((step, index) => {
                    const stepTextToSpeak = `${step.title}. ${step.actions.join('. ')}`;
                    return (
                        <li key={index} className="p-4 bg-gray-50 border-l-4 border-primary rounded-r-lg">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-base text-primary">{step.title}</h4>
                                <Button variant="ghost" size="icon" onClick={() => onSpeak(stepTextToSpeak)} disabled={isSpeaking}>
                                    <Volume2 className="h-4 w-4" />
                                    <span className="sr-only">Read step aloud</span>
                                </Button>
                            </div>
                            <ul className="list-disc pl-5 space-y-2 text-sm text-gray-700">
                                {step.actions.map((action, actionIndex) => (
                                    <li key={actionIndex}>{action}</li>
                                ))}
                            </ul>
                        </li>
                    );
                })}
            </ol>
        );
    };

    return (
        <div className="space-y-6">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                 <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Which ingredient did you mean?</DialogTitle>
                        <DialogDescription>The term "{variantChoices?.ingredient.name}" could refer to multiple products. Please select the correct one.</DialogDescription>
                    </DialogHeader>
                    <div className="flex flex-col gap-2">
                        {variantChoices?.products.map(p => {
                             const variant = findBestVariant(p);
                             return (
                                <Button key={p.id} variant="outline" className="justify-between" onClick={() => handleVariantSelection(p)}>
                                    <span>{p.name}</span>
                                    {variant && <span className="font-bold text-primary">₹{variant.price.toFixed(2)}</span>}
                                </Button>
                            )
                        })}
                    </div>
                </DialogContent>
            </Dialog>
            <div>
                 <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-lg">Ingredients</h4>
                    <Button variant="ghost" size="icon" onClick={onCopyIngredients}>
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Copy Ingredients</span>
                    </Button>
                </div>
                <div className="space-y-2">
                    {result.ingredients.map((ing, index) => {
                        const match = ingredientMatches[ing.name];
                        const isChecked = selectedIngredients.some(si => si.name === ing.name);
                        return (
                            <div key={index} className="flex items-center gap-3 p-2 rounded-md bg-muted/50">
                                <Checkbox
                                    id={`ing-${index}`}
                                    checked={isChecked}
                                    onCheckedChange={(checked) => handleSelectIngredient(ing, !!checked)}
                                    disabled={!match && findProductForIngredient(ing).length === 0}
                                />
                                <label htmlFor={`ing-${index}`} className="flex-1 text-sm">{ing.name} - <span className="text-muted-foreground">{ing.quantity}</span></label>
                                {match ? (
                                    <Badge variant="default" className="text-sm">₹{match.variant.price.toFixed(2)}</Badge>
                                ) : (
                                    findProductForIngredient(ing).length > 1 
                                    ? <Badge variant="secondary">Multiple Options</Badge>
                                    : <Badge variant="destructive">Not Available</Badge>
                                )}
                            </div>
                        )
                    })}
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
                     </div>
                </div>
                {renderInstructions(result.instructions)}
            </div>
            <Button onClick={() => onAddToCart(selectedIngredients)} className="w-full mt-4" size="lg" disabled={selectedIngredients.length === 0}>
                <ShoppingCart className="mr-2 h-4 w-4" />
                 {selectedIngredients.length > 0 ? `Add ${selectedIngredients.length} Items - ₹${totalPrice.toFixed(2)}` : 'Select Ingredients to Add'}
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
    
    const handleAddToCart = (selectedIngredients: Ingredient[]) => {
        if (selectedIngredients.length === 0) return;

        let itemsAdded = 0;
        
        selectedIngredients.forEach((ingredient) => {
            const firstWord = ingredient.name.split(/[\s,-(]/)[0].toLowerCase();
            let bestMatch: { product: Product, score: number } | null = null;
            
            masterProducts.forEach(product => {
                const lowerProdName = product.name.toLowerCase();
                 if(lowerProdName === firstWord) {
                     bestMatch = { product, score: 100 };
                }
            });

            if (bestMatch) {
                const priceData = productPrices[bestMatch.product.name.toLowerCase()];
                if (priceData?.variants?.length > 0) {
                    const sortedVariants = [...priceData.variants].sort((a, b) => {
                        const weightA = parseInt(a.weight);
                        const weightB = parseInt(b.weight);
                        if (!isNaN(weightA) && !isNaN(weightB)) return weightA - weightB;
                        return a.weight.localeCompare(b.weight);
                    });
                    const smallestVariant = sortedVariants[0];
                    addItem(bestMatch.product, smallestVariant, 1);
                    itemsAdded++;
                }
            }
        });

        toast({
            title: 'Items Added to Cart',
            description: `Successfully matched and added ${itemsAdded} out of ${selectedIngredients.length} ingredients to your cart.`,
        });
    };


    const handleSpeak = (textToSpeak: string) => {
        if (!textToSpeak) return;

        startSpeaking(() => {
            try {
                if ('speechSynthesis' in window) {
                    window.speechSynthesis.cancel();
                    const utterance = new SpeechSynthesisUtterance(textToSpeak);
                    utterance.lang = currentLanguage === 'te' ? 'te-IN' : 'en-IN';
                    
                    utterance.onend = () => {};

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
                                        onAddToCart={handleAddToCart} 
                                        onSpeak={handleSpeak} 
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
