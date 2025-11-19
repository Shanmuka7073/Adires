
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
import { Trash2, Bot, Sparkles, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition, useMemo, useCallback, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { suggestAlias, SuggestAliasOutput } from '@/ai/flows/suggest-alias-flow';
import { useAppStore } from '@/lib/store';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

function FailedCommandRow({ command, allItemNames }: { command: FailedVoiceCommand, allItemNames: string[] }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const fetchInitialData = useAppStore(state => state.fetchInitialData);
    const [isDeleting, startDelete] = useTransition();
    const [isProcessing, setIsProcessing] = useState(true);
    const [isAdding, startAdd] = useTransition();

    const [suggestion, setSuggestion] = useState<SuggestAliasOutput | null>(null);

    const handleAddAlias = useCallback(async (suggestionToAdd: SuggestAliasOutput) => {
        if (!firestore || !suggestionToAdd.isSuggestionAvailable) return;

        startAdd(async () => {
            const batch = writeBatch(firestore);
            const aliasGroupRef = doc(firestore, 'voiceAliasGroups', suggestionToAdd.suggestedKey);
            
            const aliasesByLang: Record<string, string[]> = {};

            const originalLang = command.language.split('-')[0];
            if (!aliasesByLang[originalLang]) aliasesByLang[originalLang] = [];
            aliasesByLang[originalLang].push(suggestionToAdd.originalCommand);

            suggestionToAdd.suggestedAliases.forEach(aliasInfo => {
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
                toast({ title: "Alias Auto-Approved!", description: `"${suggestionToAdd.originalCommand}" is now an alias for "${suggestionToAdd.suggestedKey}".`});
                // No need to call fetchInitialData here as the component will unmount and the list will refresh
            } catch (err) {
                 console.error("Error saving aliases:", err);
                 toast({ variant: 'destructive', title: "Save Failed", description: "Could not save the new aliases. Check permissions and data structure." });
            }
        });
    }, [firestore, command.id, command.language, startAdd, toast]);

    
    useEffect(() => {
        // This effect runs once when the component mounts to auto-process the command.
        const processCommand = async () => {
            setIsProcessing(true);
            try {
                const result = await suggestAlias({
                    commandText: command.commandText,
                    language: command.language,
                    itemNames: allItemNames
                });
                
                if (result.isSuggestionAvailable && result.similarityScore > 0.5) {
                    // High confidence: auto-approve
                    await handleAddAlias(result);
                    // The component will unmount after successful add, so no need to set state.
                } else {
                    // Low confidence or no suggestion: keep for manual review
                    setSuggestion(result);
                    setIsProcessing(false);
                }

            } catch(error) {
                console.error("AI Suggestion failed:", error);
                toast({ variant: 'destructive', title: "AI Error", description: "The suggestion flow failed to execute." });
                setIsProcessing(false);
            }
        };

        processCommand();
        // Disabling ESLint exhaustive-deps because we explicitly want this to run only once on mount.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    

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
            <TableRow className={isProcessing ? 'opacity-50' : ''}>
                <TableCell>
                    <p className="font-semibold text-base">{command.commandText}</p>
                    <Badge variant="outline">{command.language}</Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">{formatDateSafe(command.timestamp)}</TableCell>
                <TableCell className="font-mono text-xs max-w-xs truncate">{command.reason}</TableCell>
                <TableCell className="text-right space-x-2">
                    {isProcessing ? (
                         <div className="flex items-center justify-end gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            <span>Processing...</span>
                        </div>
                    ) : (
                        <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete Log</span>
                        </Button>
                    )}
                </TableCell>
            </TableRow>
            {!isProcessing && suggestion && (
                <TableRow>
                    <TableCell colSpan={4}>
                         <div className="p-4 bg-muted/50 rounded-md">
                            {suggestion.isSuggestionAvailable ? (
                                <Alert>
                                    <Sparkles className="h-4 w-4" />
                                    <AlertTitle>AI Suggestion (Score: {(suggestion.similarityScore * 100).toFixed(0)}%) - Manual Review Required</AlertTitle>
                                    <AlertDescription>
                                        <p className="mb-2">{suggestion.reasoning}</p>
                                        <p className="mb-2 text-xs text-muted-foreground">This will map "{suggestion.originalCommand}" to '{suggestion.suggestedKey}' and add these aliases:</p>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {renderSuggestedAliases()}
                                        </div>
                                        <Button size="sm" onClick={() => handleAddAlias(suggestion)} disabled={isAdding}>
                                            {isAdding ? "Adding..." : `Accept & Add Aliases`}
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                            ) : (
                                <Alert variant="destructive">
                                    <XCircle className="h-4 w-4" />
                                    <AlertTitle>No Confident Suggestion</AlertTitle>
                                    <AlertDescription>
                                        The AI could not confidently match this command. You can delete this log or create a new product/alias manually.
                                    </AlertDescription>
                                </Alert>
                            )}
                         </div>
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
                            <CardTitle className="text-3xl font-headline">AI Training Center</CardTitle>
                            <CardDescription>
                                New failed commands are processed automatically. High-confidence suggestions (>50%) are approved and disappear. Low-confidence ones remain for your review.
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
