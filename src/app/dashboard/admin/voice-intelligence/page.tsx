'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
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
    Languages, 
    RefreshCw, 
    Loader2, 
    Bot, 
    Plus,
    X,
    Save,
    Search,
    ShoppingBag,
    AlertCircle,
    ArrowRight
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { suggestAlias } from '@/ai/flows/suggest-alias-flow';
import { suggestProductAliases } from '@/ai/flows/suggest-product-aliases-flow';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';

export default function VoiceIntelligencePage() {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const [isSuggesting, startSuggest] = useTransition();
    const [isGeneratingAliases, startGenAliases] = useTransition();
    const [searchTerm, setSearchTerm] = useState('');
    const [inventorySearch, setInventorySearch] = useState('');
    const [isAddingNew, setIsAddingNew] = useState(false);
    const [prefilledName, setPrefilledName] = useState('');

    // --- FAILED COMMANDS LOGIC ---
    const failedQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'), limit(50)) : null, 
    [firestore]);
    const { data: failedCommands, isLoading: failedLoading, refetch: refetchFailed } = useCollection<FailedVoiceCommand>(failedQuery);

    // --- ALIAS GROUPS LOGIC ---
    const aliasesQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'voiceAliasGroups')) : null, 
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
        startSuggest(async () => {
            try {
                const result = await suggestAlias({
                    commandText: cmd.text,
                    language: cmd.lang,
                    itemNames: masterItems
                });

                if (result.isSuggestionAvailable) {
                    await updateDoc(doc(firestore!, 'failedCommands', cmd.id), {
                        suggestion: result.suggestedKey,
                        status: 'resolved'
                    });
                    toast({ title: "Fix Suggested", description: `Matched to: ${result.suggestedKey}` });
                } else {
                    await updateDoc(doc(firestore!, 'failedCommands', cmd.id), { status: 'ignored' });
                    toast({ variant: 'destructive', title: "No Match", description: "AI couldn't find a confident link." });
                }
            } catch (e) {
                toast({ variant: 'destructive', title: "AI Error" });
            }
        });
    };

    const handleGenerateGroup = (productName: string) => {
        startGenAliases(async () => {
            try {
                const result = await suggestProductAliases({ productName });
                const groupRef = doc(firestore!, 'voiceAliasGroups', productName);
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

    const filteredAliases = useMemo(() => {
        if (!aliasGroups) return [];
        return aliasGroups.filter(g => g.id.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [aliasGroups, searchTerm]);

    const itemsNeedingAliases = useMemo(() => {
        const existingKeys = new Set(aliasGroups?.map(g => g.id.toLowerCase()) || []);
        return masterItems.filter(name => {
            const matchesSearch = name.toLowerCase().includes(inventorySearch.toLowerCase());
            return matchesSearch;
        });
    }, [masterItems, aliasGroups, inventorySearch]);

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">Voice Intel</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">System-wide NLU Training Center</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={scanPlatformInventory} disabled={isScanningInventory} className="rounded-full h-10 px-4 border-2 font-black text-[10px] uppercase tracking-widest shadow-sm bg-white">
                        <RefreshCw className={cn("mr-2 h-3.5 w-3.5", isScanningInventory && "animate-spin")} /> Re-Scan All Menus
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="failed" className="w-full">
                <TabsList className="bg-black/5 p-1.5 rounded-[1.5rem] border mb-8 h-12">
                    <TabsTrigger value="failed" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8">Failed Commands</TabsTrigger>
                    <TabsTrigger value="aliases" className="rounded-xl font-black text-[10px] uppercase tracking-widest px-8">Global Aliases</TabsTrigger>
                </TabsList>

                <TabsContent value="failed" className="animate-in slide-in-from-bottom-2 duration-500">
                    <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-red-50 border-b border-red-100 pb-6">
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-sm font-black uppercase tracking-widest text-red-900 flex items-center gap-2">
                                        <MicOff className="h-4 w-4" /> Error Log
                                    </CardTitle>
                                    <CardDescription className="text-[10px] font-bold text-red-700/60 uppercase">Commands the system failed to parse</CardDescription>
                                </div>
                                <Button variant="ghost" size="sm" onClick={refetchFailed} className="rounded-full h-8 px-3 text-red-900 hover:bg-red-100">
                                    <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", failedLoading && "animate-spin")} /> Refresh
                                </Button>
                            </div>
                        </CardHeader>
                        <Table>
                            <TableHeader className="bg-black/5">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase pl-6">Transcript</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Lang</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Identity</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase pr-6">AI Fix</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {!failedCommands || failedCommands.length === 0 ? (
                                    <TableRow><TableCell colSpan={4} className="py-20 text-center opacity-30 font-black uppercase text-xs">No failed commands recorded</TableCell></TableRow>
                                ) : failedCommands.map(cmd => (
                                    <TableRow key={cmd.id} className="border-b border-black/5 hover:bg-muted/30">
                                        <TableCell className="py-6 pl-6">
                                            <p className="font-black text-sm text-gray-950 italic">"{cmd.text}"</p>
                                            <p className="text-[8px] font-bold opacity-40 uppercase mt-1">{format(cmd.timestamp?.toDate() || new Date(), 'Pp')}</p>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[8px] font-black uppercase">{cmd.lang}</Badge>
                                        </TableCell>
                                        <TableCell className="text-[9px] font-bold opacity-40 uppercase truncate max-w-[100px]">{cmd.userId}</TableCell>
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
                                                    <Bot className="h-3 w-3 mr-1.5" /> Suggest
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </Card>
                </TabsContent>

                <TabsContent value="aliases" className="animate-in slide-in-from-bottom-2 duration-500 space-y-8">
                    <div className="grid lg:grid-cols-4 gap-8">
                        {/* LEFT: PLATFORM INVENTORY */}
                        <Card className="lg:col-span-1 rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white h-fit">
                            <CardHeader className="bg-black/5 pb-4 border-b border-black/5">
                                <CardTitle className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                                    <ShoppingBag className="h-3.5 w-3.5 text-primary" /> Platform Inventory
                                </CardTitle>
                                <CardDescription className="text-[8px] font-bold opacity-40 uppercase">Unique items across all hubs</CardDescription>
                            </CardHeader>
                            <div className="p-4 border-b border-black/5">
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-20" />
                                    <Input 
                                        placeholder="Filter products..." 
                                        value={inventorySearch}
                                        onChange={e => setInventorySearch(e.target.value)}
                                        className="h-9 rounded-xl border-2 pl-8 font-bold uppercase text-[9px]"
                                    />
                                </div>
                            </div>
                            <ScrollArea className="h-[500px]">
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
                                                            <AlertCircle className="h-2 w-2" /> Pending Sync
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

                        {/* RIGHT: ALIAS MANAGEMENT */}
                        <div className="lg:col-span-3 space-y-6">
                            <div className="flex flex-col md:flex-row gap-4 items-end">
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
                                        <Button className="h-12 rounded-xl font-black uppercase tracking-widest text-[10px] px-6 shadow-xl shadow-primary/20">
                                            <Plus className="h-4 w-4 mr-2" /> New Canonical Entry
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl p-8">
                                        <DialogHeader>
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
                                <div className="p-32 text-center bg-white rounded-[3rem] border-2 border-dashed border-black/5 opacity-30">
                                    <Bot className="h-16 w-16 mx-auto mb-4 opacity-20" />
                                    <p className="font-black uppercase tracking-widest text-xs">Global Database Empty</p>
                                    <p className="text-[10px] font-bold opacity-60 uppercase mt-2">Select an item from the inventory list to start</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {filteredAliases.map(group => (
                                        <Card key={group.id} className="rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white group hover:shadow-2xl transition-all border-2 border-transparent hover:border-primary/10">
                                            <CardHeader className="bg-primary/5 border-b border-black/5 pb-4">
                                                <div className="flex justify-between items-start">
                                                    <div className="min-w-0">
                                                        <CardTitle className="text-sm font-black uppercase tracking-tight text-gray-950 truncate max-w-[220px]">{group.id}</CardTitle>
                                                        <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest mt-1">Canonical Key</p>
                                                    </div>
                                                    <button onClick={() => deleteDoc(doc(firestore!, 'voiceAliasGroups', group.id))} className="text-red-500 opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-50 rounded-lg">
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </CardHeader>
                                            <CardContent className="p-6 space-y-4">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Telugu</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {group.te?.slice(0, 3).map(a => <Badge key={a} variant="outline" className="text-[8px] font-bold uppercase py-0 px-1.5 border-primary/20 text-primary">{a}</Badge>)}
                                                            {(group.te?.length || 0) > 3 && <span className="text-[8px] font-black opacity-20">+{group.te.length - 3}</span>}
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <p className="text-[8px] font-black uppercase tracking-widest opacity-40">Hindi</p>
                                                        <div className="flex flex-wrap gap-1.5">
                                                            {group.hi?.slice(0, 3).map(a => <Badge key={a} variant="outline" className="text-[8px] font-bold uppercase py-0 px-1.5 border-orange-200 text-orange-600">{a}</Badge>)}
                                                            {(group.hi?.length || 0) > 3 && <span className="text-[8px] font-black opacity-20">+{group.hi.length - 3}</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="sm" 
                                                    onClick={() => handleGenerateGroup(group.id)} 
                                                    disabled={isGeneratingAliases}
                                                    className="w-full h-8 rounded-xl font-black text-[8px] uppercase tracking-[0.2em] opacity-40 hover:opacity-100 border border-black/5 bg-gray-50"
                                                >
                                                    <Sparkles className="h-3 w-3 mr-1.5 text-primary" /> Re-Sync AI Aliases
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
