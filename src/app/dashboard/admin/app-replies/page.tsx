
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useAppStore } from '@/lib/store';
import { useFirebase } from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Loader2, Save, MessageSquare, Sparkles, Volume2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { collection, doc, writeBatch } from 'firebase/firestore';
import type { CommandGroup } from '@/lib/types';
import { suggestLocalReplies } from '@/ai/flows/suggest-local-replies-flow';
import { generateVoiceReply } from '@/ai/flows/generate-voice-reply-flow';

function CommandReplyItem({ commandKey, commandData, onReplyChange, onSuggestReplies }) {
    const [isSuggesting, startSuggestion] = useTransition();
    const [isGeneratingVoice, startVoiceGeneration] = useTransition();
    const [generatedAudio, setGeneratedAudio] = useState<Record<string, string>>({});
    const { toast } = useToast();

    // The 'addItem' reply is dynamic and cannot have a static voice generated.
    const isDynamicReply = commandKey === 'addItem';

    const handleSuggest = () => {
        startSuggestion(() => {
            onSuggestReplies(commandKey);
        });
    }
    
    const handleGenerateVoice = async (lang: 'en' | 'te' | 'hi') => {
        const textToSpeak = (commandData.reply as any)[lang];
        if (!textToSpeak) {
            toast({ variant: 'destructive', title: 'No text to generate from.' });
            return;
        }

        startVoiceGeneration(async () => {
            try {
                const result = await generateVoiceReply({ text: textToSpeak, language: lang });
                if (result.audioDataUri) {
                    onReplyChange(commandKey, `${lang}_audio`, result.audioDataUri);
                    setGeneratedAudio(prev => ({ ...prev, [lang]: result.audioDataUri }));
                    toast({ title: `Voice generated for ${lang.toUpperCase()}!` });
                } else {
                    throw new Error("AI did not return any audio data.");
                }
            } catch (error) {
                console.error("AI voice generation failed:", error);
                toast({ variant: 'destructive', title: 'Voice Generation Failed', description: 'Could not get audio from the AI.' });
            }
        });
    };

    const replies = typeof commandData.reply === 'object' && commandData.reply !== null && !Array.isArray(commandData.reply)
        ? commandData.reply
        : { en: (commandData.reply as string) || '', te: '', hi: '' };

    return (
        <AccordionItem value={commandKey} key={commandKey}>
            <AccordionTrigger className="text-lg font-semibold">{commandData.display}</AccordionTrigger>
            <AccordionContent>
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                    <Button onClick={handleSuggest} size="sm" variant="outline" disabled={isSuggesting}>
                        {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Suggest Local Replies with AI
                    </Button>

                    {isDynamicReply && (
                        <div className="flex items-center gap-2 p-2 text-sm text-blue-800 bg-blue-100 rounded-md">
                            <Info className="h-4 w-4" />
                            <p>Voice generation is disabled for this reply because it contains dynamic variables like `{{productName}}`.</p>
                        </div>
                    )}

                    {(['en', 'te', 'hi'] as const).map(lang => (
                        <div key={lang} className="space-y-2">
                            <Label htmlFor={`reply-${lang}-${commandKey}`}>
                                {lang === 'en' ? 'English' : lang === 'te' ? 'Telugu' : 'Hindi'} Reply
                            </Label>
                            <Textarea
                                id={`reply-${lang}-${commandKey}`}
                                placeholder={`e.g., Okay, heading home.`}
                                value={replies[lang] || ''}
                                onChange={e => onReplyChange(commandKey, lang, e.target.value)}
                            />
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleGenerateVoice(lang)}
                                    disabled={isGeneratingVoice || isDynamicReply}
                                    title={isDynamicReply ? "Voice generation is disabled for dynamic replies" : "Generate voice for this text"}
                                >
                                    {isGeneratingVoice ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Volume2 className="mr-2 h-4 w-4" />}
                                    Generate Voice
                                </Button>
                                 {(generatedAudio[lang] || (commandData.reply as any)[`${lang}_audio`]) && (
                                    <audio controls src={generatedAudio[lang] || (commandData.reply as any)[`${lang}_audio`]} className="h-8" />
                                )}
                            </div>
                        </div>
                    ))}
                    <p className="text-xs text-muted-foreground">
                        Tip: You can provide multiple replies for each language separated by a comma (`,`) and the app will pick one at random.
                    </p>
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}


export default function AppRepliesPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, startSaveTransition] = useTransition();

    const { commands: initialCommands, fetchInitialData, loading } = useAppStore();
    const [commands, setCommands] = useState<Record<string, CommandGroup>>(initialCommands);

    useEffect(() => {
        setCommands(initialCommands);
    }, [initialCommands]);
    
    useEffect(() => {
        if(firestore && !Object.keys(initialCommands).length) {
            fetchInitialData(firestore);
        }
    }, [firestore, initialCommands, fetchInitialData]);

    const handleReplyChange = (commandKey: string, langOrField: string, value: string) => {
        setCommands(currentCommands => {
            const command = currentCommands[commandKey];
            if (!command) return currentCommands;
    
            const currentReply = typeof command.reply === 'object' && command.reply !== null && !Array.isArray(command.reply) 
                ? command.reply 
                : { en: (typeof command.reply === 'string' ? command.reply : ''), te: '', hi: '' };
    
            const updatedReply = { ...currentReply, [langOrField]: value };
    
            return {
                ...currentCommands,
                [commandKey]: {
                    ...command,
                    reply: updatedReply,
                },
            };
        });
    };
    
    const handleSuggestReplies = async (commandKey: string) => {
        const commandData = commands[commandKey];
        if (!commandData) return;

        const currentReplies = typeof commandData.reply === 'object' && commandData.reply !== null && !Array.isArray(commandData.reply)
            ? commandData.reply
            : { en: commandData.reply as string, te: '', hi: '' };

        try {
            const result = await suggestLocalReplies({
                commandDisplay: commandData.display,
                englishReply: currentReplies.en || '',
                teluguReply: currentReplies.te || '',
                hindiReply: currentReplies.hi || '',
            });

            if (result) {
                handleReplyChange(commandKey, 'en', result.english);
                handleReplyChange(commandKey, 'te', result.telugu);
                handleReplyChange(commandKey, 'hi', result.hindi);
                toast({ title: 'AI Suggestions Applied!', description: `Localized replies for "${commandData.display}" have been generated.` });
            } else {
                throw new Error("AI did not return any suggestions.");
            }
        } catch (error) {
            console.error("AI suggestion failed:", error);
            toast({ variant: 'destructive', title: 'Suggestion Failed', description: 'Could not get suggestions from the AI.' });
        }
    };

    const handleSaveChanges = () => {
        if (!firestore) {
            toast({ variant: 'destructive', title: 'Firestore not available.' });
            return;
        }

        startSaveTransition(async () => {
            const batch = writeBatch(firestore);
            const commandsRef = collection(firestore, 'voiceCommands');

            Object.entries(commands).forEach(([key, commandData]) => {
                const commandRef = doc(commandsRef, key);
                // Ensure reply is always an object before saving
                const dataToSave = {
                    ...commandData,
                    reply: typeof commandData.reply === 'object' ? commandData.reply : { en: commandData.reply, te: '', hi: '' }
                };
                batch.set(commandRef, dataToSave, { merge: true });
            });

            try {
                await batch.commit();
                toast({ title: 'Success!', description: 'App replies have been updated.' });
                await fetchInitialData(firestore);
            } catch (error) {
                console.error('Failed to save replies:', error);
                toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save replies to the database.' });
            }
        });
    };

    if (loading && !Object.keys(commands).length) {
        return <div className="container mx-auto py-12">Loading command replies...</div>
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <MessageSquare className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle className="text-3xl font-headline">App Voice Replies</CardTitle>
                            <CardDescription>
                                Edit the conversational replies for your voice assistant's general commands.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full">
                        {Object.entries(commands).sort(([a], [b]) => a.localeCompare(b)).map(([key, commandData]) => (
                            <CommandReplyItem
                                key={key}
                                commandKey={key}
                                commandData={commandData}
                                onReplyChange={handleReplyChange}
                                onSuggestReplies={handleSuggestReplies}
                            />
                        ))}
                    </Accordion>

                    <Button onClick={handleSaveChanges} disabled={isSaving} className="w-full mt-8" size="lg">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save All Reply Changes
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
