
'use client';

import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, query, orderBy, doc, deleteDoc, writeBatch, arrayUnion, updateDoc, setDoc } from 'firebase/firestore';
import type { FailedVoiceCommand } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trash2, Bot, Sparkles, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { suggestAlias, SuggestAliasOutput } from '@/ai/flows/suggest-alias-flow';
import { useAppStore } from '@/lib/store';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function FailedCommandRow({ command, allItemNames }: { command: FailedVoiceCommand, allItemNames: string[] }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const fetchInitialData = useAppStore(state => state.fetchInitialData);
    const [isDeleting, startDelete] = useTransition();
    const [isSuggesting, startSuggestion] = useTransition();
    const [isAdding, startAdd] = useTransition();

    const [suggestion, setSuggestion] = useState<SuggestAliasOutput | null>(null);

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
    
    const handleSuggestFix = () => {
        startSuggestion(async () => {
            try {
                const result = await suggestAlias({
                    commandText: command.commandText,
                    language: command.language,
                    itemNames: allItemNames
                });
                setSuggestion(result);
            } catch(error) {
                console.error("AI Suggestion failed:", error);
                toast({ variant: 'destructive', title: "AI Error", description: "The suggestion flow failed to execute." });
            }
        });
    };

    const handleAddAlias = async () => {
        if (!firestore || !suggestion || !suggestion.isSuggestionAvailable) return;

        startAdd(async () => {
            const batch = writeBatch(firestore);
            
            const aliasGroupRef = doc(firestore, 'voiceAliasGroups', suggestion.suggestedKey);
            
            const updates = {};
            
            // Add original command to its language array
            const originalLang = command.language.split('-')[0];
            updates[originalLang] = arrayUnion(suggestion.originalCommand);

            // Add all other suggested aliases
            suggestion.suggestedAliases.forEach(aliasInfo => {
                const lang = aliasInfo.lang;
                if (!updates[lang]) {
                    updates[lang] = arrayUnion(aliasInfo.alias);
                } else {
                    updates[lang] = arrayUnion(aliasInfo.alias);
                }

                if (aliasInfo.transliteratedAlias) {
                    updates[lang] = arrayUnion(updates[lang], aliasInfo.transliteratedAlias);
                }
            });

            // Use set with merge to create the document if it doesn't exist, or update it if it does.
            batch.set(aliasGroupRef, updates, { merge: true });

            // Delete the failed command log
            const commandRef = doc(firestore, 'failedCommands', command.id);
            batch.delete(commandRef);

            try {
                await batch.commit();
                toast({ title: "Aliases Added!", description: `The AI's suggestions for "${suggestion.suggestedKey}" have been saved.`});
                // Re-fetch all data to update the UI across the app.
                await fetchInitialData(firestore);
            } catch (err) {
                 console.error("Error saving aliases:", err);
                 toast({ variant: 'destructive', title: "Save Failed", description: "Could not save the new aliases. Check permissions and data structure." });
            }
        });
    };


    const formatDateSafe = (date: any) => {
        if (!date) return 'N/A';
        const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        return `${formatDistanceToNow(jsDate, { addSuffix: true })}`;
    }

    const renderSuggestedAliases = () => {
        if (!suggestion) return null;
        
        const aliasesToShow = new Set<string>([suggestion.originalCommand]);
        suggestion.suggestedAliases.forEach(a => {
            aliasesToShow.add(a.alias);
            if (a.transliteratedAlias) {
                aliasesToShow.add(a.transliteratedAlias);
            }
        });
        
        return Array.from(aliasesToShow).map(alias => (
            <Badge key={alias} variant="secondary">{alias}</Badge>
        ));
    };

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
                    <Button variant="outline" size="sm" onClick={handleSuggestFix} disabled={isSuggesting || suggestion}>
                        {isSuggesting ? <Sparkles className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
                        <span className="sr-only">Suggest Fix</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
                        <Trash2 className="h-4 w-4" />
                        <span className="sr-only">Delete Log</span>
                    </Button>
                </TableCell>
            </TableRow>
            {isSuggesting || suggestion ? (
                <TableRow>
                    <TableCell colSpan={4}>
                         <div className="p-4 bg-muted/50 rounded-md">
                            {isSuggesting ? (
                                <div className="flex items-center gap-2 text-muted-foreground">
                                    <Sparkles className="h-4 w-4 animate-pulse" />
                                    <span>AI is analyzing the command...</span>
                                </div>
                            ) : suggestion && suggestion.isSuggestionAvailable ? (
                                <Alert>
                                    <CheckCircle className="h-4 w-4" />
                                    <AlertTitle>AI Suggestion: Map "{suggestion.originalCommand}" to '{suggestion.suggestedKey}'</AlertTitle>
                                    <AlertDescription>
                                        <p className="mb-2">{suggestion.reasoning}</p>
                                        <p className="mb-2 text-xs text-muted-foreground">This will add the following aliases:</p>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {renderSuggestedAliases()}
                                        </div>
                                        <Button size="sm" onClick={handleAddAlias} disabled={isAdding}>
                                            {isAdding ? "Adding..." : `Accept & Add Aliases`}
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert variant="destructive">
                                    <XCircle className="h-4 w-4" />
                                    <AlertTitle>No Confident Suggestion</AlertTitle>
                                    <AlertDescription>
                                        The AI could not confidently match this command to an existing item. You can delete this log or create a new product/alias manually.
                                    </AlertDescription>
                                </Alert>
                            )}
                         </div>
                    </TableCell>
                </TableRow>
            ) : null}
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
        // Return a de-duplicated list of canonical names
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
                            <CardTitle className="text-3xl font-headline">Failed Command Center</CardTitle>
                            <CardDescription>
                                Review voice commands the system failed to understand and use AI to train it.
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
                            <p className="text-muted-foreground mt-2">There are no failed voice commands in the log.</p>
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

    