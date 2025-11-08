
'use client';

import { useState, useTransition, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Loader2, PlusCircle, Save, X, Mic, MessageSquare, Code, Package, Store as StoreIcon, Trash2 } from 'lucide-react';
import { getCommands, saveCommands, getLocales, saveLocales } from '@/app/actions';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useFirebase } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

type CommandGroup = {
  display: string;
  reply: string;
};

type LocaleEntry = string | string[];
type Locales = Record<string, Record<string, LocaleEntry>>;

const createSlug = (text: string) => text.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');


export default function VoiceCommandsPage() {
    const [isProcessing, startTransition] = useTransition();
    const [activeTab, setActiveTab] = useState('general'); // 'general', 'products', or 'stores'

    const [commands, setCommands] = useState<Record<string, CommandGroup>>({});
    
    const [locales, setLocales] = useState<Locales>({});
    const [newAliases, setNewAliases] = useState<Record<string, Record<string, string>>>({});
    
    // State for the "Add New Command" dialog
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [newCommandKey, setNewCommandKey] = useState('');
    const [newCommandDisplay, setNewCommandDisplay] = useState('');
    const [newCommandReply, setNewCommandReply] = useState('');


    const { masterProducts, stores, fetchInitialData } = useAppStore();
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
    }, [toast, firestore, fetchInitialData]);

    const handleAddAlias = (itemKey: string, lang: string) => {
        const newAliasInput = newAliases[itemKey]?.[lang]?.trim();
        if(!newAliasInput) {
            toast({ variant: 'destructive', title: 'Cannot add empty alias' });
            return;
        }
        addAlias(itemKey, newAliasInput, lang);
        setNewAliases(prev => ({
            ...prev,
            [itemKey]: {
                ...prev[itemKey],
                [lang]: ''
            }
        }));
    };

    const addAlias = (key: string, newAliasString: string, lang: string) => {
        const aliasesToAdd = newAliasString.split(',').map(alias => alias.trim().toLowerCase()).filter(Boolean);
        if (aliasesToAdd.length === 0) return;

        let addedCount = 0;
        let duplicates: string[] = [];
        
        setLocales(currentLocales => {
            const updatedLocales = JSON.parse(JSON.stringify(currentLocales));
            if (!updatedLocales[key]) updatedLocales[key] = {};
            
            const existingAliases = Array.isArray(updatedLocales[key][lang]) ? updatedLocales[key][lang] as string[] : ([updatedLocales[key][lang]].filter(Boolean) as string[]);
            
            aliasesToAdd.forEach(newAlias => {
                if(!existingAliases.includes(newAlias)) {
                    existingAliases.push(newAlias);
                    addedCount++;
                } else {
                    duplicates.push(newAlias);
                }
            });
            updatedLocales[key][lang] = existingAliases.length === 1 ? existingAliases[0] : existingAliases;
            return updatedLocales;
        });
        
        if (duplicates.length > 0) {
             toast({ variant: 'destructive', title: 'Duplicate Item(s)', description: `"${duplicates.join(', ')}" already exist.` });
        }
        if (addedCount > 0) {
            const addedAliases = aliasesToAdd.filter(a => !duplicates.includes(a));
            toast({ title: 'Alias Added', description: `Added "${addedAliases.join(', ')}".` });
        }
    };

     const handleRemoveAlias = (itemKey: string, lang: string, aliasToRemove: string) => {
        setLocales(currentLocales => {
            const updatedLocales = JSON.parse(JSON.stringify(currentLocales)); // Deep copy
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
            
            // Clean up the item key if no languages are left
            if (updatedLocales[itemKey] && Object.keys(updatedLocales[itemKey]).length === 0) {
                delete updatedLocales[itemKey];
            }

            return updatedLocales;
        });
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
        if (commands[key]) {
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
        if (window.confirm(`Are you sure you want to permanently delete the "${commands[keyToDelete].display}" command? This cannot be undone.`)) {
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
            toast({ title: 'Command Deleted', description: `Remember to save your changes.` });
        }
    };


    const handleSaveAll = () => {
        startTransition(async () => {
            try {
                await Promise.all([saveCommands(commands), saveLocales(locales)]);
                toast({
                    title: 'Commands Saved!',
                    description: 'Your new voice commands and aliases have been saved successfully.',
                });
            } catch (error) {
                 toast({
                    variant: 'destructive',
                    title: 'Save Failed',
                    description: (error as Error).message || 'Could not save changes.',
                });
            }
        });
    };

    const handleVoiceAdd = (key: string, lang: string) => {
        if (!recognitionRef.current) {
            toast({ variant: 'destructive', title: 'Voice Not Supported', description: 'Your browser does not support speech recognition.' });
            return;
        }
        const recognition = recognitionRef.current;
        recognition.lang = lang || 'en-IN';
        recognition.onresult = (event) => addAlias(key, event.results[0][0].transcript.toLowerCase(), lang);
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
                                              <Button size="sm" variant="outline" onClick={() => handleVoiceAdd(key, lang === 'te' ? 'te-IN' : 'en-IN')} disabled={isListening}><Mic className="h-4 w-4" /><span className="sr-only">Add by voice</span></Button>
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
    
    const renderAliasAccordion = (
      items: { name: string }[],
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
                <AccordionItem value={itemKey} key={itemKey}>
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
                              <Input placeholder={`Add ${lang} alias(es), comma-separated...`} value={newAliases[itemKey]?.[lang] || ''} onChange={(e) => setNewAliases(p => ({ ...p, [itemKey]: { ...p[itemKey], [lang]: e.target.value } }))} onKeyDown={(e) => {if (e.key === 'Enter') { e.preventDefault(); handleAddAlias(itemKey, lang); }}} />
                              <Button size="sm" onClick={() => handleAddAlias(itemKey, lang)}><PlusCircle className="mr-2 h-4 w-4" /> Add</Button>
                              <Button size="sm" variant="outline" onClick={() => handleVoiceAdd(itemKey, lang === 'te' ? 'te-IN' : 'en-IN')} disabled={isListening}><Mic className="h-4 w-4" /><span className="sr-only">Add by voice</span></Button>
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
    );

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-8">
             <div className="text-center mb-12">
                <h1 className="text-4xl font-bold font-headline">Voice System Control</h1>
                <p className="text-lg text-muted-foreground mt-2">Manage phrases, aliases, and replies for all voice-activated actions.</p>
            </div>
            
            <div className="flex justify-center gap-2 mb-8">
                <Button variant={activeTab === 'general' ? 'default' : 'outline'} onClick={() => setActiveTab('general')}>General Commands</Button>
                <Button variant={activeTab === 'products' ? 'default' : 'outline'} onClick={() => setActiveTab('products')}>Product Aliases</Button>
                <Button variant={activeTab === 'stores' ? 'default' : 'outline'} onClick={() => setActiveTab('stores')}>Store Aliases</Button>
            </div>

            {isProcessing && Object.keys(commands).length === 0 && Object.keys(locales).length === 0 ? (
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
                    <CardDescription>This is a read-only view of the files that power the voice system.</CardDescription>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                     <div>
                        <Label htmlFor="commands-json">commands.json</Label>
                        <Textarea id="commands-json" readOnly value={JSON.stringify(commands, null, 2)} className="bg-muted font-mono text-xs h-96" />
                     </div>
                      <div>
                        <Label htmlFor="locales-json">locales.json</Label>
                        <Textarea id="locales-json" readOnly value={JSON.stringify(locales, null, 2)} className="bg-muted font-mono text-xs h-96" />
                     </div>
                </CardContent>
            </Card>
        </div>
    );
}
