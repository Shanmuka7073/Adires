
'use client';

import { useState, useTransition, useMemo, useEffect, useRef } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, doc, updateDoc, deleteDoc, setDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import type { FailedVoiceCommand, VoiceAliasGroup, MenuItem } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    MicOff, 
    Sparkles, 
    Trash2, 
    CheckCircle2, 
    RefreshCw, 
    Loader2, 
    Bot, 
    Plus,
    Search,
    ShoppingBag,
    AlertCircle,
    ArrowRight,
    Edit3,
    ChevronUp,
    ChevronDown,
    Eraser
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { suggestAlias } from '@/ai/flows/suggest-alias-flow';
import { suggestProductAliases } from '@/ai/flows/suggest-product-aliases-flow';
import { extractAliasesFromText } from '@/ai/flows/extract-aliases-flow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

function ManageAliasDialog({ group, isOpen, onOpenChange }: { group: VoiceAliasGroup, isOpen: boolean, onOpenChange: (open: boolean) => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, startSave] = useTransition();
    const [isExtracting, startExtract] = useTransition();
    const [isClearing, startClear] = useTransition();
    
    const [bulkInput, setBulkInput] = useState('');
    const [targetLang, setTargetLang] = useState<'en' | 'te' | 'hi'>('en');
    const [extractionText, setExtractionText] = useState('');
    const inventoryScrollRef = useRef<HTMLDivElement>(null);

    const handleBulkAdd = () => {
        if (!bulkInput.trim() || !firestore) return;
        startSave(async () => {
            const newAliases = bulkInput.split(/[,\n]/).map(s => s.trim()).filter(s => s.length > 1);
            const docRef = doc(firestore, 'voiceAliasGroups', group.id);
            const current = group[targetLang] || [];
            const merged = [...new Set([...current, ...newAliases])];
            
            await updateDoc(docRef, { [targetLang]: merged, updatedAt: serverTimestamp() });
            toast({ title: "Bulk Sync Complete", description: `Added ${newAliases.length} aliases to ${targetLang.toUpperCase()}` });
            setBulkInput('');
        });
    };

    const handleClearBucket = () => {
        if (!firestore) return;
        if (!confirm(`Are you sure you want to clear all ${targetLang.toUpperCase()} aliases for ${group.id}?`)) return;
        
        startClear(async () => {
            const docRef = doc(firestore, 'voiceAliasGroups', group.id);
            await updateDoc(docRef, { [targetLang]: [], updatedAt: serverTimestamp() });
            toast({ title: "Bucket Cleared" });
        });
    }

    const handleAIExtract = () => {
        if (!extractionText.trim()) return;
        startExtract(async () => {
            try {
                const result = await extractAliasesFromText({ textBlock: extractionText, targetProduct: group.id });
                const docRef = doc(firestore, 'voiceAliasGroups', group.id);
                
                await updateDoc(docRef, {
                    en: [...new Set([...(group.en || []), ...result.en])],
                    te: [...new Set([...(group.te || []), ...result.te])],
                    hi: [...new Set([...(group.hi || []), ...result.hi])],
                    updatedAt: serverTimestamp()
                });
                
                toast({ title: "Linguistic Extraction Success", description: "AI matched and imported new aliases." });
                setExtractionText('');
            } catch (e) {
                toast({ variant: 'destructive', title: "Extraction Failed" });
            }
        });
    };

    const handleScroll = (dir: 'top' | 'bottom') => {
        const viewport = inventoryScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTo({
                top: dir === 'top' ? 0 : viewport.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    const currentList = group[targetLang] || [];
    const displayList = currentList.slice(0, 500);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-3xl rounded-[2.5rem] border-0 shadow-2xl overflow-hidden p-0 bg-[#FDFCF7] max-h-[90vh] flex flex-col">
                <DialogHeader className="p-6 sm:p-8 bg-white border-b shrink-0 text-left">
                    <div className="flex justify-between items-start">
                        <div className="min-w-0">
                            <DialogTitle className="text-xl sm:text-2xl font-black uppercase tracking-tight truncate pr-4">{group.id}</DialogTitle>
                            <DialogDescription className="font-bold text-[10px] uppercase opacity-40">Comprehensive Alias Suite</DialogDescription>
                        </div>
                        <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-[10px] px-3 h-6 uppercase shrink-0">Total: {(group.en?.length || 0) + (group.te?.length || 0) + (group.hi?.length || 0)}</Badge>
                    </div>
                </DialogHeader>

                <ScrollArea className="flex-1">
                    <Tabs defaultValue="manual" className="w-full">
                        <TabsList className="bg-black/5 mx-4 sm:mx-8 mt-6 p-1 rounded-xl border h-auto flex flex-wrap sm:flex-nowrap">
                            <TabsTrigger value="manual" className="flex-1 rounded-lg font-black text-[10px] uppercase tracking-widest px-2 sm:px-6 h-10">Manual & Bulk</TabsTrigger>
                            <TabsTrigger value="ai" className="flex-1 rounded-lg font-black text-[10px] uppercase tracking-widest px-2 sm:px-6 h-10">AI Extractor</TabsTrigger>
                        </TabsList>

                        <TabsContent value="manual" className="p-4 sm:p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="flex justify-between items-end px-1">
                                    <Label className="text-[10px] font-black uppercase opacity-40">Bulk Import Tool</Label>
                                    <div className="flex gap-1 bg-black/5 p-1 rounded-lg">
                                        {(['en', 'te', 'hi'] as const).map(l => (
                                            <button 
                                                key={l} 
                                                onClick={() => setTargetLang(l)}
                                                className={cn("px-3 h-6 rounded-md text-[9px] font-black uppercase transition-all", targetLang === l ? "bg-white shadow-sm text-primary" : "text-gray-400")}
                                            >
                                                {l}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <Textarea 
                                    placeholder="Paste aliases here..." 
                                    value={bulkInput}
                                    onChange={e => setBulkInput(e.target.value)}
                                    className="min-h-[120px] rounded-2xl border-2 font-bold bg-white"
                                />
                                <div className="flex gap-2">
                                    <Button onClick={handleBulkAdd} disabled={isSaving || !bulkInput.trim()} className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                                        {isSaving ? <Loader2 className="animate-spin h-4 w-4" /> : <Plus className="h-4 w-4 mr-2" />}
                                        Sync Bulk List
                                    </Button>
                                    <Button variant="ghost" size="icon" onClick={handleClearBucket} disabled={isClearing || currentList.length === 0} className="h-12 w-12 rounded-xl text-red-500 bg-red-50 hover:bg-red-100">
                                        <Eraser className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center px-1">
                                    <Label className="text-[10px] font-black uppercase opacity-40">
                                        Current Inventory ({currentList.length})
                                    </Label>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleScroll('top')} className="h-6 w-6 rounded-md bg-black/5 flex items-center justify-center hover:bg-black/10"><ChevronUp className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => handleScroll('bottom')} className="h-6 w-6 rounded-md bg-black/5 flex items-center justify-center hover:bg-black/10"><ChevronDown className="h-3.5 w-3.5" /></button>
                                    </div>
                                </div>
                                <ScrollArea ref={inventoryScrollRef} className="h-64 rounded-2xl border-2 bg-white p-4">
                                    <div className="flex flex-wrap gap-2">
                                        {displayList.map(a => (
                                            <Badge key={a} variant="secondary" className="rounded-lg h-7 font-bold text-[10px] uppercase">{a}</Badge>
                                        ))}
                                        {currentList.length === 0 && <p className="text-[10px] font-black uppercase opacity-20 py-10 text-center w-full">Empty bucket</p>}
                                    </div>
                                </ScrollArea>
                            </div>
                        </TabsContent>

                        <TabsContent value="ai" className="p-4 sm:p-8 space-y-6">
                            <div className="p-6 rounded-[2rem] bg-indigo-50 border-2 border-indigo-100 flex gap-4 items-start">
                                <div className="h-10 w-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shrink-0"><Bot className="h-5 w-5" /></div>
                                <div>
                                    <h4 className="font-black uppercase text-xs text-indigo-900 tracking-tight">Linguistic Deep Scan</h4>
                                    <p className="text-[10px] font-bold text-indigo-700/60 leading-relaxed uppercase mt-1">AI will extract nicknames and slang from any text block.</p>
                                </div>
                            </div>
                            <Textarea 
                                placeholder="Paste text block here..." 
                                value={extractionText}
                                onChange={e => setExtractionText(e.target.value)}
                                className="min-h-[200px] rounded-2xl border-2 font-medium bg-white"
                            />
                            <Button onClick={handleAIExtract} disabled={isExtracting || !extractionText.trim()} className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-200">
                                {isExtracting ? <Loader2 className="animate-spin h-5 w-5" /> : <Sparkles className="h-4 w-4 mr-2" />}
                                Extract Aliases with AI
                            </Button>
                        </TabsContent>
                    </Tabs>
                    <div className="h-10" />
                </ScrollArea>
            </DialogContent>
        </Dialog>
    );
}

export default function VoiceIntelligencePage() {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSuggesting, startSuggest] = useTransition();
    const [isGeneratingAliases, startGenAliases] = useTransition();
    const [searchTerm, setSearchTerm] = useState('');
    const [inventorySearch, setInventorySearch] = useState('');
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [prefilledName, setPrefilledName] = useState('');
    const [selectedGroupForEdit, setSelectedGroupForEdit] = useState<VoiceAliasGroup | null>(null);
    const platformInventoryScrollRef = useRef<HTMLDivElement>(null);

    // --- FAILED COMMANDS LOGIC ---
    const failedQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'), limit(50)) : null, 
    [firestore]);
    const { data: failedCommands, isLoading: failedLoading, refetch: refetchFailed } = useCollection<FailedVoiceCommand>(failedQuery);

    // --- ALIAS GROUPS LOGIC ---
    const aliasesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'voiceAliasGroups'), orderBy('id', 'asc')) : null, 
    [firestore]);
    const { data: aliasGroups, isLoading: aliasesLoading } = useCollection<VoiceAliasGroup>(aliasesQuery);

    // --- PLATFORM INVENTORY SCANNER ---
    const [masterItems, setMasterItems] = useState<string[]>([]);
    const [isScanningInventory, setIsScanningInventory] = useState(false);

    const scanPlatformInventory = async () => {
        if (!firestore) return;
        setIsScanningInventory(true);
        try {
            const storesSnap = await getDocs(collection(firestore, 'stores'));
            const itemNames = new Set<string>();
            for (const sDoc of storesSnap.docs) {
                const menuSnap = await getDocs(collection(firestore, `stores/${sDoc.id}/menus`));
                menuSnap.docs.forEach(m => {
                    const items = m.data().items as MenuItem[];
                    if (items) items.forEach(it => {
                        if (it.name) itemNames.add(it.name);
                    });
                });
            }
            setMasterItems(Array.from(itemNames).sort());
        } catch (e) {
            console.error("Inventory scan failed", e);
        } finally {
            setIsScanningInventory(false);
        }
    };

    useEffect(() => {
        scanPlatformInventory();
    }, [firestore]);

    const handleSuggest = (cmd: FailedVoiceCommand) => {
        if (!firestore) return;
        startSuggest(async () => {
            try {
                const result = await suggestAlias({
                    commandText: cmd.text,
                    language: cmd.lang,
                    itemNames: masterItems
                });

                if (result.isSuggestionAvailable) {
                    await updateDoc(doc(firestore, 'failedCommands', cmd.id), {
                        suggestion: result.suggestedKey,
                        status: 'resolved'
                    });
                    toast({ title: "Fix Suggested", description: `Matched to: ${result.suggestedKey}` });
                } else {
                    await updateDoc(doc(firestore, 'failedCommands', cmd.id), { status: 'ignored' });
                    toast({ variant: 'destructive', title: "No Match", description: "AI couldn't find a confident link." });
                }
            } catch (e) {
                toast({ variant: 'destructive', title: "AI Error" });
            }
        });
    };

    const handleGenerateGroup = (productName: string) => {
        if (!firestore) return;
        startGenAliases(async () => {
            try {
                const result = await suggestProductAliases({ productName });
                const groupRef = doc(firestore, 'voiceAliasGroups', productName);
                await setDoc(groupRef, {
                    id: productName,
                    en: result.aliases.en,
                    te: result.aliases.te,
                    hi: result.aliases.hi,
                    updatedAt: serverTimestamp()
                } as VoiceAliasGroup);
                toast({ title: "Global Entry Live", description: `Multilingual aliases added for ${productName}` });
                setIsAddingNew(false);
                setPrefilledName('');
            } catch (e) {
                toast({ variant: 'destructive', title: "Generation Failed" });
            }
        });
    };

    const handleInventoryScroll = (dir: 'top' | 'bottom') => {
        const viewport = platformInventoryScrollRef.current?.querySelector('[data-radix-scroll-area-viewport]');
        if (viewport) {
            viewport.scrollTo({
                top: dir === 'top' ? 0 : viewport.scrollHeight,
                behavior: 'smooth'
            });
        }
    };

    const filteredAliases = useMemo(() => {
        if (!aliasGroups) return [];
        return aliasGroups.filter(g => g.id.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [aliasGroups, searchTerm]);

    const itemsNeedingAliases = useMemo(() => {
        return masterItems.filter(name => {
            const matchesSearch = name.toLowerCase().includes(inventorySearch.toLowerCase());
            return matchesSearch;
        });
    }, [masterItems, inventorySearch]);

    return (
        <div className="container mx-auto py-6 sm:py-12 px-4 md:px-6 space-y-12 pb-32 animate-in fade-in duration-500 text-left">
            {selectedGroupForEdit && (
                <ManageAliasDialog 
                    group={selectedGroupForEdit}
                    isOpen={!!selectedGroupForEdit}
                    onOpenChange={(o) => !o && setSelectedGroupForEdit(null)}
                />
            )}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-4xl sm:text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950 text-left">Voice Intel</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40 text-left">System-wide NLU Training Center</p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <Button variant="outline" size="sm" onClick={scanPlatformInventory} disabled={isScanningInventory} className="flex-1 sm:flex-none rounded-full h-10 px-4 border-2 font-black text-[10px] uppercase tracking-widest shadow-sm bg-white">
                        <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isScanningInventory && "animate-spin")} /> Re-Scan
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="failed" className="w-full">
                <TabsList className="bg-black/5 p-1.5 rounded-[1.5rem] border mb-8 h-auto w-full sm:w-auto overflow-x-auto no-scrollbar flex sm:inline-flex">
                    <TabsTrigger value="failed" className="flex-1 sm:flex-none rounded-xl font-black text-[10px] uppercase tracking-widest px-4 sm:px-8 h-10">Failed Commands</TabsTrigger>
                    <TabsTrigger value="aliases" className="flex-1 sm:flex-none rounded-xl font-black text-[10px] uppercase tracking-widest px-4 sm:px-8 h-10">Global Aliases</TabsTrigger>
                </TabsList>

                <TabsContent value="failed" className="animate-in slide-in-from-bottom-2 duration-500">
                    <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-red-50 border-b border-red-100 pb-6 text-left">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-red-900 flex items-center gap-2">
                                        <MicOff className="h-4 w-4" /> Error Log
                                    </CardTitle>
                                    <CardDescription className="hidden sm:block text-[10px] font-bold text-red-700/60 uppercase">Commands the system failed to parse</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={() => refetchFailed && refetchFailed()} className="rounded-full h-8 px-3 text-red-900 hover:bg-red-100">
                                    <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", failedLoading && "animate-spin")} />
                                </Button>
                            </div>
                        </CardHeader>
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-black/5">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase pl-6 min-w-[200px] text-left">Transcript</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase text-left">Lang</TableHead>
                                        <TableHead className="text-right text-[10px] font-black uppercase pr-6">AI Fix</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {!failedCommands || failedCommands.length === 0 ? (
                                        <TableRow><TableCell colSpan={3} className="py-20 text-center opacity-30 font-black uppercase text-xs">No failed commands</TableCell></TableRow>
                                    ) : failedCommands.map(cmd => (
                                        <TableRow key={cmd.id} className="border-b border-black/5 hover:bg-muted/30">
                                            <TableCell className="py-6 pl-6 text-left">
                                                <p className="font-black text-sm text-gray-950 italic">"{cmd.text}"</p>
                                                <p className="text-[8px] font-bold opacity-40 uppercase mt-1">{format(cmd.timestamp?.toDate() || new Date(), 'Pp')}</p>
                                            </TableCell>
                                            <TableCell className="text-left">
                                                <Badge variant="outline" className="text-[8px] font-black uppercase">{cmd.lang}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                {cmd.status === 'resolved' ? (
                                                    <Badge className="bg-green-500 text-white font-black text-[8px] uppercase">LINKED: {cmd.suggestion}</Badge>
                                                ) : (
                                                    <Button 
                                                        size="sm" 
                                                        onClick={() => handleSuggest(cmd)} 
                                                        disabled={isSuggesting}
                                                        className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[9px] uppercase tracking-widest px-4 shadow-lg shadow-indigo-200"
                                                    >
                                                        <Bot className="h-3 w-3 mr-1.5" /> Fix
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="aliases" className="animate-in slide-in-from-bottom-2 duration-500 space-y-8">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
                        <Card className="lg:col-span-1 rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white h-fit">
                            <CardHeader className="bg-black/5 pb-4 border-b border-black/5 text-left">
                                <div className="flex justify-between items-center">
                                    <div>
                                        <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                            <ShoppingBag className="h-3.5 w-3.5 text-primary" /> Inventory
                                        </CardTitle>
                                    </div>
                                    <div className="flex gap-1">
                                        <button onClick={() => handleInventoryScroll('top')} className="h-6 w-6 rounded-md bg-black/5 flex items-center justify-center hover:bg-black/10"><ChevronUp className="h-3.5 w-3.5" /></button>
                                        <button onClick={() => handleInventoryScroll('bottom')} className="h-6 w-6 rounded-md bg-black/5 flex items-center justify-center hover:bg-black/10"><ChevronDown className="h-3.5 w-3.5" /></button>
                                    </div>
                                </div>
                            </CardHeader>
                            <div className="p-4 border-b border-black/5">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-20" />
                                    <Input 
                                        placeholder="Filter..." 
                                        value={inventorySearch}
                                        onChange={e => setInventorySearch(e.target.value)}
                                        className="h-9 rounded-xl border-2 pl-8 font-bold uppercase text-[9px]"
                                    />
                                </div>
                            </div>
                            <ScrollArea ref={platformInventoryScrollRef} className="h-[300px] sm:h-[500px]">
                                <div className="divide-y divide-black/5">
                                    {itemsNeedingAliases.map(item => {
                                        const isLinked = aliasGroups?.some(g => g.id.toLowerCase() === item.toLowerCase());
                                        return (
                                            <button 
                                                key={item}
                                                onClick={() => {
                                                    setPrefilledName(item);
                                                    setIsAddingNew(true);
                                                }}
                                                className="w-full text-left p-4 hover:bg-primary/5 transition-colors group flex justify-between items-center"
                                            >
                                                <div className="min-w-0">
                                                    <p className="text-[10px] font-black uppercase text-gray-950 truncate leading-tight">{item}</p>
                                                    {isLinked ? (
                                                        <span className="text-[7px] font-black text-green-600 uppercase tracking-widest flex items-center gap-1 mt-1">
                                                            <CheckCircle2 className="h-2 w-2" /> Linked
                                                        </span>
                                                    ) : (
                                                        <span className="text-[7px] font-black text-amber-600 uppercase tracking-widest flex items-center gap-1 mt-1">
                                                            <AlertCircle className="h-2 w-2" /> Pending
                                                        </span>
                                                    )}
                                                </div>
                                                <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-20 -translate-x-2 group-hover:translate-x-0 transition-all" />
                                            </button>
                                        );
                                    })}
                                </div>
                            </ScrollArea>
                        </Card>

                        <div className="lg:col-span-3 space-y-6">
                            <div className="flex flex-col sm:flex-row gap-4 items-end">
                                <div className="flex-1 w-full relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                                    <Input 
                                        placeholder="Search global database..." 
                                        value={searchTerm}
                                        onChange={e => setSearchTerm(e.target.value)}
                                        className="h-12 rounded-xl border-2 pl-10 font-bold uppercase text-xs shadow-sm bg-white"
                                    />
                                </div>
                                <Dialog open={isAddingNew} onOpenChange={setIsAddingNew}>
                                    <DialogTrigger asChild>
                                        <Button className="w-full sm:w-auto h-12 rounded-xl font-black uppercase tracking-widest text-[10px] px-6 shadow-xl shadow-primary/20">
                                            <Plus className="h-4 w-4 mr-2" /> New Entry
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl p-6 sm:p-8">
                                        <DialogHeader className="text-left">
                                            <DialogTitle className="font-black uppercase tracking-tight">Add Canonical Product</DialogTitle>
                                            <DialogDescription className="text-xs font-bold uppercase opacity-40">Create a central item for multilingual aliasing</DialogDescription>
                                        </DialogHeader>
                                        <div className="py-6 space-y-4">
                                            <div className="space-y-2">
                                                <Label className="text-[10px] font-black uppercase opacity-40">Official Item Name</Label>
                                                <Input 
                                                    id="new-item-name" 
                                                    placeholder="e.g. Chicken Biryani" 
                                                    value={prefilledName}
                                                    onChange={e => setPrefilledName(e.target.value)}
                                                    className="h-12 rounded-xl border-2 font-bold" 
                                                />
                                            </div>
                                            <Button onClick={() => {
                                                if (prefilledName) handleGenerateGroup(prefilledName);
                                            }} className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20">
                                                {isGeneratingAliases ? <Loader2 className="animate-spin h-5 w-5" /> : <><Bot className="h-4 w-4 mr-2" /> Activate AI Generator</>}
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            {filteredAliases.length === 0 ? (
                                <div className="p-20 sm:p-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-black/5 opacity-30">
                                    <Bot className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                    <p className="font-black uppercase tracking-widest text-xs">Global Database Empty</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    {filteredAliases.map(group => (
                                        <Card key={group.id} className="rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white group hover:shadow-2xl transition-all border-2 border-transparent hover:border-primary/10 cursor-pointer" onClick={() => setSelectedGroupForEdit(group)}>
                                            <CardHeader className="bg-primary/5 border-b border-black/5 pb-4 text-left">
                                                <div className="flex justify-between items-start">
                                                    <div className="min-w-0">
                                                        <CardTitle className="text-sm font-black uppercase tracking-tight text-gray-950 truncate max-w-[220px]">{group.id}</CardTitle>
                                                        <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest mt-1">Click to Manage</p>
                                                    </div>
                                                    <button onClick={(e) => { e.stopPropagation(); if (firestore) deleteDoc(doc(firestore, 'voiceAliasGroups', group.id)); }} className="text-red-500 sm:opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1 text-left">
                                                        <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Telugu</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {group.te?.slice(0, 3).map(a => <Badge key={a} variant="outline" className="text-[8px] font-bold uppercase py-0 px-1.5 border-primary/20 text-primary">{a}</Badge>)}
                                                            {(group.te?.length || 0) > 3 && <span className="text-[8px] font-black opacity-20">+{group.te!.length - 3}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1 text-left">
                                                        <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Hindi</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {group.hi?.slice(0, 3).map(a => <Badge key={a} variant="outline" className="text-[8px] font-bold uppercase py-0 px-1.5 border-orange-200 text-orange-600">{a}</Badge>)}
                                                            {(group.hi?.length || 0) > 3 && <span className="text-[8px] font-black opacity-20">+{group.hi!.length - 3}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    className="w-full h-8 rounded-xl font-black text-[8px] uppercase tracking-[0.2em] opacity-40 hover:opacity-100 border border-black/5 bg-gray-50"
                                                >
                                                    <Edit3 className="h-3 w-3 mr-1.5" /> Advanced Edit
                                                </Button>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
