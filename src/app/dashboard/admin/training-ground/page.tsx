
'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Sparkles, Check, ThumbsUp, X, Lightbulb } from 'lucide-react';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useAppStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { extractAliasesFromText, ExtractAliasesOutput } from '@/ai/flows/extract-aliases-flow';
import { doc, arrayUnion, writeBatch } from 'firebase/firestore';
import { useFirebase } from '@/firebase';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const createSlug = (text: string) => text.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');


function SuggestionCard({ suggestion, onApprove }: { suggestion: ExtractAliasesOutput['suggestions'][0], onApprove: (productName: string, alias: string) => void }) {
    const [isApproving, startApprove] = useTransition();

    const handleApprove = () => {
        startApprove(() => {
            onApprove(suggestion.productName, suggestion.suggestedAlias);
        });
    }

    return (
        <Card className="bg-background">
            <CardContent className="p-4">
                <div className="flex justify-between items-start">
                    <div className="space-y-2">
                        <p className="text-sm text-muted-foreground">The AI suggests that...</p>
                        <p>...the phrase <Badge variant="secondary" className="text-base">{suggestion.suggestedAlias}</Badge></p>
                        <p>...is another name for <Badge variant="default" className="text-base">{suggestion.productName}</Badge>.</p>
                    </div>
                    <div className="text-right">
                         <p className="text-xs text-muted-foreground">Confidence</p>
                         <p className="font-bold text-lg text-primary">{(suggestion.confidence * 100).toFixed(0)}%</p>
                    </div>
                </div>
                <div className="mt-4 p-3 bg-muted/50 rounded-md border">
                    <p className="text-xs font-semibold text-muted-foreground">Source Context:</p>
                    <blockquote className="text-sm italic text-foreground">"...{suggestion.context}..."</blockquote>
                </div>
                <div className="mt-4 flex justify-end">
                    <Button size="sm" onClick={handleApprove} disabled={isApproving}>
                        {isApproving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ThumbsUp className="mr-2 h-4 w-4" />}
                        Approve & Add Alias
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}


export default function AITrainingGroundPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    const { masterProducts, fetchInitialData } = useAppStore();
    const { firestore } = useFirebase();

    const [textBlock, setTextBlock] = useState('');
    const [isTraining, startTraining] = useTransition();
    const [suggestions, setSuggestions] = useState<ExtractAliasesOutput['suggestions']>([]);

    if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    const handleTrainAI = () => {
        if (!textBlock.trim()) {
            toast({ variant: 'destructive', title: 'Please enter some text to analyze.' });
            return;
        }

        startTraining(async () => {
            setSuggestions([]);
            try {
                const productNames = masterProducts.map(p => p.name);
                const result = await extractAliasesFromText({
                    textBlock,
                    existingProducts: productNames,
                });
                
                if (result.suggestions.length > 0) {
                    setSuggestions(result.suggestions);
                    toast({ title: 'Analysis Complete!', description: `The AI found ${result.suggestions.length} potential new aliases.` });
                } else {
                    toast({ title: 'Analysis Complete', description: 'The AI did not find any new aliases in this text.' });
                }
            } catch (error) {
                console.error("AI Training failed:", error);
                toast({ variant: 'destructive', title: 'AI Error', description: 'Could not process the text.' });
            }
        });
    };

    const handleApproveAlias = async (productName: string, alias: string) => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Database not available' });
            return;
        }
        
        const productSlug = createSlug(productName);
        const aliasGroupRef = doc(firestore, 'voiceAliasGroups', productSlug);

        try {
            const batch = writeBatch(firestore);
            // The alias is likely to be English text, so we add it to the 'en' and 'te' (transliterated) aliases
            batch.set(aliasGroupRef, { 
                en: arrayUnion(alias),
                te: arrayUnion(alias),
            }, { merge: true });

            await batch.commit();

            toast({
                title: 'Alias Approved!',
                description: `"${alias}" is now a voice command for "${productName}".`,
                variant: 'default',
                className: 'bg-green-100 border-green-300'
            });

            // Remove the approved suggestion from the list
            setSuggestions(current => current.filter(s => s.suggestedAlias !== alias || s.productName !== productName));
            
            // Refetch all data to update the voice commander's context
            await fetchInitialData(firestore);

        } catch (error) {
            console.error("Failed to approve alias:", error);
            toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the new alias.' });
        }
    };


    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Sparkles className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle className="text-3xl font-headline">AI Training Ground</CardTitle>
                            <CardDescription>
                                Paste any text (recipes, articles, product descriptions) and the AI will learn from it to improve voice commands.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label htmlFor="training-text" className="text-lg font-semibold">Paste Your Text Here</Label>
                        <Textarea
                            id="training-text"
                            placeholder="e.g., 'To make a delicious biryani, you will need basmati rice, chicken, and various spices... Kandi Pappu, also known as Toor Dal, is a key ingredient in many South Indian dishes.'"
                            className="min-h-[200px] text-base"
                            value={textBlock}
                            onChange={(e) => setTextBlock(e.target.value)}
                            disabled={isTraining}
                        />
                    </div>
                    <Button onClick={handleTrainAI} disabled={isTraining} className="w-full" size="lg">
                        {isTraining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lightbulb className="mr-2 h-4 w-4" />}
                        Train AI & Extract Knowledge
                    </Button>

                    {isTraining ? (
                         <div className="text-center py-8">
                            <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                            <p className="mt-2 text-muted-foreground">AI is reading and analyzing the text...</p>
                         </div>
                    ) : suggestions.length > 0 ? (
                        <div className="space-y-4 border-t pt-6">
                            <h3 className="text-xl font-bold text-center">AI Suggestions</h3>
                             {suggestions.map((suggestion, index) => (
                                <SuggestionCard 
                                    key={index} 
                                    suggestion={suggestion} 
                                    onApprove={handleApproveAlias}
                                />
                             ))}
                        </div>
                    ) : !isTraining && textBlock.length > 10 && (
                        <Alert>
                           <Check className="h-4 w-4" />
                           <AlertTitle>Analysis Complete</AlertTitle>
                           <AlertDescription>The AI finished reading the text and did not find any new aliases to suggest.</AlertDescription>
                        </Alert>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
