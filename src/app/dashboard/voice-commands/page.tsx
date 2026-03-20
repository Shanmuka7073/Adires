'use client';

import { useState, useTransition, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Save, X, Mic, MessageSquare, Trash2, Sparkles, Package, Store as StoreIcon } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirebase } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { collection, writeBatch, doc, getDocs } from 'firebase/firestore';
import type { VoiceAliasGroup } from '@/lib/types';
import { type Locales } from '@/lib/locales';
import { CommandGroup } from '@/lib/locales/commands';
import { suggestProductAliases } from '@/ai/flows/suggest-product-aliases-flow';
import { suggestCommandAliases } from '@/ai/flows/suggest-command-aliases-flow';
import { suggestNumberAliases } from '@/ai/flows/suggest-number-aliases-flow';
import { generateAllNumberAliases } from '@/ai/flows/generate-all-number-aliases-flow';


const createSlug = (text: string) => text.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');


function NumberAliasItem({ number, name, locales, handleRemoveAlias, handleAddAlias, handleVoiceAdd, setLocales, isListening }: { number: number, name: string, locales: Locales, handleRemoveAlias: any, handleAddAlias: any, handleVoiceAdd: any, setLocales: any, isListening: boolean }) {
    const itemKey = `number-${number}`;
    const itemAliases = locales[itemKey] || {};
    const [isSuggesting, startSuggestion] = useTransition();
    const [newNumberAliases, setNewNumberAliases] = useState<Record<string, string>>({});
    const { toast } = useToast();

    const handleSuggestNumberAliases = () => {
        startSuggestion(async () => {
            try {
                const result = await suggestNumberAliases({ number: number.toString(), name });
                if (result && result.aliases) {
                    const currentLocales = useAppStore.getState().locales;
                    const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
                    if (!updatedLocales[itemKey]) {
                        updatedLocales[itemKey] = { id: itemKey, type: 'command' };
                    }
                    for (const lang in result.aliases) {
                        const newAliases = result.aliases[lang as 'en' | 'te' | 'hi'];
                        const existingAliases = new Set(Array.isArray(updatedLocales[itemKey][lang]) ? updatedLocales[itemKey][lang] as string[] : []);
                        newAliases.forEach(alias => existingAliases.add(alias));
                        updatedLocales[itemKey][lang] = Array.from(existingAliases);
                    }
                    setLocales(updatedLocales);
                    toast({ title: 'AI Suggestions Loaded!', description: `New aliases for "${name}" are ready for review. Remember to save.` });
                }
            } catch (error) {
                toast({ variant: 'destructive', title: 'AI Suggestion Failed' });
            }
        });
    };

    const handleLocalAdd = (lang: string) => {
        const aliasInput = newNumberAliases[lang];
        if (!aliasInput) return;
        handleAddAlias(itemKey, lang, aliasInput);
        setNewNumberAliases(prev => ({...prev, [lang]: ''}));
    }

    return (
        <AccordionItem value={itemKey}>
            <AccordionTrigger>
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{number} ({name})</span>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="space-y-6 p-4 bg-muted/50 rounded-lg">
                    <Button onClick={handleSuggestNumberAliases} size="sm" disabled={isSuggesting}>
                        {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Suggest with AI
                    </Button>
                    {['en', 'te', 'hi'].map(lang => {
                        const currentAliases: string[] = Array.isArray(itemAliases[lang]) ? itemAliases[lang] as string[] : (itemAliases[lang] ? [itemAliases[lang] as string] : []);
                        return (
                          <div key={lang} className="space-y-2">
                            <Label className="font-semibold text-sm uppercase">{lang} Aliases</Label>
                            <div className="flex flex-wrap gap-2">
                              {currentAliases.map((alias, index) => (
                                <Badge key={`${alias}-${index}`} variant="secondary" className="relative pr-6 group text-base py-1">
                                  {alias}
                                  <button onClick={() => handleRemoveAlias(itemKey, lang, alias)} className="absolute top-1/2 -translate-y-1/2 right-1 rounded-full p-0.5 bg-background/50 hover:bg-background text-muted-foreground hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="h-3 w-3" /><span className="sr-only">Remove {alias}</span>
                                  </button>
                                </Badge>
                              ))}
                              {currentAliases.length === 0 && <p className="text-xs text-muted-foreground">No aliases yet.</p>}
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t">
                              <Textarea placeholder={`Add ${lang} alias(es), comma-separated...`} value={newNumberAliases[lang] || ''} onChange={(e) => setNewNumberAliases((p: any) => ({ ...p, [lang]: e.target.value }))} onKeyDown={(e) => {if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleLocalAdd(lang); }}} />
                              <div className="flex flex-col gap-2">
                                <Button size="sm" onClick={() => handleLocalAdd(lang)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                                <Button size="sm" variant="outline" onClick={() => handleVoiceAdd(itemKey, lang)} disabled={isListening}><Mic className="h-4 w-4" /><span className="sr-only">Add by voice</span></Button>
                              </div>
                            </div>
                          </div>
                        )
                    })}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

const GeneralCommandItem = ({ commandKey, commandData, handleCommandUpdate, locales, setLocales, handleRemoveAlias, handleAddAlias, handleVoiceAdd, handleDeleteCommand, isListening, setCommands }: any) => {
    const [isSuggesting, startSuggestion] = useTransition();
    const { toast } = useToast();
    const [newGeneralAliases, setNewGeneralAliases] = useState<Record<string, string>>({});

    const itemAliases = locales[commandKey] || {};

    const handleLocalAdd = (lang: string) => {
        const aliasInput = newGeneralAliases[lang];
        if (!aliasInput) return;
        handleAddAlias(commandKey, lang, aliasInput);
        setNewGeneralAliases(prev => ({...prev, [lang]: ''}));
    }

    const handleSuggestCommandAliases = () => {
        startSuggestion(async () => {
            try {
                const result = await suggestCommandAliases({
                    commandKey,
                    commandDisplay: commandData.display,
                });

                if (result && result.aliases) {
                    const currentLocales = useAppStore.getState().locales;
                    const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
                    if (!updatedLocales[commandKey]) {
                        updatedLocales[commandKey] = { id: commandKey, type: 'command' };
                    }

                    for (const lang in result.aliases) {
                        const newAliases = result.aliases[lang as 'en' | 'te' | 'hi'];
                        const existingAliases = new Set(
                            Array.isArray(updatedLocales[commandKey][lang])
                                ? updatedLocales[commandKey][lang] as string[]
                                : []
                        );
                        newAliases.forEach(alias => existingAliases.add(alias));
                        updatedLocales[commandKey][lang] = Array.from(existingAliases);
                    }
                    setLocales(updatedLocales);

                    if (result.replies) {
                       setCommands((current: Record<string, CommandGroup>) => ({
                            ...current,
                            [commandKey]: {
                                ...current[commandKey],
                                reply: {
                                    en: result.replies.en.join(', '),
                                    te: result.replies.te.join(', '),
                                    hi: result.replies.hi.join(', '),
                                }
                            }
                        }));
                    }

                    toast({ title: 'AI Suggestions Loaded!', description: `New suggestions for "${commandData.display}" are ready for review. Remember to save.` });
                }
            } catch (error) {
                console.error("AI Command Alias Suggestion failed:", error);
                toast({ variant: 'destructive', title: 'AI Suggestion Failed', description: (error as Error).message });
            }
        });
    };

    return (
         <AccordionItem value={commandKey} key={commandKey}>
            <AccordionTrigger>
                <div className="flex items-center gap-2">
                    <span className="font-semibold text-lg">{commandData.display}</span>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="space-y-6 p-4 bg-muted/50 rounded-lg">
                    <div className="flex items-end gap-4">
                        <div className="space-y-2 flex-1">
                            <Label htmlFor={`display-${commandKey}`} className="font-semibold">Display Name</Label>
                            <Input id={`display-${commandKey}`} value={commandData.display} onChange={(e) => handleCommandUpdate(commandKey, 'display', e.target.value)} />
                        </div>
                        <Button variant="destructive" size="icon" onClick={() => handleDeleteCommand(commandKey)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`reply-${commandKey}`} className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" />App's Reply</Label>
                         <Textarea id={`reply-${commandKey}`} value={commandData.reply.en || ''} onChange={(e) => handleCommandUpdate(commandKey, 'reply', e.target.value)} placeholder="Enter English reply..." />
                         <Textarea value={commandData.reply.te || ''} onChange={(e) => setCommands((c: Record<string, CommandGroup>) => ({...c, [commandKey]: {...c[commandKey], reply: {...c[commandKey].reply, te: e.target.value}} }))} placeholder="Enter Telugu reply..." />
                         <Textarea value={commandData.reply.hi || ''} onChange={(e) => setCommands((c: Record<string, CommandGroup>) => ({...c, [commandKey]: {...c[commandKey], reply: {...c[commandKey].reply, hi: e.target.value}} }))} placeholder="Enter Hindi reply..." />
                         <p className="text-xs text-muted-foreground">If multiple replies are provided (comma-separated), the app will choose one at random.</p>
                    </div>

                    <Button onClick={handleSuggestCommandAliases} size="sm" disabled={isSuggesting}>
                        {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Suggest Aliases & Replies with AI
                    </Button>

                     {['en', 'te', 'hi'].map(lang => {
                        const currentAliases: string[] = Array.isArray(itemAliases?.[lang]) ? itemAliases[lang] as string[] : (itemAliases?.[lang] ? [itemAliases[lang] as string] : []);
                        return (
                          <div key={lang} className="space-y-2">
                            <Label className="font-semibold text-sm uppercase">{lang} Aliases</Label>
                            <div className="flex flex-wrap gap-2">
                              {currentAliases.map((alias, index) => (
                                <Badge key={`${alias}-${index}`} variant="secondary" className="relative pr-6 group text-base py-1">
                                  {alias}
                                  <button onClick={() => handleRemoveAlias(commandKey, lang, alias)} className="absolute top-1/2 -translate-y-1/2 right-1 rounded-full p-0.5 bg-background/50 hover:bg-background text-muted-foreground hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                    <X className="h-3 w-3" /><span className="sr-only">Remove {alias}</span>
                                  </button>
                                </Badge>
                              ))}
                              {currentAliases.length === 0 && <p className="text-xs text-muted-foreground">No aliases yet.</p>}
                            </div>
                            <div className="flex items-center gap-2 pt-2 border-t">
                              <Textarea placeholder={`Add ${lang} alias(es), comma-separated...`} value={newGeneralAliases[lang] || ''} onChange={(e) => setNewGeneralAliases((p: any) => ({ ...p, [lang]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleLocalAdd(lang); } }} />
                              <div className="flex flex-col gap-2">
                                <Button size="sm" onClick={() => handleLocalAdd(lang)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                                <Button size="sm" variant="outline" onClick={() => handleVoiceAdd(commandKey, lang)} disabled={isListening}><Mic className="h-4 w-4" /><span className="sr-only">Add by voice</span></Button>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
}

const AliasAccordionItem = ({ item, icon: IconComponent, locales, handleRemoveAlias, handleAddAlias, handleVoiceAdd, setLocales, isListening }: { item: { id: string; name: string, ownerId?: string }, icon: React.ElementType, locales: Locales, handleRemoveAlias: any, handleAddAlias: any, handleVoiceAdd: any, setLocales: any, isListening: boolean }) => {
    const itemKey = createSlug(item.name);
    const itemAliases = locales[itemKey] || {};
    const [isSuggesting, startSuggestion] = useTransition();
    const [newProductAliases, setNewProductAliases] = useState<Record<string, string>>({});
    const { firestore } = useFirebase();
    const { toast } = useToast();

    const handleLocalAdd = (lang: string) => {
        const aliasInput = newProductAliases[lang];
        if (!aliasInput) return;
        handleAddAlias(itemKey, lang, aliasInput);
        setNewProductAliases(prev => ({...prev, [lang]: ''}));
    };

    const handleSuggestAliases = () => {
        if (!firestore) return;
        startSuggestion(async () => {
            try {
                const result = await suggestProductAliases({ productName: item.name });
                if (result && result.aliases) {
                    const currentLocales = useAppStore.getState().locales;
                    const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
                    if (!updatedLocales[itemKey]) {
                        updatedLocales[itemKey] = { id: itemKey, type: 'product' };
                    }

                    for (const lang in result.aliases) {
                        const newAliases = result.aliases[lang as 'en' | 'te' | 'hi'];
                        const existingAliases = new Set(
                            Array.isArray(updatedLocales[itemKey][lang])
                                ? updatedLocales[itemKey][lang] as string[]
                                : (updatedLocales[itemKey][lang] ? [updatedLocales[itemKey][lang] as string] : [])
                        );
                        newAliases.forEach(alias => existingAliases.add(alias));
                        updatedLocales[itemKey][lang] = Array.from(existingAliases);
                    }
                    setLocales(updatedLocales);

                    toast({ title: 'AI Suggestions Loaded!', description: `New aliases for "${item.name}" are ready for review. Remember to save.` });
                }
            } catch (error) {
                console.error("AI Suggestion failed:", error);
                toast({ variant: 'destructive', title: 'AI Suggestion Failed', description: (error as Error).message });
            }
        });
    };

    return (
        <AccordionItem value={item.id} key={item.id}>
            <AccordionTrigger>
                <div className="flex items-center gap-2">
                    <IconComponent className="h-4 w-4 text-muted-foreground" />
                    <span className="font-semibold text-base">{item.name}</span>
                </div>
            </AccordionTrigger>
            <AccordionContent>
                <div className="space-y-6 p-4 bg-muted/50 rounded-lg">
                    <Button onClick={handleSuggestAliases} size="sm" disabled={isSuggesting}>
                        {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Suggest with AI
                    </Button>
                    {['en', 'te', 'hi'].map(lang => {
                        const currentAliases: string[] = Array.isArray(itemAliases?.[lang]) ? itemAliases[lang] as string[] : (itemAliases?.[lang] ? [itemAliases[lang] as string] : []);
                        return (
                            <div key={lang} className="space-y-2">
                                <Label className="font-semibold text-sm uppercase">{lang} Aliases</Label>
                                <div className="flex flex-wrap gap-2">
                                    {currentAliases.map((alias, index) => (
                                        <Badge key={`${alias}-${index}`} variant="secondary" className="relative pr-6 group text-base py-1">
                                            {alias}
                                            <button onClick={() => handleRemoveAlias(itemKey, lang, alias)} className="absolute top-1/2 -translate-y-1/2 right-1 rounded-full p-0.5 bg-background/50 hover:bg-background text-muted-foreground hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="h-3 w-3" /><span className="sr-only">Remove {alias}</span>
                                            </button>
                                        </Badge>
                                    ))}
                                    {currentAliases.length === 0 && <p className="text-xs text-muted-foreground">No aliases yet.</p>}
                                </div>
                                <div className="flex items-center gap-2 pt-2 border-t">
                                    <Textarea placeholder={`Add ${lang} alias(es), comma-separated...`} value={newProductAliases[lang] || ''} onChange={(e) => setNewProductAliases((p: any) => ({ ...p, [lang]: e.target.value }))} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleLocalAdd(lang); } }} />
                                    <div className="flex flex-col gap-2">
                                        <Button size="sm" onClick={() => handleLocalAdd(lang)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleVoiceAdd(itemKey, lang)} disabled={isListening}><Mic className="h-4 w-4" /><span className="sr-only">Add by voice</span></Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </AccordionContent>
        </AccordionItem>
    );
};


function NumberCommandsComponent() {
    const { locales, setLocales } = useAppStore();
    const [isBulkGenerating, startBulkGeneration] = useTransition();
    const { toast } = useToast();

    const numbers = Array.from({ length: 100 }, (_, i) => i + 1);
    const numberNames = ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty", "Twenty-One", "Twenty-Two", "Twenty-Three", "Twenty-Four", "Twenty-Five", "Twenty-Six", "Twenty-Seven", "Twenty-Eight", "Twenty-Nine", "Thirty", "Thirty-One", "Thirty-Two", "Thirty-Three", "Thirty-Four", "Thirty-Five", "Thirty-Six", "Thirty-Seven", "Thirty-Eight", "Thirty-Nine", "Forty", "Forty-One", "Forty-Two", "Forty-Three", "Forty-Four", "Forty-Five", "Forty-Six", "Forty-Seven", "Forty-Eight", "Forty-Nine", "Fifty", "Fifty-One", "Fifty-Two", "Fifty-Three", "Fifty-Four", "Fifty-Five", "Fifty-Six", "Fifty-Seven", "Fifty-Eight", "Fifty-Nine", "Sixty", "Sixty-One", "Sixty-Two", "Sixty-Three", "Sixty-Four", "Sixty-Five", "Sixty-Six", "Sixty-Seven", "Sixty-Eight", "Sixty-Nine", "Seventy", "Seventy-One", "Seventy-Two", "Seventy-Three", "Seventy-Four", "Seventy-Five", "Seventy-Six", "Seventy-Seven", "Seventy-Eight", "Seventy-Nine", "Eighty", "Eighty-One", "Eighty-Two", "Eighty-Three", "Eighty-Four", "Eighty-Five", "Eighty-Six", "Eighty-Seven", "Eighty-Eight", "Eighty-Nine", "Ninety", "Ninety-One", "Ninety-Two", "Ninety-Three", "Ninety-Four", "Ninety-Five", "Ninety-Six", "Ninety-Seven", "Ninety-Eight", "Ninety-Nine", "One Hundred"];
    
    const handleGenerateAll = () => {
        startBulkGeneration(async () => {
            try {
                const result = await generateAllNumberAliases();
                if (result && result.allAliases) {
                    const currentLocales = useAppStore.getState().locales;
                    const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
                    for (const key in result.allAliases) {
                        if (Object.prototype.hasOwnProperty.call(result.allAliases, key)) {
                            updatedLocales[key] = { id: key, type: 'command', ...result.allAliases[key] };
                        }
                    }
                    setLocales(updatedLocales);
                    toast({ title: 'AI Generation Complete!', description: 'All number aliases have been populated. Please review and save.' });
                }
            } catch (error) {
                 toast({ variant: 'destructive', title: 'Bulk AI Generation Failed', description: (error as Error).message });
            }
        });
    };

    return (
        <Card className="max-w-4xl mx-auto">
             <CardHeader>
                <CardTitle>Manage Number Aliases</CardTitle>
                <div className="flex justify-between items-center">
                    <CardDescription>
                        Add regional spellings, transliterations, and colloquialisms for numbers to improve voice recognition for quantities.
                    </CardDescription>
                    <Button onClick={handleGenerateAll} disabled={isBulkGenerating}>
                        {isBulkGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Generate All (1-100)
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full">
                   {numbers.map((num) => (
                       <NumberAliasItem key={num} number={num} name={numberNames[num-1]} locales={locales} handleRemoveAlias={() => {}} handleAddAlias={() => {}} handleVoiceAdd={() => {}} setLocales={setLocales} isListening={false} />
                   ))}
                </Accordion>
            </CardContent>
        </Card>
    );
}

export default function VoiceCommandsPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isProcessing, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState('general');

    const {
        masterProducts,
        stores,
        locales,
        commands,
        fetchInitialData,
        setLocales,
        setCommands,
    } = useAppStore();
    
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newCommandKey, setNewCommandKey] = useState('');
    const [newCommandDisplay, setNewCommandDisplay] = useState('');
    const [newCommandReply, setNewCommandReply] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<any>(null);

    useEffect(() => {
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            const recognition = recognitionRef.current;
            recognition.continuous = false;
            recognition.lang = 'en-IN';
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event: any) => {
                console.error("Speech recognition error:", event.error);
                toast({ variant: 'destructive', title: 'Voice Error', description: `An error occurred: ${event.error}` });
                setIsListening(false);
            };
        } else {
            console.warn("Speech recognition not supported in this browser.");
        }
    }, [toast]);


    const handleAddAlias = (itemKey: string, lang: string, aliasInput: string) => {
        if (!aliasInput) {
            toast({ variant: 'destructive', title: 'Cannot add empty alias' });
            return;
        }

        let addedCount = 0;
        const duplicates: string[] = [];

        const currentLocales = useAppStore.getState().locales;
        const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
        if (!updatedLocales[itemKey]) {
            updatedLocales[itemKey] = { id: itemKey, type: 'product' };
        }

        const existingAliases = Array.isArray(updatedLocales[itemKey][lang])
            ? updatedLocales[itemKey][lang] as string[]
            : (updatedLocales[itemKey][lang] ? [updatedLocales[itemKey][lang] as string] : []);

        const existingAliasSet = new Set(existingAliases.map(a => a.toLowerCase()));
        const aliasesToAdd = [...new Set(aliasInput.split(',').map(alias => alias.trim()).filter(Boolean))];

        aliasesToAdd.forEach(newAlias => {
            if (!existingAliasSet.has(newAlias.toLowerCase())) {
                existingAliases.push(newAlias);
                addedCount++;
            } else {
                duplicates.push(newAlias);
            }
        });

        updatedLocales[itemKey][lang] = existingAliases;
        setLocales(updatedLocales);

        if (duplicates.length > 0) {
             toast({ variant: 'destructive', title: 'Duplicate Item(s)', description: `"${duplicates.join(', ')}" already exist(s).` });
        }
        if (addedCount > 0) {
            toast({ title: 'Alias Added Locally', description: `Added new alias(es). Remember to save your changes.` });
        }
    };

    const handleRemoveAlias = (itemKey: string, lang: string, aliasToRemove: string) => {
        const currentLocales = useAppStore.getState().locales;
        const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
        const itemLangEntry = updatedLocales[itemKey]?.[lang];

        if (Array.isArray(itemLangEntry)) {
            updatedLocales[itemKey][lang] = itemLangEntry.filter((alias: string) => alias !== aliasToRemove);
            if (updatedLocales[itemKey][lang].length === 0) {
                delete updatedLocales[itemKey][lang];
            }
        } else if (itemLangEntry === aliasToRemove) {
            delete updatedLocales[itemKey][lang];
        }

        if (updatedLocales[itemKey] && Object.keys(updatedLocales[itemKey]).length <= 2 && updatedLocales[itemKey].type && updatedLocales[itemKey].id) {
            delete updatedLocales[itemKey];
        }
        setLocales(updatedLocales);
        toast({ title: 'Alias Removed Locally', description: 'Remember to save your changes.' });
    };
    
    const handleAddNewCommand = () => {
        const key = newCommandKey.trim();
        if (!key) {
            toast({ variant: 'destructive', title: 'Command Key is required.' });
            return;
        }
        if (commands[key] || locales[key]) {
            toast({ variant: 'destructive', title: 'Command Key already exists.' });
            return;
        }
        setCommands({
            ...commands,
            [key]: { display: newCommandDisplay, reply: { en: newCommandReply } }
        });
        setIsAddDialogOpen(false);
        setNewCommandKey('');
        setNewCommandDisplay('');
        setNewCommandReply('');
        toast({ title: 'New command added!', description: `Don't forget to save your changes.` });
    };

    const handleDeleteCommand = (keyToDelete: string) => {
        if (window.confirm(`Are you sure you want to permanently delete the "${commands[keyToDelete]?.display || keyToDelete}" command and all its aliases? This cannot be undone.`)) {
            const newCommands = { ...commands };
            delete newCommands[keyToDelete];
            setCommands(newCommands);
            
            const newLocales = { ...locales };
            delete newLocales[keyToDelete];
            setLocales(newLocales);
            
            toast({ title: 'Command Deleted Locally', description: `Remember to save your changes.` });
        }
    };

    const handleSaveAll = () => {
        if (!firestore) return;

        startTransition(async () => {
            const batch = writeBatch(firestore);
            const aliasGroupCollectionRef = collection(firestore, 'voiceAliasGroups');
            const commandCollectionRef = collection(firestore, 'voiceCommands');
            
            const currentLocales = useAppStore.getState().locales;
            const currentCommands = useAppStore.getState().commands;

            const existingAliasDocs = await getDocs(aliasGroupCollectionRef);
            const existingKeys = new Set(existingAliasDocs.docs.map(d => d.id));
            const existingCommandKeys = new Set((await getDocs(commandCollectionRef)).docs.map(d => d.id));

            const itemTypes = new Map<string, VoiceAliasGroup['type']>([
                ...masterProducts.map(p => [createSlug(p.name), 'product'] as [string, VoiceAliasGroup['type']]),
                ...stores.map(s => [createSlug(s.name), 'store'] as [string, VoiceAliasGroup['type']]),
                ...Object.keys(currentCommands).map(c => [c, 'command'] as [string, VoiceAliasGroup['type']])
            ]);

            // Sync Aliases
            for (const key in currentLocales) {
                const docRef = doc(aliasGroupCollectionRef, key);
                const newData: Partial<VoiceAliasGroup> = {};
                for (const lang in currentLocales[key]) {
                    if (lang === 'type' || lang === 'id') continue;
                    const aliases = currentLocales[key][lang];
                    newData[lang] = Array.isArray(aliases) ? aliases : (aliases ? [aliases] : []);
                }

                const inferredType = itemTypes.get(key);
                newData.type = inferredType || locales[key].type || 'command';
                batch.set(docRef, newData, { merge: true });
            }
            existingKeys.forEach(key => {
                if (!currentLocales[key]) {
                    batch.delete(doc(aliasGroupCollectionRef, key));
                }
            });

            // Sync Commands
            for (const key in currentCommands) {
                const docRef = doc(commandCollectionRef, key);
                batch.set(docRef, currentCommands[key]);
            }
            existingCommandKeys.forEach(key => {
                if (!currentCommands[key]) {
                    batch.delete(doc(commandCollectionRef, key));
                }
            });

            try {
                await batch.commit();
                toast({
                    title: 'Changes Saved!',
                    description: `Your voice command configuration has been updated.`,
                });
                await fetchInitialData(firestore);
                 toast({
                    title: 'App Data Synced!',
                    description: `The application's memory has been updated with your latest changes.`
                });
            } catch (error) {
                 toast({
                    variant: 'destructive',
                    title: 'Save Failed',
                    description: (error as Error).message || 'Could not save changes to Firestore.',
                });
                console.error(error);
            }
        });
    };

    const handleVoiceAdd = (key: string, lang: string) => {
        const recognition = recognitionRef.current;
        if (!recognition) {
            toast({ variant: 'destructive', title: 'Voice Not Supported' });
            return;
        }
        
        const recognitionLang = lang === 'te' ? 'te-IN' : 'en-IN';
        recognition.lang = recognitionLang;
        recognition.onresult = (event: any) => {
            const transcript = event.results[0][0].transcript;
            handleAddAlias(key, lang, transcript);
        };
        recognition.start();
    };

    const handleCommandUpdate = (key: string, field: 'display' | 'reply', value: string) => {
        setCommands({
            ...commands,
            [key]: { ...commands[key], [field]: value }
        });
    };

    const renderGeneralCommands = () => (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle>Manage General Commands & Replies</CardTitle>
                        <CardDescription>
                            Each action can be triggered by multiple phrases (aliases) in different languages.
                        </CardDescription>
                    </div>
                     <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                        <DialogTrigger asChild>
                             <Button><PlusCircle className="mr-2 h-4 w-4" /> Add New Command</Button>
                        </DialogTrigger>
                        <DialogContent>
                             <DialogHeader>
                                <DialogTitle>Add New General Command</DialogTitle>
                                <DialogDescription>
                                    Define a new action the voice assistant can perform. This does not write any code.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                    <Label htmlFor="new-cmd-key">Command Key</Label>
                                    <Input id="new-cmd-key" value={newCommandKey} onChange={e => setNewCommandKey(e.target.value.replace(/\s+/g, ''))} placeholder="e.g., showPromotions" />
                                    <p className="text-xs text-muted-foreground">A unique, code-friendly key (no spaces).</p>
                                </div>
                                 <div className="space-y-2">
                                    <Label htmlFor="new-cmd-display">Display Name</Label>
                                    <Input id="new-cmd-display" value={newCommandDisplay} onChange={e => setNewCommandDisplay(e.target.value)} placeholder="e.g., Show Promotions" />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="new-cmd-reply">App's Reply (English)</Label>
                                    <Input id="new-cmd-reply" value={newCommandReply} onChange={e => setNewCommandReply(e.target.value)} placeholder="e.g., Okay, here are the latest promotions." />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button type="button" variant="secondary" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                                <Button type="button" onClick={handleAddNewCommand}>Add Command</Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <Accordion type="multiple" className="w-full">
                    {Object.entries(commands).map(([key, group]) => (
                       <GeneralCommandItem 
                            key={key} 
                            commandKey={key} 
                            commandData={group} 
                            setCommands={setCommands}
                            locales={locales}
                            setLocales={setLocales}
                            handleRemoveAlias={handleRemoveAlias}
                            handleAddAlias={handleAddAlias}
                            handleVoiceAdd={handleVoiceAdd}
                            handleDeleteCommand={handleDeleteCommand}
                            handleCommandUpdate={handleCommandUpdate}
                            isListening={isListening}
                        />
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );

    const renderNumberCommands = () => (
        <NumberCommandsComponent />
    );

    const renderAliasAccordion = (
      items: { id: string; name: string, ownerId?: string }[],
      title: string,
      description: string,
      icon: React.ElementType
    ) => (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <Accordion type="multiple" className="w-full">
                    {items.map((item) => (
                       <AliasAccordionItem key={item.id} item={item} icon={icon} locales={locales} handleRemoveAlias={handleRemoveAlias} handleAddAlias={handleAddAlias} handleVoiceAdd={handleVoiceAdd} setLocales={setLocales} isListening={isListening} />
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-8">
             <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">AI Training Center</h1>
                <p className="text-lg text-muted-foreground mt-2">This is the brain of your app. Add aliases and commands to make the AI smarter.</p>
            </div>

            <div className="flex justify-center gap-2 mb-8">
                <Button variant={activeTab === 'general' ? 'default' : 'outline'} onClick={() => setActiveTab('general')}>General Commands</Button>
                <Button variant={activeTab === 'products' ? 'default' : 'outline'} onClick={() => setActiveTab('products')}>Product Aliases</Button>
                <Button variant={activeTab === 'stores' ? 'default' : 'outline'} onClick={() => setActiveTab('stores')}>Store Aliases</Button>
                <Button variant={activeTab === 'numbers' ? 'default' : 'outline'} onClick={() => setActiveTab('numbers')}>Number Aliases</Button>
            </div>

            <div className="space-y-8">
                {activeTab === 'general' && renderGeneralCommands()}
                {activeTab === 'products' && renderAliasAccordion(masterProducts as any[], "Manage Product Aliases", "Add alternative names for products in different languages to improve voice recognition.", Package)}
                {activeTab === 'stores' && renderAliasAccordion(stores as any[], "Manage Store Aliases", "Add alternative names for your stores in different languages.", StoreIcon)}
                {activeTab === 'numbers' && renderNumberCommands()}
            </div>

            <div className="max-w-4xl mx-auto mt-8">
                <Button onClick={handleSaveAll} disabled={isProcessing} className="w-full" size="lg">
                    {isProcessing ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving All Changes...</>
                    ) : (
                        <><Save className="mr-2 h-4 w-4" /> Save All Changes</>
                    )}
                </Button>
            </div>
        </div>
    );
}
