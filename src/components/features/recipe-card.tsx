
'use client';

import { useState, useTransition, useEffect, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Loader2, Sparkles, ShoppingCart, AlertCircle, Search, Volume2, Copy, StopCircle, Salad, Info } from 'lucide-react';
import { getIngredientsForDish } from '@/app/actions';
import type { GetIngredientsOutput } from '@/ai/flows/recipe-ingredients-types';
import { generateVoiceReply } from '@/ai/flows/generate-voice-reply-flow';
import { useAppStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import { calculateSimilarity } from '@/lib/calculate-similarity';
import { Badge } from '../ui/badge';
import { Alert, AlertTitle, AlertDescription } from '../ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useFirebase } from '@/firebase';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { Ingredient, InstructionStep, Product, ProductVariant } from '@/lib/types';
import { t as translate } from '@/lib/locales';


function RecipeContent({ result, onSpeak, isSpeaking, onStop, onCopyIngredients, onCopyInstructions }: { result: GetIngredientsOutput, onSpeak: (text: string) => void, isSpeaking: boolean, onStop: () => void, onCopyIngredients: () => void, onCopyInstructions: () => void }) {
    
    const renderInstructions = (instructions: InstructionStep[]) => {
        if (!instructions || instructions.length === 0) return <p className="text-muted-foreground">No instructions provided.</p>;
        
        return (
            <ol className="space-y-4">
                {instructions.map((step, index) => {
                    const stepTextToSpeak = `${step.title}. ${step.actions.join('. ')}`;
                    return (
                        <li key={index} className="p-4 bg-gray-50 border-l-4 border-primary rounded-r-lg">
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-bold text-base text-primary">{step.title}</h4>
                                <Button variant="ghost" size="icon" onClick={() => isSpeaking ? onStop() : onSpeak(stepTextToSpeak)}>
                                    {isSpeaking ? <StopCircle className="h-4 w-4 text-destructive" /> : <Volume2 className="h-4 w-4" />}
                                    <span className="sr-only">{isSpeaking ? "Stop reading" : "Read step aloud"}</span>
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
            <div>
                 <div className="flex items-center justify-between mb-2">
                    <h4 className="font-semibold text-lg flex items-center gap-2"><Salad className="h-5 w-5 text-green-600"/> Ingredients</h4>
                    <Button variant="ghost" size="icon" onClick={onCopyIngredients}>
                        <Copy className="h-4 w-4" />
                        <span className="sr-only">Copy Ingredients</span>
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {result.ingredients.map((ing, index) => (
                        <Badge key={index} variant="secondary" className="text-base py-1 px-3">
                            {ing.name} - {ing.quantity}
                        </Badge>
                    ))}
                </div>
                <p className="text-xs text-gray-500 mt-2">Ingredients & nutrition values are approximate per serving.</p>
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
        </div>
    )
}

export function RecipeCard() {
    const { toast } = useToast();
    const [isGenerating, startGeneration] = useTransition();
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [dishName, setDishName] = useState('');
    const [recipeData, setRecipeData] = useState<Record<string, GetIngredientsOutput>>({});
    const [currentLanguage, setCurrentLanguage] = useState<'en' | 'te'>('en');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const result = useMemo(() => recipeData[currentLanguage] || null, [recipeData, currentLanguage]);

    const handleGetIngredients = async (lang: 'en' | 'te', forceRefetch = false) => {
        if (!dishName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a dish name.' });
            return;
        }

        setCurrentLanguage(lang);
        if (recipeData[lang] && !forceRefetch) {
            return;
        }
        
        startGeneration(async () => {
            try {
                const response = await getIngredientsForDish({
                    dishName: dishName,
                    language: lang,
                    existingRecipe: lang === 'en' ? recipeData['te'] : recipeData['en'],
                });

                if (response.isSuccess) {
                    setRecipeData(prev => ({...prev, [lang]: response}));
                } else {
                     toast({
                        variant: 'destructive',
                        title: 'Recipe Not Found',
                        description: `The AI couldn't find a recipe for "${dishName}".`,
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
    
    const handleSpeak = async (textToSpeak: string) => {
        if (!textToSpeak || isSpeaking) return;

        setIsSpeaking(true);
        try {
            const result = await generateVoiceReply({ text: textToSpeak, language: currentLanguage });
            if (result.audioDataUri) {
                if (audioRef.current) {
                    audioRef.current.src = result.audioDataUri;
                    audioRef.current.play();
                }
            } else {
                throw new Error("AI did not return audio data.");
            }
        } catch (error) {
            console.error("AI voice generation failed:", error);
            toast({ variant: 'destructive', title: 'Voice Generation Failed', description: (error as Error).message });
            setIsSpeaking(false);
        }
    };
    
    const handleStopSpeaking = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
        setIsSpeaking(false);
    }
    
    // Effect to manage the audio element
    useEffect(() => {
        const audio = new Audio();
        audioRef.current = audio;
        
        const onEnded = () => setIsSpeaking(false);
        const onError = () => {
            toast({ variant: 'destructive', title: 'Audio Playback Error' });
            setIsSpeaking(false);
        }

        audio.addEventListener('ended', onEnded);
        audio.addEventListener('error', onError);

        return () => {
            audio.removeEventListener('ended', onEnded);
            audio.removeEventListener('error', onError);
            audio.pause();
        };
    }, [toast]);
    
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
                    {translate('ai-recipe-finder')}
                </CardTitle>
                <CardDescription>{translate('what-are-you-planning-to-cook')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                            placeholder={translate('eg-chicken-biryani')}
                            value={dishName}
                            onChange={(e) => setDishName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleGetIngredients(currentLanguage, true)}
                            disabled={isGenerating}
                            className="pl-9"
                        />
                    </div>
                    <Button onClick={() => handleGetIngredients(currentLanguage, true)} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        {translate('get-recipe')}
                    </Button>
                </div>
                 {result && (
                    <div className="border-t pt-4">
                        {result.isSuccess ? (
                            <Tabs defaultValue={currentLanguage} value={currentLanguage} onValueChange={(value) => handleGetIngredients(value as 'en' | 'te')}>
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
                                        onSpeak={handleSpeak}
                                        onStop={handleStopSpeaking}
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
