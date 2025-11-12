
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, query, orderBy, doc, deleteDoc, addDoc, writeBatch, getDocs } from 'firebase/firestore';
import type { FailedVoiceCommand, VoiceAlias } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { X, Check, BrainCircuit, Edit, Loader2, ArrowRight, Trash2, Wand2, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition, useMemo, useEffect, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { suggestAliasTarget } from '@/app/actions';
import { generalCommands } from '@/lib/locales/commands';
import { useVoiceCommander } from '@/components/layout/main-layout';


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
    // We only add the new alias. Deleting the failed command happens after retry.
    await addDoc(aliasCollectionRef, newAlias);
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
                toast({ title: 'AI Trained!', description: `The system now understands "${command.commandText}". The command will be retried automatically.` });
                // The row will handle its own removal after retry.
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
                        {isSaving ? 'Training...' : 'Save Alias & Retry'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function FailedCommandRow({ command, allTargets }: { command: FailedVoiceCommand, allTargets: { key: string, display: string, type: 'product' | 'store' | 'command', aliases: string[] }[]}) {
    const { firestore, user } = useFirebase();
    const { toast } = useToast();
    const { retryCommand } = useVoiceCommander();
    const { fetchInitialData } = useAppStore();

    const [isProcessing, startTransition] = useTransition();
    const [suggestion, setSuggestion] = useState<'loading' | 'no-suggestion' | { key: string, display: string, type: string }>('loading');
    const [isLearned, setIsLearned] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    
    // Function to handle the full auto-learn and retry flow
    const handleAutoLearnAndRetry = useCallback(async (suggestedKey: string, suggestionType: string) => {
        if (!firestore) return;
        
        try {
            // 1. Save the new alias
            await saveAlias(firestore, command, suggestedKey, suggestionType as 'product' | 'store' | 'command');
            
            // 2. Refresh the global alias store to include the new alias
            await fetchInitialData(firestore);
            
            // Give a moment for state propagation
            await new Promise(resolve => setTimeout(resolve, 100));

            // 3. Set UI state to "Learned"
            setIsLearned(true);
            
            // 4. Retry the original command with the new knowledge
            if(retryCommand) {
               retryCommand(command.commandText);
            }

            // 5. After a short delay, remove the command from Firestore
            setTimeout(async () => {
                const commandRef = doc(firestore, 'failedCommands', command.id);
                await deleteDoc(commandRef);
            }, 2000); // 2-second delay to show the "Learned" status

        } catch (error) {
            console.error("Auto-learn and retry failed:", error);
            toast({ variant: 'destructive', title: 'Auto-Learn Failed', description: 'Could not process the command automatically.' });
        }
    }, [firestore, command, fetchInitialData, retryCommand, toast]);

    // This effect runs once to get the AI suggestion
    useEffect(() => {
        let isMounted = true;
        const getSuggestion = async () => {
            try {
                const res = await suggestAliasTarget({
                    failedCommand: command.commandText,
                    language: command.language,
                    possibleTargets: allTargets,
                });

                if (!isMounted) return;

                if (res.suggestedTargetKey) {
                    const target = allTargets.find(t => t.key === res.suggestedTargetKey);
                    if (target) {
                        // ** AUTO-LEARN & RETRY **
                        // If it's a product or store, we can auto-learn and execute
                        if (target.type === 'product' || target.type === 'store') {
                             handleAutoLearnAndRetry(target.key, target.type);
                        } else {
                            // For commands, we still suggest for manual approval
                            setSuggestion({ key: target.key, display: target.display, type: target.type });
                        }
                    } else {
                        setSuggestion('no-suggestion');
                    }
                } else {
                    setSuggestion('no-suggestion');
                }
            } catch (error) {
                if(isMounted) {
                    console.error("Suggestion AI failed:", error);
                    setSuggestion('no-suggestion');
                }
            }
        };

        getSuggestion();
        return () => { isMounted = false; };
    }, [command, allTargets, handleAutoLearnAndRetry]);


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
        if (typeof suggestion === 'string' || !suggestion.key) return;
        startTransition(() => {
            handleAutoLearnAndRetry(suggestion.key, suggestion.type);
        });
    };


    return (
        <>
            <TrainDialog 
                command={command}
                isOpen={isDialogOpen}
                onOpenChange={setIsDialogOpen}
                initialSuggestion={suggestion && typeof suggestion !== 'string' ? `${suggestion.type}::${suggestion.key}` : undefined}
            />
            <TableRow className={isLearned ? 'bg-green-100/50 dark:bg-green-900/20' : ''}>
                <TableCell className="font-mono text-base">"{command.commandText}"</TableCell>
                <TableCell className="text-sm">
                    <Badge variant="outline">{command.language}</Badge>
                </TableCell>
                <TableCell className="text-sm">
                    {isLearned ? (
                         <div className="flex items-center gap-2 text-green-600 font-semibold">
                           <CheckCircle className="h-4 w-4" />
                           <span>Learned & Retrying...</span>
                        </div>
                    ) : suggestion === 'loading' ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>AI is thinking...</span>
                        </div>
                    ) : suggestion === 'no-suggestion' ? (
                         <span className="text-muted-foreground">No suggestion found</span>
                    ) : (
                        <div className="flex items-center gap-2">
                           <ArrowRight className="h-4 w-4 text-muted-foreground" />
                           <Badge variant="secondary" className="text-base">{suggestion.display}</Badge>
                        </div>
                    )}
                </TableCell>
                <TableCell className="text-right space-x-2">
                    {suggestion && typeof suggestion !== 'string' && !isLearned && (
                         <Button 
                            variant="default"
                            size="sm"
                            onClick={handleApprove}
                            disabled={isProcessing}
                            className="bg-green-600 hover:bg-green-700"
                        >
                            <Check className="mr-2 h-4 w-4" />
                            Approve
                        </Button>
                    )}
                    <Button 
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsDialogOpen(true)}
                        disabled={isProcessing || isLearned}
                    >
                        <Edit className="mr-2 h-4 w-4" />
                        Manual Fix
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
    const { masterProducts, stores, commands, getAllAliases, loading: appLoading } = useAppStore();
    const { toast } = useToast();
    const [isClearing, startClearingTransition] = useTransition();

    const failedCommandsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: failedCommands, isLoading: commandsLoading } = useCollection<FailedVoiceCommand>(failedCommandsQuery);

    const allPossibleTargets = useMemo(() => {
        const productTargets = masterProducts.map(p => {
            const key = createSlug(p.name);
            const aliases = Object.values(getAllAliases(key)).flat();
            return { key, display: p.name, type: 'product' as const, aliases };
        });
        const storeTargets = stores.map(s => {
            const key = createSlug(s.name);
            const aliases = Object.values(getAllAliases(key)).flat();
            return { key, display: s.name, type: 'store' as const, aliases };
        });
        const commandTargets = Object.entries(commands).map(([key, value]) => {
            const aliases = Object.values(getAllAliases(key)).flat();
            return { key, display: value.display, type: 'command' as const, aliases };
        });
        return [...productTargets, ...storeTargets, ...commandTargets];
    }, [masterProducts, stores, commands, getAllAliases]);

    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    const handleClearAll = async () => {
        if (!firestore) return;
        startClearingTransition(async () => {
            try {
                const commandsQuery = query(collection(firestore, 'failedCommands'));
                const querySnapshot = await getDocs(commandsQuery);
                const batch = writeBatch(firestore);
                querySnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                toast({ title: 'Success', description: 'All failed command logs have been cleared.' });
            } catch (error) {
                console.error("Error clearing failed commands:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not clear failed command logs.' });
            }
        });
    };
    
    const isLoading = isUserLoading || commandsLoading || appLoading;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-6 w-6 text-primary" /> AI Training Queue</CardTitle>
                            <CardDescription>
                                Commands the AI cannot auto-learn appear here. Approve suggestions or provide a manual fix.
                            </CardDescription>
                        </div>
                        {failedCommands && failedCommands.length > 0 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isClearing}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Clear All Logs
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete all {failedCommands.length} failed command logs. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClearAll} disabled={isClearing}>
                                            {isClearing ? 'Clearing...' : 'Yes, clear all'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : !failedCommands || failedCommands.length === 0 ? (
                        <div className="text-center py-12">
                            <Wand2 className="mx-auto h-12 w-12 text-muted-foreground" />
                             <p className="mt-4 text-lg font-semibold">The training queue is empty!</p>
                            <p className="text-muted-foreground mt-2">No failed voice commands to review. The AI is performing perfectly!</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User Said</TableHead>
                                    <TableHead>Language</TableHead>
                                    <TableHead>AI Suggestion / Status</TableHead>
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
