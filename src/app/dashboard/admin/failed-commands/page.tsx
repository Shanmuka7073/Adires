
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, query, orderBy, doc, deleteDoc, addDoc } from 'firebase/firestore';
import type { FailedVoiceCommand, VoiceAlias } from '@/lib/types';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { X, Check, BrainCircuit, Edit, Loader2, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { suggestAliasTarget } from '@/app/actions';
import { generalCommands } from '@/lib/locales/commands';


const ADMIN_EMAIL = 'admin@gmail.com';

const createSlug = (text: string) => text.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');

// Function to handle saving an alias (used by both approval and manual training)
async function saveAlias(firestore: any, command: FailedVoiceCommand, targetKey: string, targetType: 'product' | 'store' | 'command') {
    const newAlias: Omit<VoiceAlias, 'id'> = {
        key: targetKey,
        language: command.language,
        alias: command.commandText.toLowerCase(),
        type: targetType,
    };
    const aliasCollectionRef = collection(firestore, 'voiceAliases');
    await addDoc(aliasCollectionRef, newAlias);
    const failedCommandRef = doc(firestore, 'failedCommands', command.id);
    await deleteDoc(failedCommandRef);
}


function TrainDialog({ command, isOpen, onOpenChange, initialSuggestion }: { command: FailedVoiceCommand; isOpen: boolean; onOpenChange: (open: boolean) => void; initialSuggestion?: string }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { masterProducts, stores } = useAppStore();
    const [selectedValue, setSelectedValue] = useState(initialSuggestion || '');
    const [isSaving, startSaveTransition] = useTransition();

    useEffect(() => {
        setSelectedValue(initialSuggestion || '');
    }, [initialSuggestion, isOpen]);

    const handleSaveAlias = () => {
        if (!selectedValue) {
            toast({ variant: 'destructive', title: 'Please select an item to map to.' });
            return;
        }

        startSaveTransition(async () => {
            if (!firestore) return;

            const [type, key] = selectedValue.split('::');

            try {
                await saveAlias(firestore, command, key, type as 'product' | 'store' | 'command');
                toast({ title: 'AI Trained!', description: `The system now understands "${command.commandText}".` });
                onOpenChange(false);
            } catch (error) {
                console.error('Error saving alias:', error);
                toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the new alias.' });
            }
        });
    };
    
    const allCommands = useMemo(() => Object.entries(generalCommands).map(([key, value]) => ({ key, ...value })), []);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Manually Train AI</DialogTitle>
                    <DialogDescription>
                        Map the failed user command <span className="font-bold text-primary">"{command.commandText}"</span> to the correct product, store, or action.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Select onValueChange={setSelectedValue} value={selectedValue}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a product, store, or command..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                            <SelectGroup>
                                <SelectLabel>Products</SelectLabel>
                                {masterProducts.map(p => (
                                    <SelectItem key={p.id} value={`product::${createSlug(p.name)}`}>{p.name}</SelectItem>
                                ))}
                            </SelectGroup>
                             <SelectGroup>
                                <SelectLabel>Stores</SelectLabel>
                                {stores.map(s => (
                                    <SelectItem key={s.id} value={`store::${createSlug(s.name)}`}>{s.name}</SelectItem>
                                ))}
                            </SelectGroup>
                             <SelectGroup>
                                <SelectLabel>General Commands</SelectLabel>
                                {allCommands.map(c => (
                                    <SelectItem key={c.key} value={`command::${c.key}`}>{c.display}</SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSaveAlias} disabled={!selectedValue || isSaving}>
                        {isSaving ? 'Training...' : 'Save Alias'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function FailedCommandRow({ command, allTargets }: { command: FailedVoiceCommand, allTargets: { key: string, display: string, type: 'product' | 'store' | 'command' }[] }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isProcessing, startTransition] = useTransition();
    const [suggestion, setSuggestion] = useState<{ key: string, display: string, type: string } | null | 'loading'>('loading');
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    useEffect(() => {
        // Only fetch suggestion if it hasn't been fetched yet for this component instance
        if (suggestion === 'loading') {
            const getSuggestion = async () => {
                try {
                    const res = await suggestAliasTarget({
                        failedCommand: command.commandText,
                        language: command.language,
                        possibleTargets: allTargets,
                    });

                    if (res.suggestedTargetKey) {
                        const target = allTargets.find(t => t.key === res.suggestedTargetKey);
                        if (target) {
                            setSuggestion({ key: target.key, display: target.display, type: target.type });
                        } else {
                            setSuggestion(null); // No valid target found for the key
                        }
                    } else {
                        setSuggestion(null); // AI returned no suggestion
                    }
                } catch (error) {
                    console.error("Suggestion AI failed:", error);
                    setSuggestion(null); // If AI fails, fallback to no suggestion
                }
            };
            getSuggestion();
        }
    }, [command, allTargets, suggestion]);

    const handleReject = () => {
        if (!firestore) return;
        startTransition(async () => {
            const commandRef = doc(firestore, 'failedCommands', command.id);
            try {
              await deleteDoc(commandRef);
              toast({ title: "Log Entry Removed", description: "The failed command log has been removed." });
            } catch (error) {
              console.error("Failed to remove log:", error);
              toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not remove the log entry." });
            }
        });
    }
    
    const handleApprove = () => {
        if (!firestore || !suggestion || typeof suggestion === 'string') return;
        startTransition(async () => {
             try {
                await saveAlias(firestore, command, suggestion.key, suggestion.type as 'product' | 'store' | 'command');
                toast({ title: 'AI Trained!', description: `Approved suggestion for "${command.commandText}".` });
            } catch (error) {
                console.error('Error saving alias:', error);
                toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the new alias.' });
            }
        });
    }

    return (
        <>
            <TrainDialog 
                command={command}
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                initialSuggestion={suggestion && typeof suggestion !== 'string' ? `${suggestion.type}::${suggestion.key}` : undefined}
            />
            <TableRow>
                <TableCell className="font-mono text-base">"{command.commandText}"</TableCell>
                <TableCell className="text-sm">
                    <Badge variant="outline">{command.language}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                    {suggestion === 'loading' ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>AI is thinking...</span>
                        </div>
                    ) : suggestion ? (
                        <div className="flex items-center gap-2">
                           <ArrowRight className="h-4 w-4 text-muted-foreground" />
                           <Badge variant="secondary" className="text-base">{suggestion.display}</Badge>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">No suggestion</span>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    {suggestion && suggestion !== 'loading' ? (
                        <Button 
                            variant="default"
                            size="sm"
                            onClick={handleApprove}
                            disabled={isProcessing}
                            className="mr-2"
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                        </Button>
                    ) : null}

                    <Button 
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsDialogOpen(true)}
                        disabled={isProcessing}
                        className="mr-2"
                    >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                    </Button>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleReject}
                        disabled={isProcessing}
                        title="Reject & Remove Log Entry"
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </TableCell>
            </TableRow>
        </>
    )
}

export default function FailedCommandsPage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    const { masterProducts, stores, commands } = useAppStore();

    const failedCommandsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: failedCommands, isLoading } = useCollection<FailedVoiceCommand>(failedCommandsQuery);

    const allPossibleTargets = useMemo(() => {
        const productTargets = masterProducts.map(p => ({ key: createSlug(p.name), display: p.name, type: 'product' as const }));
        const storeTargets = stores.map(s => ({ key: createSlug(s.name), display: s.name, type: 'store' as const }));
        const commandTargets = Object.entries(commands).map(([key, value]) => ({ key, display: value.display, type: 'command' as const }));
        return [...productTargets, ...storeTargets, ...commandTargets];
    }, [masterProducts, stores, commands]);


    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-6 w-6 text-primary" /> AI Self-Learning Center</CardTitle>
                    <CardDescription>
                        Review voice commands the AI failed to understand. The AI will suggest a possible match. Approve the suggestion or manually edit it to train the system.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : !failedCommands || failedCommands.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">No failed commands have been logged yet. The AI is performing perfectly!</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User Said</TableHead>
                                    <TableHead>Language</TableHead>
                                    <TableHead>AI Suggestion</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedCommands.map(cmd => (
                                    <FailedCommandRow key={cmd.id} command={cmd} allTargets={allPossibleTargets} />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
