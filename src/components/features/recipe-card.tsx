'use client';

import { useState, useTransition, useMemo, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { ChefHat, Loader2, Sparkles, Volume2, Copy, StopCircle, Salad, Search, MessageCircle } from 'lucide-react';
import type { GetIngredientsOutput, InstructionStep, Store, User } from '@/lib/types';
import { t as translate } from '@/lib/locales';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { getOrCreateChat } from '@/lib/chat-service';
import { useRouter } from 'next/navigation';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { useAppStore } from '@/lib/store';
import { doc } from 'firebase/firestore';
import { Alert, AlertTitle } from '@/components/ui/alert';

function RecipeContent({ result, onSpeak, isSpeaking, onStop, onCopyIngredients, onCopyInstructions }: { result: GetIngredientsOutput, onSpeak: (text: string) => void, isSpeaking: boolean, onStop: () => void, onCopyIngredients: () => void, onCopyInstructions: () => void }) {
    
    const renderInstructions = (instructions: InstructionStep[]) => {
        if (!instructions || instructions.length === 0) return <p className="text-muted-foreground">No steps provided.</p>;
        
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
                                    <span className="sr-only">{isSpeaking ? "Stop" : "Read aloud"}</span>
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
                    <h4 className="font-semibold text-lg flex items-center gap-2">
                        {result.itemType === 'food' ? <Salad className="h-5 w-5 text-green-600"/> : null} 
                        {result.itemType === 'food' ? 'Ingredients' : 'Components & Materials'}
                    </h4>
                    <Button variant="ghost" size="icon" onClick={onCopyIngredients}>
                        <Copy className="h-4 w-4" />
                    </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                    {result.components.map((ing, index) => (
                        <Badge key={index} variant="secondary" className="text-base py-1 px-3">
                            {ing.name} - {ing.quantity}
                        </Badge>
                    ))}
                </div>
            </div>
             <div>
                <div className="flex items-center justify-between mb-2">
                     <h4 className="font-semibold text-lg">{result.itemType === 'food' ? 'Cooking Instructions' : 'Service Process'}</h4>
                     <Button variant="ghost" size="icon" onClick={onCopyInstructions}>
                        <Copy className="h-4 w-4" />
                     </Button>
                </div>
                {renderInstructions(result.steps)}
            </div>
        </div>
    )
}

export function RecipeCard() {
    const { toast } = useToast();
    const router = useRouter();
    const { firestore, user } = useFirebase();
    const { stores } = useAppStore();
    const [isGenerating, startGeneration] = useTransition();
    const [isStartingChat, startChatTransition] = useTransition();
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [dishName, setDishName] = useState('');
    const [recipeData, setRecipeData] = useState<Record<string, GetIngredientsOutput>>({});
    const [currentLanguage, setCurrentLanguage] = useState<'en' | 'te'>('en');
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const userDocRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
    const { data: userData } = useDoc<User>(userDocRef);

    const result = useMemo(() => recipeData[currentLanguage] || null, [recipeData, currentLanguage]);

    const handleGetIngredients = async (lang: 'en' | 'te', forceRefetch = false) => {
        if (!dishName.trim()) {
            toast({ variant: 'destructive', title: 'Please enter a name.' });
            return;
        }
        setCurrentLanguage(lang);
        if (recipeData[lang] && !forceRefetch) return;
        
        startGeneration(async () => {
            try {
                const response = await fetch('/api/ingredients', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ dishName, language: lang }),
                });

                if (!response.ok) {
                  throw new Error('Network response was not ok');
                }

                const data: GetIngredientsOutput = await response.json();

                if (data && data.isSuccess) {
                    setRecipeData(prev => ({ ...prev, [lang]: data }));
                } else {
                    toast({ variant: 'destructive', title: data.title || 'Details Not Found' });
                }
            } catch (error) {
                console.error("Failed to fetch ingredients:", error);
                toast({ variant: 'destructive', title: 'An Error Occurred' });
            }
        });
    };

    const handleChatWithLocalBasket = () => {
        if (!user || !firestore || !userData) {
            router.push('/login');
            return;
        }

        const localBasket = stores.find(s => s.name === 'LocalBasket');
        if (!localBasket) return;

        startChatTransition(async () => {
            const chatId = await getOrCreateChat(firestore, localBasket, userData);
            router.push(`/chat/${chatId}`);
        });
    };
    
    const handleSpeak = async (textToSpeak: string) => {
        if (!textToSpeak || isSpeaking) return;
        setIsSpeaking(true);
        try {
            const response = await fetch('/api/generate-voice-reply', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: textToSpeak, language: currentLanguage }),
            });

            if (!response.ok) {
                throw new Error('Failed to generate audio');
            }

            const result = await response.json();

            if (result.audioDataUri && audioRef.current) {
                audioRef.current.src = result.audioDataUri;
                audioRef.current.play();
            }
        } catch (error) {
            setIsSpeaking(false);
        }
    };
    
    useEffect(() => {
        const audio = new Audio(); audioRef.current = audio;
        const onEnded = () => setIsSpeaking(false);
        audio.addEventListener('ended', onEnded);
        return () => { audio.removeEventListener('ended', onEnded); audio.pause(); };
    }, []);
    
    const handleCopyIngredients = () => {
        if (!result?.components) return;
        const text = result.components.map(ing => `${ing.name} - ${ing.quantity}`).join('\n');
        navigator.clipboard.writeText(text).then(() => toast({ title: 'Copied!' }));
    };

    const handleCopyInstructions = () => {
        if (!result?.steps) return;
        const text = result.steps.map(step => `${step.title}\n- ${step.actions.join('\n- ')}`).join('\n\n');
        navigator.clipboard.writeText(text).then(() => toast({ title: 'Copied!' }));
    };

    return (
        <Card className="bg-gradient-to-br from-green-50 to-blue-50">
            <CardHeader className="flex flex-row justify-between items-start">
                <div>
                    <CardTitle className="flex items-center gap-2 font-headline">
                        <ChefHat className="h-6 w-6 text-green-600" />
                        AI Item Specialist
                    </CardTitle>
                    <CardDescription>Enter any product or service name.</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={handleChatWithLocalBasket} disabled={isStartingChat} className="rounded-full bg-white font-black uppercase text-[8px] tracking-widest h-8 px-3">
                    {isStartingChat ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <MessageCircle className="h-3 w-3 mr-1 text-primary" />}
                    Message Support
                </Button>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex gap-2">
                    <div className="relative flex-grow">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder={translate('eg-chicken-biryani')} value={dishName} onChange={(e) => setDishName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleGetIngredients(currentLanguage, true)} disabled={isGenerating} className="pl-9" />
                    </div>
                    <Button onClick={() => handleGetIngredients(currentLanguage, true)} disabled={isGenerating}>
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Analyze
                    </Button>
                </div>
                 {result && (
                    <div className="border-t pt-4">
                        {result.isSuccess ? (
                            <Tabs defaultValue={currentLanguage} value={currentLanguage} onValueChange={(v) => handleGetIngredients(v as 'en' | 'te')}>
                                <div className="flex justify-between items-center mb-2">
                                     <h3 className="font-bold text-xl">{result.title}</h3>
                                     <TabsList><TabsTrigger value="en">EN</TabsTrigger><TabsTrigger value="te">TE</TabsTrigger></TabsList>
                                </div>
                                <TabsContent value={currentLanguage}>
                                   <RecipeContent result={result} onSpeak={handleSpeak} onStop={() => { if(audioRef.current){ audioRef.current.pause(); audioRef.current.currentTime=0; } setIsSpeaking(false); }} isSpeaking={isSpeaking} onCopyIngredients={handleCopyIngredients} onCopyInstructions={handleCopyInstructions} />
                                </TabsContent>
                            </Tabs>
                        ) : <Alert variant="destructive"><AlertTitle>Not Found</AlertTitle></Alert>}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}