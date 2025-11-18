
'use client';

import { useState, useTransition, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquareWarning, Sparkles, Check, Trash2, ShieldAlert } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase, FirestorePermissionError, errorEmitter } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, updateDoc, where } from 'firebase/firestore';
import type { FailedVoiceCommand } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { useAppStore } from '@/lib/store';
import { suggestAlias, SuggestAliasOutput } from '@/ai/flows/suggest-alias-flow';
import { useAdminAuth } from '@/hooks/use-admin-auth';

function formatDateSafe(date: any) {
    if (!date) return 'N/A';
    const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return formatDistanceToNow(jsDate, { addSuffix: true });
}

function FailedCommandRow({ command }: { command: FailedVoiceCommand }) {
    const { toast } = useToast();
    const { firestore } = useFirebase();
    const { masterProducts, stores } = useAppStore();
    const [isSuggesting, startSuggesting] = useTransition();
    const [suggestion, setSuggestion] = useState<SuggestAliasOutput | null>(null);

    const handleSuggestFix = () => {
        startSuggesting(async () => {
            try {
                const itemNames = [
                    ...masterProducts.map(p => p.name),
                    ...stores.map(s => s.name),
                ];
                const result = await suggestAlias({
                    commandText: command.commandText,
                    language: command.language,
                    itemNames: itemNames,
                });
                setSuggestion(result);
                if (!result.isSuggestionAvailable) {
                    toast({
                        variant: 'destructive',
                        title: "No Suggestion Found",
                        description: "The AI could not confidently find a match for this command.",
                    });
                }
            } catch (error) {
                console.error("Suggestion error:", error);
                toast({ variant: 'destructive', title: 'AI Error', description: 'Could not generate a suggestion.' });
            }
        });
    };

    const handleApproveSuggestion = async () => {
        if (!firestore || !suggestion || !suggestion.isSuggestionAvailable) return;

        const aliasDocRef = doc(collection(firestore, 'voiceAliases'));
        const commandDocRef = doc(firestore, 'failedCommands', command.id);

        const batch = writeBatch(firestore);

        // Add the new alias
        batch.set(aliasDocRef, {
            key: suggestion.suggestedKey.toLowerCase().replace(/ /g, '-'),
            language: command.language,
            alias: command.commandText.toLowerCase(),
            type: masterProducts.some(p => p.name === suggestion.suggestedKey) ? 'product' : 'store'
        });

        // Mark the command as resolved
        batch.update(commandDocRef, { status: 'resolved' });

        try {
            await batch.commit();
            toast({ title: 'Alias Approved!', description: 'The new voice alias has been saved.' });
        } catch (error) {
             const permissionError = new FirestorePermissionError({
                path: 'voiceAliases',
                operation: 'create',
                requestResourceData: {key: suggestion.suggestedKey, alias: command.commandText.toLowerCase()},
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    };
    
    const handleDismiss = async () => {
        if (!firestore) return;
        const commandDocRef = doc(firestore, 'failedCommands', command.id);
        try {
            await updateDoc(commandDocRef, { status: 'dismissed' });
            toast({ title: 'Suggestion Dismissed' });
        } catch (error) {
             toast({ variant: 'destructive', title: 'Error', description: 'Could not dismiss the suggestion.' });
        }
    };

    return (
        <TableRow>
            <TableCell>{formatDateSafe(command.timestamp)}</TableCell>
            <TableCell className="font-medium">"{command.commandText}"</TableCell>
            <TableCell><Badge variant="outline">{command.language}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">{command.reason}</TableCell>
            <TableCell className="text-right space-x-1">
                {!suggestion ? (
                     <Button variant="outline" size="sm" onClick={handleSuggestFix} disabled={isSuggesting}>
                        {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                        Suggest Fix
                    </Button>
                ) : suggestion.isSuggestionAvailable ? (
                    <div className="flex items-center gap-2 justify-end">
                        <span className="text-sm">Is this <Badge>{suggestion.suggestedKey}</Badge>?</span>
                         <Button size="sm" variant="secondary" onClick={handleApproveSuggestion}><Check className="mr-2 h-4 w-4" />Approve</Button>
                         <Button size="icon" variant="ghost" onClick={() => setSuggestion(null)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 justify-end">
                        <span className="text-sm text-muted-foreground">No suggestion found.</span>
                        <Button size="sm" variant="ghost" onClick={handleDismiss}>Dismiss</Button>
                    </div>
                )}
            </TableCell>
        </TableRow>
    );
}

export default function SuggestionsPage() {
    const { firestore } = useFirebase();
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();

    const failedCommandsQuery = useMemoFirebase(() => {
        if (!firestore || !isAdmin) return null;
        return query(
            collection(firestore, 'failedCommands'),
            where('status', '==', 'new'),
            orderBy('timestamp', 'desc')
        );
    }, [firestore, isAdmin]);

    const { data: failedCommands, isLoading: isCommandsLoading } = useCollection<FailedVoiceCommand>(failedCommandsQuery);

    if (isAdminLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                <span>Verifying credentials...</span>
            </div>
        );
    }

    if (!isAdmin) {
        return (
             <div className="container mx-auto py-12 px-4 md:px-6">
                <div className="text-center py-12 bg-red-50 border border-red-200 rounded-lg">
                    <ShieldAlert className="h-12 w-12 text-red-500 mx-auto" />
                    <p className="mt-4 text-lg font-semibold text-red-800">Access Denied</p>
                    <p className="text-muted-foreground mt-2">You do not have permission to view this page.</p>
                </div>
            </div>
        );
    }

    const isLoading = isCommandsLoading;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2"><MessageSquareWarning className="h-6 w-6 text-amber-500" /> AI-Powered Suggestions</CardTitle>
                    <CardDescription>
                        Review voice commands that the system failed to understand and use AI to teach it new aliases.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center p-8">
                            <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                            <span>Loading failed commands...</span>
                        </div>
                    ) : !failedCommands || failedCommands.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="mt-4 text-lg font-semibold">All Clear!</p>
                            <p className="text-muted-foreground mt-2">There are no new failed commands to review.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>Command</TableHead>
                                    <TableHead>Language</TableHead>
                                    <TableHead>Reason</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedCommands.map(command => (
                                    <FailedCommandRow key={command.id} command={command} />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
