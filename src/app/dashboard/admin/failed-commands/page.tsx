
'use client';

import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, query, orderBy, doc, deleteDoc, writeBatch, arrayUnion } from 'firebase/firestore';
import type { FailedVoiceCommand } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trash2, Bot, Sparkles, CheckCircle, XCircle, Loader2, AlertTriangle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition, useMemo, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { suggestAlias, SuggestAliasOutput } from '@/ai/flows/suggest-alias-flow';
import { useAppStore } from '@/lib/store';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

function AISuggestion({ suggestion, onApprove, onDismiss, isAdding }: { suggestion: SuggestAliasOutput, onApprove: () => void, onDismiss: () => void, isAdding: boolean }) {
    if (!suggestion.isSuggestionAvailable) {
        return (
            <div className="p-4 bg-muted text-sm text-muted-foreground rounded-lg flex items-center gap-2">
                <XCircle className="h-4 w-4" />
                The AI could not find a confident suggestion for this command.
            </div>
        )
    }

    return (
        <Card className="bg-green-500/10 border-green-500/30">
            <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-green-600" />
                    AI Suggestion
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="mb-2 text-sm">{suggestion.reasoning}</p>
                <div className="bg-background p-3 rounded-md space-y-1">
                    <p className="text-xs text-muted-foreground">Suggested Fix:</p>
                    <p>Map the phrase <strong className="text-primary">"{suggestion.originalCommand}"</strong> as an alias for the item <strong className="text-primary">"{suggestion.suggestedKey}"</strong>.</p>
                </div>
                <div className="flex gap-2 mt-4">
                    <Button onClick={onApprove} disabled={isAdding}>
                        {isAdding ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <CheckCircle className="mr-2 h-4 w-4" />}
                        Approve & Fix
                    </Button>
                    <Button variant="ghost" onClick={onDismiss}>Dismiss</Button>
                </div>
            </CardContent>
        </Card>
    )
}

function FailedCommandRow({ command, allItemNames }: { command: FailedVoiceCommand, allItemNames: string[] }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isDeleting, startDelete] = useTransition();
    const [isAdding, startAdd] = useTransition();
    const [isSuggesting, startSuggest] = useTransition();
    const [suggestion, setSuggestion] = useState<SuggestAliasOutput | null>(null);

    const { fetchInitialData } = useAppStore();

    const handleGetSuggestion = useCallback(() => {
        startSuggest(async () => {
            try {
                const result = await suggestAlias({
                    commandText: command.commandText,
                    language: command.language.split('-')[0],
                    itemNames: allItemNames,
                });
                setSuggestion(result);
            } catch (err) {
                 toast({ variant: 'destructive', title: "AI Suggestion Failed", description: "Could not get a suggestion from the AI." });
            }
        });
    }, [command, allItemNames, toast]);

    const handleAddAlias = useCallback(async () => {
        if (!firestore || !suggestion || !suggestion.isSuggestionAvailable) return;

        startAdd(async () => {
            const batch = writeBatch(firestore);
            const aliasGroupRef = doc(firestore, 'voiceAliasGroups', suggestion.suggestedKey);
            
            const originalLang = command.language.split('-')[0];
            
            batch.set(aliasGroupRef, {
                [originalLang]: arrayUnion(suggestion.originalCommand)
            }, { merge: true });

            const commandRef = doc(firestore, 'failedCommands', command.id);
            batch.delete(commandRef);

            try {
                await batch.commit();
                toast({ title: "Alias Approved!", description: `"${suggestion.originalCommand}" is now an alias for "${suggestion.suggestedKey}".`});
                await fetchInitialData(firestore);
            } catch (err) {
                 console.error("Error saving aliases:", err);
                 toast({ variant: 'destructive', title: "Save Failed", description: "Could not save the new aliases." });
            }
        });
    }, [firestore, command.id, command.language, startAdd, toast, fetchInitialData, suggestion]);

    const handleDelete = async () => {
        if (!firestore) return;
        startDelete(async () => {
            const commandRef = doc(firestore, 'failedCommands', command.id);
            try {
                await deleteDoc(commandRef);
                toast({ title: "Log Deleted" });
            } catch (err) {
                toast({ variant: 'destructive', title: "Deletion Failed" });
            }
        });
    };

    const formatDateSafe = (date: any) => {
        if (!date) return 'N/A';
        const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        return `${formatDistanceToNow(jsDate, { addSuffix: true })}`;
    }

    return (
        <>
        <TableRow>
            <TableCell>
                <p className="font-semibold text-base">{command.commandText}</p>
                <Badge variant="outline" className="text-[10px]">{command.language}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDateSafe(command.timestamp)}</TableCell>
            <TableCell className="font-mono text-xs max-w-xs truncate">{command.reason}</TableCell>
            <TableCell className="text-right space-x-2">
                 <Button variant="outline" size="sm" onClick={handleGetSuggestion} disabled={isSuggesting}>
                    {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Bot className="mr-2 h-4 w-4" />}
                    Get Suggestion
                </Button>
                <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete Log</span>
                </Button>
            </TableCell>
        </TableRow>
         {suggestion && (
            <TableRow>
                <TableCell colSpan={4}>
                    <AISuggestion suggestion={suggestion} onApprove={handleAddAlias} onDismiss={() => setSuggestion(null)} isAdding={isAdding} />
                </TableCell>
            </TableRow>
        )}
        </>
    );
}

export default function FailedCommandsPage() {
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const { firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const { masterProducts, stores } = useAppStore();
    const [isDeletingAll, startDeleteAll] = useTransition();

    const failedCommandsQuery = useMemoFirebase(() => {
        if (!firestore) return undefined;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: failedCommands, isLoading: commandsLoading } = useCollection<FailedVoiceCommand>(failedCommandsQuery);

    const allItemNames = useMemo(() => {
        const productNames = masterProducts.map(p => p.name);
        const storeNames = stores.map(s => s.name);
        return [...new Set([...productNames, ...storeNames])];
    }, [masterProducts, stores]);

    const handleDeleteAll = async () => {
        if (!firestore || !failedCommands || failedCommands.length === 0) return;

        startDeleteAll(async () => {
            try {
                const batch = writeBatch(firestore);
                failedCommands.forEach(cmd => {
                    batch.delete(doc(firestore, 'failedCommands', cmd.id));
                });
                await batch.commit();
                toast({ title: 'Logs Cleared', description: 'All failed command history has been deleted.' });
            } catch (e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'Action Failed' });
            }
        });
    };


    if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    const isLoading = isAdminLoading || commandsLoading;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card className="rounded-[2rem] border-0 shadow-2xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b border-black/5 pb-8">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex items-center gap-3">
                            <Bot className="h-8 w-8 text-primary" />
                            <div>
                                <CardTitle className="text-3xl font-black font-headline tracking-tighter uppercase">Voice Training Center</CardTitle>
                                <CardDescription className="font-bold opacity-60">
                                    Analyze failed commands and teach the AI new regional aliases.
                                </CardDescription>
                            </div>
                        </div>
                        {failedCommands && failedCommands.length > 0 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="rounded-xl font-bold uppercase text-[10px] tracking-widest h-10 px-4" disabled={isDeletingAll}>
                                        {isDeletingAll ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                                        Delete All Logs
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent className="rounded-[2.5rem] border-0 shadow-2xl">
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="font-black uppercase tracking-tight">Clear History?</AlertDialogTitle>
                                        <AlertDialogDescription className="font-bold">
                                            This will permanently delete all recorded failed voice commands.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="gap-2">
                                        <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleDeleteAll} className="bg-destructive hover:bg-destructive/90 rounded-xl font-bold">
                                            Yes, Delete All
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                         <div className="p-8 space-y-4">
                            <Skeleton className="h-16 w-full rounded-2xl" />
                            <Skeleton className="h-16 w-full rounded-2xl" />
                            <Skeleton className="h-16 w-full rounded-2xl" />
                        </div>
                    ) : !failedCommands || failedCommands.length === 0 ? (
                        <div className="text-center py-24 bg-white">
                            <CheckCircle className="mx-auto h-16 w-16 text-green-500 opacity-20 mb-4" />
                             <p className="text-lg font-black uppercase tracking-tight">All Clear!</p>
                            <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest opacity-40">No failed commands requiring review.</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-black/5">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">User Command</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Date</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Failure Reason</TableHead>
                                        <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {failedCommands.map(command => (
                                        <FailedCommandRow key={command.id} command={command} allItemNames={allItemNames} />
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
