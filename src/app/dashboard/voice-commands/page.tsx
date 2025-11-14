
<<<<<<< HEAD

'use client';

import { useState, useTransition, useEffect, useRef, useCallback } from 'react';
=======
'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
<<<<<<< HEAD
import { Loader2, PlusCircle, Save, X, Mic, MessageSquare, Code, Package, Store as StoreIcon, Trash2 } from 'lucide-react';
=======
import { Loader2, PlusCircle, Save, X, Mic, MessageSquare, Code, Package } from 'lucide-react';
import { getCommands, saveCommands, getLocales, saveLocales } from '@/app/actions';
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirebase } from '@/firebase';
<<<<<<< HEAD
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { collection, writeBatch, doc } from 'firebase/firestore';
import type { VoiceAlias, Locales } from '@/lib/locales';
import { CommandGroup, generalCommands as defaultGeneralCommands } from '@/lib/locales/commands';

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
        voiceAliases: initialAliases, 
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
=======

type CommandGroup = {
  display: string;
  reply: string;
  aliases: string[];
};

type LocaleEntry = string | string[];
type Locales = Record<string, Record<string, LocaleEntry>>;

const createSlug = (text: string) => text.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');


export default function VoiceCommandsPage() {
    const [isProcessing, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState('general'); // 'general' or 'products'

    const [commands, setCommands] = useState<Record<string, CommandGroup>>({});
    const [newCommands, setNewCommands] = useState<Record<string, string>>({});
    
    const [locales, setLocales] = useState<Locales>({});
    const [newAliases, setNewAliases] = useState<Record<string, Record<string, string>>>({});

    const { masterProducts, fetchInitialData } = useAppStore();
    const { firestore } = useFirebase();

    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef<SpeechRecognition | null>(null);

    const { toast } = useToast();

    useEffect(() => {
        startTransition(async () => {
            if (firestore) {
                await fetchInitialData(firestore);
            }
            const [fetchedCommands, fetchedLocales] = await Promise.all([getCommands(), getLocales()]);
            setCommands(fetchedCommands);
            setLocales(fetchedLocales);
        });

>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
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
<<<<<<< HEAD
    }, [toast]);


    const handleAddAlias = (itemKey: string, lang: string) => {
        const newAliasInput = newAliases[itemKey]?.[lang]?.trim();
        if (!newAliasInput) {
            toast({ variant: 'destructive', title: 'Cannot add empty alias' });
            return;
        }

        // Use a Set to ensure all new aliases are unique before processing
        const aliasesToAdd = [...new Set(newAliasInput.split(',').map(alias => alias.trim().toLowerCase()).filter(Boolean))];
        
=======
    }, [toast, firestore, fetchInitialData]);

    const handleAddCommand = (actionKey: string) => {
        const newAliasInput = newCommands[actionKey]?.trim();
        if (!newAliasInput) {
            toast({ variant: 'destructive', title: 'Cannot add empty command' });
            return;
        }
        addAlias('commands', actionKey, newAliasInput);
        setNewCommands(prev => ({...prev, [actionKey]: ''}));
    };

    const handleAddProductAlias = (productKey: string, lang: string) => {
        const newAliasInput = newAliases[productKey]?.[lang]?.trim();
        if(!newAliasInput) {
            toast({ variant: 'destructive', title: 'Cannot add empty alias' });
            return;
        }
        addAlias('locales', productKey, newAliasInput, lang);
        setNewAliases(prev => ({
            ...prev,
            [productKey]: {
                ...prev[productKey],
                [lang]: ''
            }
        }));
    };

    const addAlias = (type: 'commands' | 'locales', key: string, newAliasString: string, lang?: string) => {
        const aliasesToAdd = newAliasString.split(',').map(alias => alias.trim().toLowerCase()).filter(Boolean);
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
        if (aliasesToAdd.length === 0) return;

        let addedCount = 0;
        let duplicates: string[] = [];

<<<<<<< HEAD
        setLocales(currentLocales => {
            const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
            if (!updatedLocales[itemKey]) updatedLocales[itemKey] = {};
            
            const existingAliases = Array.isArray(updatedLocales[itemKey][lang]) ? updatedLocales[itemKey][lang] as string[] : ([updatedLocales[itemKey][lang]].filter(Boolean) as string[]);
            
            aliasesToAdd.forEach(newAlias => {
                if(!existingAliases.includes(newAlias)) {
                    existingAliases.push(newAlias);
                    addedCount++;
                } else {
                    duplicates.push(newAlias);
                }
            });
            updatedLocales[itemKey][lang] = existingAliases.length === 1 ? existingAliases[0] : existingAliases;
            return updatedLocales;
        });
=======
        if (type === 'commands') {
            setCommands(currentCommands => {
                const updatedCommands = JSON.parse(JSON.stringify(currentCommands));
                aliasesToAdd.forEach(newAlias => {
                    const isDuplicate = Object.values(updatedCommands).some(group => group.aliases.includes(newAlias));
                    if (!updatedCommands[key].aliases.includes(newAlias) && !isDuplicate) {
                        updatedCommands[key].aliases.push(newAlias);
                        addedCount++;
                    } else { duplicates.push(newAlias); }
                });
                return updatedCommands;
            });
        } else if (type === 'locales' && lang) {
            setLocales(currentLocales => {
                const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
                if (!updatedLocales[key]) updatedLocales[key] = {};
                
                const existingAliases = Array.isArray(updatedLocales[key][lang]) ? updatedLocales[key][lang] : [updatedLocales[key][lang]].filter(Boolean);
                
                aliasesToAdd.forEach(newAlias => {
                    if(!existingAliases.includes(newAlias)) {
                        existingAliases.push(newAlias);
                        addedCount++;
                    } else {
                        duplicates.push(newAlias);
                    }
                });
                updatedLocales[key][lang] = existingAliases;
                return updatedLocales;
            });
        }
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584

        if (duplicates.length > 0) {
             toast({ variant: 'destructive', title: 'Duplicate Item(s)', description: `"${duplicates.join(', ')}" already exist.` });
        }
        if (addedCount > 0) {
<<<<<<< HEAD
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
            const allItemsMap = new Map([
                ...masterProducts.map(p => [createSlug(p.name), 'product']),
                ...stores.map(s => [createSlug(s.name), 'store']),
                ...Object.keys(commands).map(c => [c, 'command'])
            ]);

            const originalAliasStrings = new Set(initialAliases.map(a => `${a.key}|${a.language}|${a.alias}`));

            const currentAliasSet = new Set<string>();
            for (const key in locales) {
                const langMap = locales[key];
                for (const lang in langMap) {
                    const aliases = Array.isArray(langMap[lang]) ? langMap[lang] as string[] : [langMap[lang] as string];
                    aliases.forEach(alias => {
                        if (alias) currentAliasSet.add(`${key}|${lang}|${alias}`);
                    });
                }
            }

            const originalCommandStrings = new Set<string>();
            Object.entries(initialCommands).forEach(([key, group]) => {
                originalCommandStrings.add(`${key}|display|${group.display}`);
                originalCommandStrings.add(`${key}|reply|${group.reply}`);
            });
            
            const currentCommandSet = new Set<string>();
            Object.entries(commands).forEach(([key, group]) => {
                currentCommandSet.add(`${key}|display|${group.display}`);
                currentCommandSet.add(`${key}|reply|${group.reply}`);
            });
            
            // --- ALIAS DIFF ---
            const aliasesToAdd: Omit<VoiceAlias, 'id'>[] = [];
            currentAliasSet.forEach(aliasString => {
                if (!originalAliasStrings.has(aliasString)) {
                    const [key, language, alias] = aliasString.split('|');
                    aliasesToAdd.push({ key, language, alias, type: allItemsMap.get(key) || 'command' });
                }
            });

            const aliasesToDelete: VoiceAlias[] = [];
            initialAliases.forEach(aliasDoc => {
                const aliasString = `${aliasDoc.key}|${aliasDoc.language}|${aliasDoc.alias}`;
                if (!currentAliasSet.has(aliasString)) {
                    aliasesToDelete.push(aliasDoc);
                }
            });
            
            // --- COMMAND DIFF ---
            const commandsToAdd: { key: string; display: string; reply: string; }[] = [];
            const commandsToDelete: string[] = Object.keys(initialCommands).filter(key => !commands[key]);

            Object.entries(commands).forEach(([key, group]) => {
                if (!initialCommands[key] || initialCommands[key].display !== group.display || initialCommands[key].reply !== group.reply) {
                    commandsToAdd.push({ key, ...group });
                }
            });


            if (aliasesToAdd.length === 0 && aliasesToDelete.length === 0 && commandsToAdd.length === 0 && commandsToDelete.length === 0) {
                toast({ title: 'No Changes to Save' });
                return;
            }

            const batch = writeBatch(firestore);
            
            // --- BATCH ALIASES ---
            const aliasCollectionRef = collection(firestore, 'voiceAliases');
            aliasesToDelete.forEach(aliasDoc => {
                if (aliasDoc.id) batch.delete(doc(aliasCollectionRef, aliasDoc.id));
            });
            aliasesToAdd.forEach(newAliasData => {
                batch.set(doc(aliasCollectionRef), newAliasData);
            });
            
            // --- BATCH COMMANDS ---
            const commandCollectionRef = collection(firestore, 'voiceCommands');
            commandsToDelete.forEach(key => batch.delete(doc(commandCollectionRef, key)));
            commandsToAdd.forEach(cmd => {
                batch.set(doc(commandCollectionRef, cmd.key), { display: cmd.display, reply: cmd.reply });
            });
            
            try {
                await batch.commit();
                toast({
                    title: 'Changes Saved!',
                    description: `Your voice command configuration has been updated.`,
                });
                await fetchInitialData(firestore); // Re-fetch the latest state
=======
            toast({ title: 'Alias Added', description: `Added "${aliasesToAdd.join(', ')}".` });
        }
    };


    const handleRemoveCommand = (actionKey: string, aliasToRemove: string) => {
        setCommands(currentCommands => {
            const updatedCommands = { ...currentCommands };
            if (updatedCommands[actionKey]) {
                 updatedCommands[actionKey] = {
                    ...updatedCommands[actionKey],
                    aliases: updatedCommands[actionKey].aliases.filter(alias => alias !== aliasToRemove),
                 };
            }
            return updatedCommands;
        });
    };

     const handleRemoveProductAlias = (productKey: string, lang: string, aliasToRemove: string) => {
        setLocales(currentLocales => {
            const updatedLocales = { ...currentLocales };
            if (updatedLocales[productKey] && Array.isArray(updatedLocales[productKey][lang])) {
                (updatedLocales[productKey][lang] as string[]) = (updatedLocales[productKey][lang] as string[]).filter(alias => alias !== aliasToRemove);
            }
            return updatedLocales;
        });
    };

    const handleReplyChange = (actionKey: string, newReply: string) => {
        setCommands(currentCommands => ({
            ...currentCommands,
            [actionKey]: { ...currentCommands[actionKey], reply: newReply }
        }));
    };

    const handleSaveAll = () => {
        startTransition(async () => {
            try {
                await Promise.all([saveCommands(commands), saveLocales(locales)]);
                toast({
                    title: 'Commands Saved!',
                    description: 'Your new voice commands and aliases have been saved successfully.',
                });
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
            } catch (error) {
                 toast({
                    variant: 'destructive',
                    title: 'Save Failed',
<<<<<<< HEAD
                    description: (error as Error).message || 'Could not save changes to Firestore.',
                });
                console.error(error);
=======
                    description: (error as Error).message || 'Could not save changes.',
                });
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
            }
        });
    };

<<<<<<< HEAD
    const handleVoiceAdd = (key: string, lang: string) => {
        if (!recognitionRef.current) {
            toast({ variant: 'destructive', title: 'Voice Not Supported' });
            return;
        }
        const recognition = recognitionRef.current;
        const recognitionLang = lang === 'te' ? 'te-IN' : 'en-IN';
        recognition.lang = recognitionLang;
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript.toLowerCase();
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
=======
    const handleVoiceAdd = (type: 'commands' | 'locales', key: string, lang?: string) => {
        if (!recognitionRef.current) {
            toast({ variant: 'destructive', title: 'Voice Not Supported', description: 'Your browser does not support speech recognition.' });
            return;
        }
        const recognition = recognitionRef.current;
        recognition.lang = lang || 'en-IN';
        recognition.onresult = (event) => addAlias(type, key, event.results[0][0].transcript.toLowerCase(), lang);
        recognition.start();
    };
    
    const isTemplateKey = (key: string) => key === 'orderItem';
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584

    const renderGeneralCommands = () => (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
<<<<<<< HEAD
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
=======
                <CardTitle>Manage General Commands & Replies</CardTitle>
                <CardDescription>
                    Each action can be triggered by multiple phrases. For ordering, use {'{product}'} and {'{quantity}'} as placeholders.
                </CardDescription>
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
            </CardHeader>
            <CardContent className="space-y-6">
                <Accordion type="multiple" className="w-full">
                    {Object.entries(commands).map(([key, group]) => (
                        <AccordionItem value={key} key={key}>
                            <AccordionTrigger>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-lg">{group.display}</span>
<<<<<<< HEAD
=======
                                    {isTemplateKey(key) && <Badge variant="outline">Template</Badge>}
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
                                </div>
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="space-y-6 p-4 bg-muted/50 rounded-lg">
<<<<<<< HEAD
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
=======
                                    <div className="space-y-2">
                                        <Label htmlFor={`reply-${key}`} className="flex items-center gap-2 font-semibold"><MessageSquare className="h-4 w-4" />App's Reply</Label>
                                        <Input id={`reply-${key}`} value={group.reply || ''} onChange={(e) => handleReplyChange(key, e.target.value)} placeholder="Enter what the app should say..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-semibold">User's Phrases (Aliases)</Label>
                                        <div className="flex flex-wrap gap-2">
                                            {group.aliases.map((alias, index) => (
                                                <Badge key={index} variant={isTemplateKey(key) ? "default" : "secondary"} className="relative pr-6 group text-base py-1">
                                                    {alias}
                                                    <button onClick={() => handleRemoveCommand(key, alias)} className="absolute top-1/2 -translate-y-1/2 right-1 rounded-full p-0.5 bg-background/50 hover:bg-background text-muted-foreground hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <X className="h-3 w-3" /><span className="sr-only">Remove {alias}</span>
                                                    </button>
                                                </Badge>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 pt-4 border-t">
                                        <Input placeholder={isTemplateKey(key) ? "e.g., I want {quantity} of {product}" : "Add new phrase(s), comma-separated..."} value={newCommands[key] || ''} onChange={(e) => setNewCommands(prev => ({...prev, [key]: e.target.value}))} onKeyDown={(e) => {if (e.key === 'Enter') { e.preventDefault(); handleAddCommand(key);}}}/>
                                        <Button size="sm" onClick={() => handleAddCommand(key)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                                        <Button size="sm" variant="outline" onClick={() => handleVoiceAdd('commands', key)} disabled={isListening}><Mic className="h-4 w-4" /><span className="sr-only">Add by voice</span></Button>
                                    </div>
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    ))}
                </Accordion>
            </CardContent>
        </Card>
    );
<<<<<<< HEAD
    
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
            {items.map((item) => {
              const itemKey = createSlug(item.name);
              const itemAliases = locales[itemKey] || {};
              const IconComponent = icon;
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
                      {['en', 'te'].map(lang => {
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
                              <Input placeholder={`Add ${lang} alias(es), comma-separated...`} value={newAliases[itemKey]?.[lang] || ''} onChange={(e) => setNewAliases(p => ({ ...p, [itemKey]: { ...(p[itemKey] || {}), [lang]: e.target.value } }))} onKeyDown={(e) => {if (e.key === 'Enter') { e.preventDefault(); handleAddAlias(itemKey, lang); }}} />
                              <Button size="sm" onClick={() => handleAddAlias(itemKey, lang)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                              <Button size="sm" variant="outline" onClick={() => handleVoiceAdd(itemKey, lang)} disabled={isListening}><Mic className="h-4 w-4" /><span className="sr-only">Add by voice</span></Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              )
            })}
          </Accordion>
        </CardContent>
      </Card>
=======

    const renderProductAliases = () => (
        <Card className="max-w-4xl mx-auto">
            <CardHeader>
                <CardTitle>Manage Product Aliases</CardTitle>
                <CardDescription>
                    Add alternative names for products in different languages to improve voice recognition.
                </CardDescription>
            </CardHeader>
            <CardContent>
                 <Accordion type="multiple" className="w-full">
                    {masterProducts.map((product) => {
                        const productKey = createSlug(product.name);
                        const productAliases = locales[productKey] || {};
                        return (
                            <AccordionItem value={productKey} key={productKey}>
                                <AccordionTrigger>
                                    <div className="flex items-center gap-2">
                                        <Package className="h-4 w-4 text-muted-foreground" />
                                        <span className="font-semibold text-base">{product.name}</span>
                                    </div>
                                </AccordionTrigger>
                                <AccordionContent>
                                    <div className="space-y-6 p-4 bg-muted/50 rounded-lg">
                                        {['en', 'te'].map(lang => {
                                            const currentAliases: string[] = Array.isArray(productAliases[lang]) ? productAliases[lang] as string[] : (productAliases[lang] ? [productAliases[lang] as string] : []);
                                            return (
                                                <div key={lang} className="space-y-2">
                                                    <Label className="font-semibold text-sm uppercase">{lang} Aliases</Label>
                                                    <div className="flex flex-wrap gap-2">
                                                        {currentAliases.map((alias) => (
                                                            <Badge key={alias} variant="secondary" className="relative pr-6 group text-base py-1">
                                                                {alias}
                                                                <button onClick={() => handleRemoveProductAlias(productKey, lang, alias)} className="absolute top-1/2 -translate-y-1/2 right-1 rounded-full p-0.5 bg-background/50 hover:bg-background text-muted-foreground hover:text-destructive-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <X className="h-3 w-3" /><span className="sr-only">Remove {alias}</span>
                                                                </button>
                                                            </Badge>
                                                        ))}
                                                        {currentAliases.length === 0 && <p className="text-xs text-muted-foreground">No aliases yet.</p>}
                                                    </div>
                                                     <div className="flex items-center gap-2 pt-2 border-t">
                                                        <Input placeholder={`Add ${lang} alias(es), comma-separated...`} value={newAliases[productKey]?.[lang] || ''} onChange={(e) => setNewAliases(p => ({ ...p, [productKey]: { ...p[productKey], [lang]: e.target.value } }))} onKeyDown={(e) => {if (e.key === 'Enter') { e.preventDefault(); handleAddProductAlias(productKey, lang); }}} />
                                                        <Button size="sm" onClick={() => handleAddProductAlias(productKey, lang)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                                                         <Button size="sm" variant="outline" onClick={() => handleVoiceAdd('locales', productKey, lang === 'te' ? 'te-IN' : 'en-IN')} disabled={isListening}><Mic className="h-4 w-4" /><span className="sr-only">Add by voice</span></Button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </AccordionContent>
                            </AccordionItem>
                        )
                    })}
                 </Accordion>
            </CardContent>
        </Card>
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
    );

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-8">
             <div className="text-center mb-12">
<<<<<<< HEAD
                <h1 className="text-4xl font-bold font-headline">AI Training Center</h1>
                <p className="text-lg text-muted-foreground mt-2">This is the brain of your app. Add aliases and commands to make the AI smarter.</p>
=======
                <h1 className="text-4xl font-bold font-headline">Voice System Control</h1>
                <p className="text-lg text-muted-foreground mt-2">Manage phrases, aliases, and replies for all voice-activated actions.</p>
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
            </div>
            
            <div className="flex justify-center gap-2 mb-8">
                <Button variant={activeTab === 'general' ? 'default' : 'outline'} onClick={() => setActiveTab('general')}>General Commands</Button>
                <Button variant={activeTab === 'products' ? 'default' : 'outline'} onClick={() => setActiveTab('products')}>Product Aliases</Button>
<<<<<<< HEAD
                <Button variant={activeTab === 'stores' ? 'default' : 'outline'} onClick={() => setActiveTab('stores')}>Store Aliases</Button>
            </div>

            {useAppStore.getState().loading ? (
=======
            </div>

            {isProcessing && Object.keys(commands).length === 0 && Object.keys(locales).length === 0 ? (
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="mr-2 h-8 w-8 animate-spin" />
                    <span className="text-lg">Loading voice settings...</span>
                </div>
            ) : (
                <>
                    {activeTab === 'general' && renderGeneralCommands()}
<<<<<<< HEAD
                    {activeTab === 'products' && renderAliasAccordion(masterProducts, "Manage Product Aliases", "Add alternative names for products in different languages to improve voice recognition.", Package)}
                    {activeTab === 'stores' && renderAliasAccordion(stores, "Manage Store Aliases", "Add alternative names for your stores in different languages.", StoreIcon)}
=======
                    {activeTab === 'products' && renderProductAliases()}
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
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
<<<<<<< HEAD
                    <CardDescription>This is a read-only view of the local UI state that will be saved to the database.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                     <div>
                        <Label htmlFor="commands-json">Commands</Label>
                        <Textarea id="commands-json" readOnly value={JSON.stringify(commands, null, 2)} className="bg-muted font-mono text-xs h-96" />
                     </div>
                      <div>
                        <Label htmlFor="locales-json">Aliases</Label>
=======
                    <CardDescription>This is a read-only view of the files that power the voice system.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                     <div>
                        <Label htmlFor="commands-json">commands.json</Label>
                        <Textarea id="commands-json" readOnly value={JSON.stringify(commands, null, 2)} className="bg-muted font-mono text-xs h-96" />
                     </div>
                      <div>
                        <Label htmlFor="locales-json">locales.json</Label>
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
                        <Textarea id="locales-json" readOnly value={JSON.stringify(locales, null, 2)} className="bg-muted font-mono text-xs h-96" />
                     </div>
                </CardContent>
            </Card>
        </div>
    );
}
<<<<<<< HEAD


    
=======
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
