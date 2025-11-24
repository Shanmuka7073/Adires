

'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Save, X, Mic, MessageSquare, Code, Package, Store as StoreIcon, Trash2, Sparkles } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirebase } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { collection, writeBatch, doc, getDocs, setDoc, deleteDoc } from 'firebase/firestore';
import type { VoiceAliasGroup } from '@/lib/types';
import { CommandGroup, generalCommands as defaultGeneralCommands } from '@/lib/locales/commands';
import { suggestProductAliases } from '@/ai/flows/suggest-product-aliases-flow';


const createSlug = (text: string) => text.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');

// This component now relies on the global useAppStore for its data.
export default function VoiceCommandsPage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isProcessing, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState('general');

    // Data from the global store
    const { 
        masterProducts, 
        stores, 
        locales: initialLocales, 
        commands: initialCommands, 
        fetchInitialData 
    } = useAppStore();

    // Local state for UI edits, initialized from the global store
    const [locales, setLocales] = useState<Locales>(initialLocales);
    const [commands, setCommands] = useState<Record<string, CommandGroup>>(initialCommands);
    
    // Local state for UI interactions
    const [newAliases, setNewAliases] = useState<Record<string, Record<string, string>>>({});
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newCommandKey, setNewCommandKey] = useState('');
    const [newCommandDisplay, setNewCommandDisplay] = useState('');
    const [newCommandReply, setNewCommandReply] = useState('');
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    // Re-initialize local state whenever the global store's data changes
    useEffect(() => {
        setLocales(initialLocales);
        setCommands(initialCommands);
    }, [initialLocales, initialCommands]);


    useEffect(() => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (SpeechRecognition) {
            recognitionRef.current = new SpeechRecognition();
            const recognition = recognitionRef.current;
            recognition.continuous = false;
            recognition.lang = 'en-IN';
            recognition.interimResults = false;

            recognition.onstart = () => setIsListening(true);
            recognition.onend = () => setIsListening(false);
            recognition.onerror = (event) => {
                console.error("Speech recognition error:", event.error);
                toast({ variant: 'destructive', title: 'Voice Error', description: `An error occurred: ${event.error}` });
                setIsListening(false);
            };
        } else {
            console.warn("Speech recognition not supported in this browser.");
        }
    }, [toast]);


    const handleAddAlias = (itemKey: string, lang: string) => {
        const newAliasInput = newAliases[itemKey]?.[lang]?.trim();
        if (!newAliasInput) {
            toast({ variant: 'destructive', title: 'Cannot add empty alias' });
            return;
        }

        let addedCount = 0;
        const duplicates: string[] = [];
        
        setLocales(currentLocales => {
            const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
            if (!updatedLocales[itemKey]) {
                updatedLocales[itemKey] = {};
            }
            
            const existingAliases = Array.isArray(updatedLocales[itemKey][lang]) 
                ? updatedLocales[itemKey][lang] as string[] 
                : (updatedLocales[itemKey][lang] ? [updatedLocales[itemKey][lang] as string] : []);
            
            const existingAliasSet = new Set(existingAliases.map(a => a.toLowerCase()));
            const aliasesToAdd = [...new Set(newAliasInput.split(',').map(alias => alias.trim()).filter(Boolean))];

            aliasesToAdd.forEach(newAlias => {
                if (!existingAliasSet.has(newAlias.toLowerCase())) {
                    existingAliases.push(newAlias);
                    addedCount++;
                } else {
                    duplicates.push(newAlias);
                }
            });

            updatedLocales[itemKey][lang] = existingAliases.length === 1 ? existingAliases[0] : existingAliases;
            return updatedLocales;
        });

        if (duplicates.length > 0) {
             toast({ variant: 'destructive', title: 'Duplicate Item(s)', description: `"${duplicates.join(', ')}" already exist(s).` });
        }
        if (addedCount > 0) {
            toast({ title: 'Alias Added Locally', description: `Added new alias(es). Remember to save your changes.` });
        }

        // Clear the input field
        setNewAliases(prev => ({
            ...prev,
            [itemKey]: { ...prev[itemKey], [lang]: '' }
        }));
    };

    const handleRemoveAlias = (itemKey: string, lang: string, aliasToRemove: string) => {
        setLocales(currentLocales => {
            const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
            const itemLangEntry = updatedLocales[itemKey]?.[lang];

            if (Array.isArray(itemLangEntry)) {
                const newAliases = itemLangEntry.filter(alias => alias !== aliasToRemove);
                if (newAliases.length === 0) {
                    delete updatedLocales[itemKey][lang];
                } else if (newAliases.length === 1) {
                    updatedLocales[itemKey][lang] = newAliases[0];
                } else {
                    updatedLocales[itemKey][lang] = newAliases;
                }
            } else if (itemLangEntry === aliasToRemove) {
                delete updatedLocales[itemKey][lang];
            }
            
            if (updatedLocales[itemKey] && Object.keys(updatedLocales[itemKey]).length === 0) {
                delete updatedLocales[itemKey];
            }
            return updatedLocales;
        });
        toast({ title: 'Alias Removed Locally', description: 'Remember to save your changes.' });
    };
    
    const handleCommandUpdate = (key: string, field: 'display' | 'reply', value: string) => {
        setCommands(current => ({
            ...current,
            [key]: { ...current[key], [field]: value }
        }));
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
        setCommands(current => ({
            ...current,
            [key]: { display: newCommandDisplay, reply: newCommandReply }
        }));
        setIsAddDialogOpen(false);
        setNewCommandKey('');
        setNewCommandDisplay('');
        setNewCommandReply('');
        toast({ title: 'New command added!', description: `Don't forget to save your changes.` });
    };
    
    const handleDeleteCommand = (keyToDelete: string) => {
        if (window.confirm(`Are you sure you want to permanently delete the "${commands[keyToDelete]?.display || keyToDelete}" command and all its aliases? This cannot be undone.`)) {
            setCommands(current => {
                const newCommands = { ...current };
                delete newCommands[keyToDelete];
                return newCommands;
            });
             setLocales(current => {
                const newLocales = { ...current };
                delete newLocales[keyToDelete];
                return newLocales;
            });
            toast({ title: 'Command Deleted Locally', description: `Remember to save your changes.` });
        }
    };

    const handleSaveAll = () => {
        if (!firestore) return;

        startTransition(async () => {
            const batch = writeBatch(firestore);
            const aliasGroupCollectionRef = collection(firestore, 'voiceAliasGroups');
            const commandCollectionRef = collection(firestore, 'voiceCommands');

            const existingAliasDocs = await getDocs(aliasGroupCollectionRef);
            const existingKeys = new Set(existingAliasDocs.docs.map(d => d.id));
            const existingCommandKeys = new Set((await getDocs(commandCollectionRef)).docs.map(d => d.id));
            
            const itemTypes = new Map([
                ...masterProducts.map(p => [createSlug(p.name), 'product']),
                ...stores.map(s => [createSlug(s.name), 'store']),
                ...Object.keys(commands).map(c => [c, 'command'])
            ]);
            
            // Sync Aliases
            for (const key in locales) {
                const docRef = doc(aliasGroupCollectionRef, key);
                const newData: Partial<VoiceAliasGroup> = {};
                for (const lang in locales[key]) {
                    const aliases = locales[key][lang];
                    newData[lang] = Array.isArray(aliases) ? aliases : (aliases ? [aliases] : []);
                }
                
                // Use set with merge instead of trying to figure out if it's an update or create
                newData.type = itemTypes.get(key) || 'command';
                batch.set(docRef, newData, { merge: true });
            }
            existingKeys.forEach(key => {
                if (!locales[key]) {
                    batch.delete(doc(aliasGroupCollectionRef, key));
                }
            });

            // Sync Commands
            for (const key in commands) {
                const docRef = doc(commandCollectionRef, key);
                batch.set(docRef, commands[key]);
            }
            existingCommandKeys.forEach(key => {
                if (!commands[key]) {
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
        if (!recognitionRef.current) {
            toast({ variant: 'destructive', title: 'Voice Not Supported' });
            return;
        }
        const recognition = recognitionRef.current;
        const recognitionLang = lang === 'te' ? 'te-IN' : 'en-IN';
        recognition.lang = recognitionLang;
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            setLocales(currentLocales => {
                const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
                if (!updatedLocales[key]) updatedLocales[key] = {};
                const existing = Array.isArray(updatedLocales[key][lang]) ? updatedLocales[key][lang] : (updatedLocales[key][lang] ? [updatedLocales[key][lang]] : []);
                if (!existing.includes(transcript)) {
                    existing.push(transcript);
                    toast({ title: 'Alias Added Locally', description: `Added "${transcript}". Remember to save.` });
                } else {
                    toast({ variant: 'destructive', title: 'Duplicate Alias', description: `"${transcript}" already exists.` });
                }
                updatedLocales[key][lang] = existing.length === 1 ? existing[0] : existing;
                return updatedLocales;
            });
        };
        recognition.start();
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
                                    <Label htmlFor="new-cmd-reply">App's Reply</Label>
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
                        <AccordionItem value={key} key={key}>
                            <AccordionTrigger>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-lg">{group.display}</span>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-6 p-4 bg-muted/50 rounded-lg">
                                    <div className="flex items-end gap-4">
                                        <div className="space-y-2 flex-1">
                                            <Label htmlFor={`display-${key}`} className="font-semibold">Display Name</Label>
                                            <Input id={`display-${key}`} value={group.display} onChange={(e) => handleCommandUpdate(key, 'display', e.target.value)} />
                                        </div>
                                         <Button variant="destructive" size="icon" onClick={() => handleDeleteCommand(key)}><Trash2 className="h-4 w-4" /></Button>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor={`reply-${key}`} className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" />App's Reply</Label>
                                        <Input id={`reply-${key}`} value={group.reply || ''} onChange={(e) => handleCommandUpdate(key, 'reply', e.target.value)} placeholder="Enter what the app should say..." />
                                    </div>
                                    
                                     {['en', 'te'].map(lang => {
                                        const currentAliases: string[] = Array.isArray(locales[key]?.[lang]) ? locales[key]?.[lang] as string[] : (locales[key]?.[lang] ? [locales[key]?.[lang] as string] : []);
                                        return (
                                          <div key={lang} className="space-y-2">
                                            <Label className="font-semibold text-sm uppercase">{lang} Aliases</Label>
                                            <div className="flex flex-wrap gap-2">
                                              {currentAliases.map((alias, index) => (
                                                <Badge key={`${alias}-${index}`} variant="secondary" className="relative pr-6 group text-base py-1">
                                                  {alias}
                                                  <button onClick={() => handleRemoveAlias(key, lang, alias)} className="absolute top-1/2 -translate-y-1/2 right-1 rounded-full p-0.5 bg-background/50 hover:bg-background text-muted-foreground hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X className="h-3 w-3" /><span className="sr-only">Remove {alias}</span>
                                                  </button>
                                                </Badge>
                                              ))}
                                              {currentAliases.length === 0 && <p className="text-xs text-muted-foreground">No aliases yet.</p>}
                                            </div>
                                            <div className="flex items-center gap-2 pt-2 border-t">
                                              <Input placeholder={`Add ${lang} alias(es), comma-separated...`} value={newAliases[key]?.[lang] || ''} onChange={(e) => setNewAliases(p => ({ ...p, [key]: { ...p[key], [lang]: e.target.value } }))} onKeyDown={(e) => {if (e.key === 'Enter') { e.preventDefault(); handleAddAlias(key, lang); }}} />
                                              <Button size="sm" onClick={() => handleAddAlias(key, lang)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                                              <Button size="sm" variant="outline" onClick={() => handleVoiceAdd(key, lang)} disabled={isListening}><Mic className="h-4 w-4" /><span className="sr-only">Add by voice</span></Button>
                                            </div>
                                          </div>
                                        )
                                      })}
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
    
    const AliasAccordionItem = ({ item, icon: IconComponent }) => {
        const itemKey = createSlug(item.name);
        const itemAliases = locales[itemKey] || {};
        const [isSuggesting, startSuggestion] = useTransition();

        const handleSuggestAliases = () => {
            startSuggestion(async () => {
                try {
                    const result = await suggestProductAliases({ productName: item.name });
                    if (result && result.aliases) {
                        setLocales(currentLocales => {
                            const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
                            if (!updatedLocales[itemKey]) updatedLocales[itemKey] = {};
                            
                            for (const lang in result.aliases) {
                                const newAliases = result.aliases[lang];
                                const existingAliases = new Set(Array.isArray(updatedLocales[itemKey][lang]) ? updatedLocales[itemKey][lang] : (updatedLocales[itemKey][lang] ? [updatedLocales[itemKey][lang]] : []));
                                newAliases.forEach(alias => existingAliases.add(alias));
                                updatedLocales[itemKey][lang] = Array.from(existingAliases);
                            }
                            return updatedLocales;
                        });
                        toast({ title: 'Suggestions Added!', description: `AI suggestions for "${item.name}" have been added locally.` });
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
                                        <Input placeholder={`Add ${lang} alias(es), comma-separated...`} value={newAliases[itemKey]?.[lang] || ''} onChange={(e) => setNewAliases(p => ({ ...p, [itemKey]: { ...(p[itemKey] || {}), [lang]: e.target.value } }))} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddAlias(itemKey, lang); } }} />
                                        <Button size="sm" onClick={() => handleAddAlias(itemKey, lang)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleVoiceAdd(itemKey, lang)} disabled={isListening}><Mic className="h-4 w-4" /><span className="sr-only">Add by voice</span></Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </AccordionContent>
            </AccordionItem>
        );
    };

    const renderAliasAccordion = (
      items: { id: string; name: string }[],
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
                       <AliasAccordionItem key={item.id} item={item} icon={icon} />
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
            </div>

            {useAppStore.getState().loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                    <span className="text-lg">Loading voice settings...</span>
                </div>
            ) : (
                <>
                    {activeTab === 'general' && renderGeneralCommands()}
                    {activeTab === 'products' && renderAliasAccordion(masterProducts, "Manage Product Aliases", "Add alternative names for products in different languages to improve voice recognition.", Package)}
                    {activeTab === 'stores' && renderAliasAccordion(stores, "Manage Store Aliases", "Add alternative names for your stores in different languages.", StoreIcon)}
                </>
            )}

            <div className="max-w-4xl mx-auto mt-8">
                <Button onClick={handleSaveAll} disabled={isProcessing} className="w-full" size="lg">
                    {isProcessing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving All Changes...</> : <><Save className="mr-2 h-4 w-4" />Save All Changes</>}
                </Button>
            </div>


            <Card className="max-w-4xl mx-auto">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Code className="h-5 w-5" />Raw JSON View</CardTitle>
                    <CardDescription>This is a read-only view of the local UI state that will be saved to the database.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                     <div>
                        <Label htmlFor="commands-json">Commands</Label>
                        <Textarea id="commands-json" readOnly value={JSON.stringify(commands, null, 2)} className="bg-muted font-mono text-xs h-96" />
                     </div>
                      <div>
                        <Label htmlFor="locales-json">Aliases</Label>
                        <Textarea id="locales-json" readOnly value={JSON.stringify(locales, null, 2)} className="bg-muted font-mono text-xs h-96" />
                     </div>
                </CardContent>
            </Card>
        </div>
    );
}

    

