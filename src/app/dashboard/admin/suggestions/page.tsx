
'use client';

import { useState, useTransition, useMemo, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { FailedVoiceCommand, Product, Store, ProductPrice } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Trash2, FileWarning, MessageSquareWarning, Sparkles, Check } from 'lucide-react';
import { suggestAlias, SuggestAliasInput } from '@/ai/flows/suggest-alias-flow';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

const createSlug = (text: string) => text.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');

function FailedCommandRow({ command, allItemNames, onAliasCreated }: { command: FailedVoiceCommand; allItemNames: string[]; onAliasCreated: () => void; }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isDeleting, startDelete] = useTransition();
    const [isSuggesting, startSuggestion] = useTransition();
    const [isSaving, startSaving] = useTransition();
    const [suggestion, setSuggestion] = useState<any>(null);
    const [suggestionError, setSuggestionError] = useState<string | null>(null);

    const handleSuggestFix = () => {
        setSuggestion(null);
        setSuggestionError(null);
        startSuggestion(async () => {
            try {
                const input: SuggestAliasInput = {
                    commandText: command.commandText,
                    language: command.language.split('-')[0],
                    itemNames: allItemNames,
                };
                const result = await suggestAlias(input);
                if (result.isSuggestionAvailable) {
                    setSuggestion(result);
                } else {
                    setSuggestionError("AI could not find a confident suggestion.");
                }
            } catch (error) {
                console.error("AI suggestion failed:", error);
                setSuggestionError("An error occurred while getting AI suggestion.");
            }
        });
    };

    const handleApproveAlias = async () => {
        if (!suggestion || !firestore) return;

        startSaving(async () => {
            try {
                const batch = writeBatch(firestore);

                const newAliasRef = doc(collection(firestore, 'voiceAliases'));
                const newAliasData = {
                    key: createSlug(suggestion.suggestedKey),
                    language: command.language.split('-')[0],
                    alias: suggestion.suggestedAlias.toLowerCase(),
                    type: 'product', // Assuming product for now, a real app might need to determine type
                };
                batch.set(newAliasRef, newAliasData);

                const commandRef = doc(firestore, 'failedCommands', command.id);
                batch.delete(commandRef);

                await batch.commit();

                toast({
                    title: "Alias Created!",
                    description: `"${command.commandText}" will now be recognized as "${suggestion.suggestedKey}".`,
                });
                onAliasCreated();
            } catch (error) {
                console.error("Failed to approve alias:", error);
                toast({ variant: 'destructive', title: "Save Failed", description: "Could not save the new alias." });
            }
        });
    };
    
    const handleDelete = () => {
        startDelete(async () => {
            if (!firestore) return;
            try {
                await deleteDoc(doc(firestore, 'failedCommands', command.id));
                toast({ title: "Command log deleted." });
            } catch (error) {
                toast({ variant: 'destructive', title: "Deletion failed." });
            }
        });
    }

    const formatDateSafe = (date: any) => {
        if (!date) return 'N/A';
        const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        return `${formatDistanceToNow(jsDate, { addSuffix: true })}`;
    }

    return (
        <>
            <TableRow>
                <TableCell>{formatDateSafe(command.timestamp)}</TableCell>
                <TableCell className="font-medium">"{command.commandText}"</TableCell>
                <TableCell><Badge variant="outline">{command.language}</Badge></TableCell>
                <TableCell className="text-sm text-muted-foreground">{command.reason}</TableCell>
                <TableCell className="text-right space-x-1">
                    <Button variant="outline" size="sm" onClick={handleSuggestFix} disabled={isSuggesting}>
                        {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        <span className="ml-2 hidden sm:inline">Suggest Fix</span>
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                </TableCell>
            </TableRow>
            {(suggestion || suggestionError) && (
                 <TableRow>
                    <TableCell colSpan={5} className="p-0">
                        <div className="p-4 bg-muted/50">
                            {suggestion ? (
                                <Alert>
                                    <Sparkles className="h-4 w-4" />
                                    <AlertTitle>AI Suggestion</AlertTitle>
                                    <AlertDescription>
                                        <p>Map command <strong className="text-destructive">"{suggestion.suggestedAlias}"</strong> to item <strong className="text-primary">{suggestion.suggestedKey}</strong>?</p>
                                        <p className="text-xs italic mt-1">Reasoning: {suggestion.reasoning}</p>
                                        <Button size="sm" className="mt-2" onClick={handleApproveAlias} disabled={isSaving}>
                                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                                            Approve & Save Alias
                                        </Button>
                                    </AlertDescription>
                                </Alert>
                             ) : (
                                <Alert variant="destructive">
                                    <AlertTitle>Suggestion Failed</AlertTitle>
                                    <AlertDescription>{suggestionError}</AlertDescription>
                                </Alert>
                            )}
                        </div>
                    </TableCell>
                </TableRow>
            )}
        </>
    );
}

export default function SuggestionsPage() {
    const { firestore } = useFirebase();
    const [key, setKey] = useState(0); // Key to force re-render

    const commandsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore, key]);

    const { data: failedCommands, isLoading } = useCollection<FailedVoiceCommand>(commandsQuery);
    
    const productsQuery = useMemoFirebase(() => firestore ? collection(firestore, 'productPrices') : null, [firestore]);
    const storesQuery = useMemoFirebase(() => firestore ? collection(firestore, 'stores') : null, [firestore]);
    const { data: products } = useCollection<ProductPrice>(productsQuery);
    const { data: stores } = useCollection<Store>(storesQuery);

    const allItemNames = useMemo(() => {
        const productNames = products?.map(p => p.productName) || [];
        const storeNames = stores?.map(s => s.name) || [];
        return [...new Set([...productNames, ...storeNames])];
    }, [products, stores]);

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquareWarning className="h-6 w-6 text-destructive" />
                        AI-Powered Suggestions
                    </CardTitle>
                    <CardDescription>
                        Review voice commands that the system failed to understand. Use the AI to suggest fixes and train the system.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? <p>Loading failed commands...</p> : !failedCommands || failedCommands.length === 0 ? (
                        <div className="text-center py-12">
                            <FileWarning className="mx-auto h-12 w-12 text-muted-foreground" />
                            <p className="mt-4 text-lg font-semibold">No failed commands!</p>
                            <p className="text-muted-foreground mt-2">The voice assistant is working perfectly.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Command Text</TableHead>
                                    <TableHead>Language</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedCommands.map(cmd => (
                                    <FailedCommandRow 
                                        key={cmd.id}
                                        command={cmd}
                                        allItemNames={allItemNames}
                                        onAliasCreated={() => setKey(k => k + 1)}
                                    />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
