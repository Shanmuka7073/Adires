
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, query, orderBy, doc, deleteDoc, addDoc, writeBatch, getDocs } from 'firebase/firestore';
import type { FailedVoiceCommand, VoiceAlias } from '@/lib/types';
import { format } from 'date-fns';
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
    // The component will handle UI state, we still delete the command after learning.
    // A more advanced system might move it to an "archive" collection.
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

function FailedCommandRow({ command, allTargets, onAutoLearn }: { command: FailedVoiceCommand, allTargets: { key: string, display: string, type: 'product' | 'store' | 'command' }[], onAutoLearn: (command: FailedVoiceCommand, suggestion: { key: string, display: string, type: string }) => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isProcessing, startTransition] = useTransition();
    const [suggestion, setSuggestion] = useState<{ key: string, display: string, type: string } | null | 'loading'>('loading');
    const [isLearned, setIsLearned] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    const getSuggestion = useCallback(async () => {
        try {
            const res = await suggestAliasTarget({
                failedCommand: command.commandText,
                language: command.language,
                possibleTargets: allTargets,
            });

            if (res.suggestedTargetKey) {
                const target = allTargets.find(t => t.key === res.suggestedTargetKey);
                if (target) {
                    const newSuggestion = { key: target.key, display: target.display, type: target.type };
                    setSuggestion(newSuggestion);
                    // Automatically learn if a good suggestion is found
                    onAutoLearn(command, newSuggestion);
                    setIsLearned(true); // Set local state to indicate learning
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
    }, [command, allTargets, onAutoLearn]);

    useEffect(() => {
        // Only run suggestion if it hasn't been run before.
        if (suggestion === 'loading') {
            getSuggestion();
        }
    }, [suggestion, getSuggestion]);

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
                    {suggestion === 'loading' ? (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>AI is thinking...</span>
                        </div>
                    ) : isLearned && suggestion ? (
                         <div className="flex items-center gap-2 text-green-600 font-semibold">
                           <CheckCircle className="h-4 w-4" />
                           <span>Learned: "{suggestion.display}"</span>
                        </div>
                    ) : suggestion ? (
                        <div className="flex items-center gap-2">
                           <ArrowRight className="h-4 w-4 text-muted-foreground" />
                           <Badge variant="secondary" className="text-base">{suggestion.display}</Badge>
                        </div>
                    ) : (
                        <span className="text-muted-foreground">No suggestion found</span>
                    )}
                </TableCell>
                <TableCell className="text-right">
                    <Button 
                        variant="secondary"
                        size="sm"
                        onClick={() => setIsDialogOpen(true)}
                        disabled={isProcessing || isLearned}
                        className="mr-2"
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
    const { masterProducts, stores, commands, fetchInitialData } = useAppStore();
    const { toast } = useToast();
    const [isClearing, startClearingTransition] = useTransition();

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

    const handleAutoLearn = useCallback(async (command: FailedVoiceCommand, suggestion: { key: string, display: string, type: string }) => {
        if (!firestore) return;
        try {
             // Create the new alias without deleting the original command
            const newAlias: Omit<VoiceAlias, 'id'> = {
                key: suggestion.key,
                language: command.language,
                alias: command.commandText.toLowerCase(),
                type: suggestion.type as 'product' | 'store' | 'command',
            };
            const aliasCollectionRef = collection(firestore, 'voiceAliases');
            await addDoc(aliasCollectionRef, newAlias);

            toast({
                title: 'AI Auto-Learned!',
                description: `Mapped "${command.commandText}" to "${suggestion.display}".`,
                className: 'bg-green-100 border-green-300 dark:bg-green-900 dark:border-green-700'
            });
            // Re-fetch aliases in the background
            fetchInitialData(firestore);
        } catch (error) {
            console.error("Auto-learn failed:", error);
            // Don't toast an error, as it might just be a race condition.
            // The item will remain on the screen for manual review.
        }
    }, [firestore, toast, fetchInitialData]);

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

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center gap-2"><BrainCircuit className="h-6 w-6 text-primary" /> AI Self-Learning Center</CardTitle>
                            <CardDescription>
                                Failed commands appear here. The AI will automatically process them, create a new alias, and mark them as "Learned".
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
                             <p className="mt-4 text-lg font-semibold">The learning queue is empty!</p>
                            <p className="text-muted-foreground mt-2">The AI has processed all failed commands. It's performing perfectly!</p>
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
                                    <FailedCommandRow key={cmd.id} command={cmd} allTargets={allPossibleTargets} onAutoLearn={handleAutoLearn} />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
