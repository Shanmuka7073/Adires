

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
import { Trash2, Bot, Sparkles, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition, useMemo, useCallback, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { suggestAlias, SuggestAliasOutput } from '@/ai/flows/suggest-alias-flow';
import { useAppStore } from '@/lib/store';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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
                     <div className="flex flex-wrap gap-1 pt-2">
                        {suggestion.suggestedAliases.map(a => (
                            <Badge key={a.alias} variant="secondary">{a.alias} ({a.lang})</Badge>
                        ))}
                    </div>
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
            
            const aliasesByLang: Record<string, string[]> = {};

            const originalLang = command.language.split('-')[0];
            if (!aliasesByLang[originalLang]) aliasesByLang[originalLang] = [];
            aliasesByLang[originalLang].push(suggestion.originalCommand);

            suggestion.suggestedAliases.forEach(aliasInfo => {
                const lang = aliasInfo.lang;
                if (!aliasesByLang[lang]) aliasesByLang[lang] = [];
                aliasesByLang[lang].push(aliasInfo.alias);
                if (aliasInfo.transliteratedAlias) {
                    aliasesByLang[lang].push(aliasInfo.transliteratedAlias);
                }
            });
            
            const updates: Record<string, any> = {};
            for (const lang in aliasesByLang) {
                const uniqueAliases = [...new Set(aliasesByLang[lang])];
                updates[lang] = arrayUnion(...uniqueAliases);
            }
            
            batch.set(aliasGroupRef, updates, { merge: true });

            const commandRef = doc(firestore, 'failedCommands', command.id);
            batch.delete(commandRef);

            try {
                await batch.commit();
                toast({ title: "Alias Approved!", description: `"${suggestion.originalCommand}" is now an alias for "${suggestion.suggestedKey}".`});
                // After saving, refetch all data to update the VoiceCommander's context
                await fetchInitialData(firestore);
            } catch (err) {
                 console.error("Error saving aliases:", err);
                 toast({ variant: 'destructive', title: "Save Failed", description: "Could not save the new aliases. Check permissions and data structure." });
            }
        });
    }, [firestore, command.id, command.language, startAdd, toast, fetchInitialData, suggestion]);

    const handleDelete = async () => {
        if (!firestore) return;
        startDelete(async () => {
            const commandRef = doc(firestore, 'failedCommands', command.id);
            try {
                await deleteDoc(commandRef);
                toast({ title: "Command Log Deleted", description: `The log for "${command.commandText}" has been removed.` });
            } catch (err) {
                console.error("Error deleting command log:", err);
                toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not remove the command log." });
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
                <Badge variant="outline">{command.language}</Badge>
            </TableCell>
            <TableCell className="text-sm text-muted-foreground">{formatDateSafe(command.timestamp)}</TableCell>
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
    const { masterProducts, stores } = useAppStore();

    const failedCommandsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: failedCommands, isLoading: commandsLoading } = useCollection<FailedVoiceCommand>(failedCommandsQuery);

    const allItemNames = useMemo(() => {
        const productNames = masterProducts.map(p => p.name);
        const storeNames = stores.map(s => s.name);
        return [...new Set([...productNames, ...storeNames])];
    }, [masterProducts, stores]);


    if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    const isLoading = isAdminLoading || commandsLoading;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <Bot className="h-8 w-8 text-primary" />
                        <div>
                            <CardTitle className="text-3xl font-headline">AI Training Center</CardTitle>
                            <CardDescription>
                                Review failed voice commands and use the AI to suggest and apply fixes.
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="space-y-4">
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                            <Skeleton className="h-16 w-full" />
                        </div>
                    ) : !failedCommands || failedCommands.length === 0 ? (
                        <div className="text-center py-12">
                            <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                             <p className="mt-4 text-lg font-semibold">All Clear!</p>
                            <p className="text-muted-foreground mt-2">There are no failed commands requiring manual review.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User Command</TableHead>
                                    <TableHead>Date</TableHead>
                                    <TableHead>Failure Reason</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedCommands.map(command => (
                                    <FailedCommandRow key={command.id} command={command} allItemNames={allItemNames} />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
