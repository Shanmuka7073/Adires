
'use client';

import { useState, useTransition, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import type { FailedVoiceCommand, Store, Product } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Trash2, Sparkles, AlertCircle, FileWarning, ThumbsUp, MessageSquareWarning } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { suggestAliasTarget } from '@/app/actions';
import { useAppStore } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogFooter } from '@/components/ui/dialog';

const ADMIN_EMAIL = 'admin@gmail.com';

function FailedCommandRow({ command, onSuggestion, isProcessingId }: { command: FailedVoiceCommand; onSuggestion: (cmd: FailedVoiceCommand) => void; isProcessingId: string | null; }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isDeleting, startDelete] = useTransition();

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
        <TableRow>
            <TableCell className="font-mono text-xs">{formatDateSafe(command.timestamp)}</TableCell>
            <TableCell>"{command.commandText}"</TableCell>
            <TableCell><Badge variant="outline">{command.language}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">{command.reason}</TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Button
                        size="sm"
                        onClick={() => onSuggestion(command)}
                        disabled={isProcessingId === command.id}
                    >
                        {isProcessingId === command.id ? (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Sparkles className="mr-2 h-4 w-4" />
                        )}
                        AI Suggest Fix
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

export default function FailedCommandsPage() {
    const { firestore, user } = useFirebase();
    const { masterProducts, stores, commands } = useAppStore();
    const { toast } = useToast();

    const commandsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: failedCommands, isLoading } = useCollection<FailedVoiceCommand>(commandsQuery);
    const [isProcessingId, setIsProcessingId] = useState<string | null>(null);
    const [suggestion, setSuggestion] = useState<{ command: FailedVoiceCommand; result: any } | null>(null);
    const [isSaving, startSaveTransition] = useTransition();


    const handleGetSuggestion = async (command: FailedVoiceCommand) => {
        setIsProcessingId(command.id);
        try {
            const result = await suggestAliasTarget({
                commandText: command.commandText,
                language: command.language,
                validProducts: masterProducts.map(p => p.name),
                validStores: stores.map(s => s.name),
                validCommands: Object.keys(commands),
            });
            setSuggestion({ command, result });
        } catch (error) {
            console.error("AI Suggestion Error:", error);
            toast({ variant: 'destructive', title: 'AI Error', description: 'Could not get a suggestion.' });
        } finally {
            setIsProcessingId(null);
        }
    };
    
    const handleSaveSuggestion = async () => {
        if (!firestore || !suggestion) return;

        const { command, result } = suggestion;
        const { suggestedTargetKey, suggestedAlias } = result;

        if (!suggestedTargetKey || !suggestedAlias) {
            toast({ variant: 'destructive', title: 'Incomplete Suggestion', description: 'Cannot save without a target and an alias.' });
            return;
        }

        startSaveTransition(async () => {
            try {
                const batch = writeBatch(firestore);

                // Find the type of the target
                let targetType: 'product' | 'store' | 'command' = 'command';
                if (masterProducts.some(p => p.name === suggestedTargetKey)) targetType = 'product';
                else if (stores.some(s => s.name === suggestedTargetKey)) targetType = 'store';
                
                const createSlug = (text: string) => text.toLowerCase().replace(/ /g, '-');

                const aliasData = {
                    key: createSlug(suggestedTargetKey),
                    language: command.language,
                    alias: suggestedAlias.toLowerCase(),
                    type: targetType,
                };
                
                const aliasRef = doc(collection(firestore, 'voiceAliases'));
                batch.set(aliasRef, aliasData);

                // Mark the failed command as resolved by deleting it
                const commandRef = doc(firestore, 'failedCommands', command.id);
                batch.delete(commandRef);

                await batch.commit();
                toast({ title: 'Alias Saved!', description: `New alias "${aliasData.alias}" for "${suggestedTargetKey}" has been added.` });
                setSuggestion(null);

            } catch (error) {
                console.error("Failed to save alias:", error);
                toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the new alias.' });
            }
        });
    };
    
    const handleDismissSuggestion = async (command: FailedVoiceCommand) => {
        if (!firestore) return;
        const commandRef = doc(firestore, 'failedCommands', command.id);
        try {
            await updateDoc(commandRef, { status: 'no_suggestion' });
            toast({ title: 'Suggestion Ignored', description: 'This command will be ignored for now.' });
            setSuggestion(null);
        } catch (error) {
            toast({ variant: 'destructive', title: 'Update Failed' });
        }
    };


    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
             <Dialog open={!!suggestion} onOpenChange={() => setSuggestion(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>AI Suggestion for Failed Command</DialogTitle>
                        <DialogDescription>
                            Review the AI's analysis for the command: "{suggestion?.command.commandText}"
                        </DialogDescription>
                    </DialogHeader>
                    {suggestion && (
                        <div className="space-y-4 py-4">
                            <p><strong>AI Reasoning:</strong> <span className="italic text-muted-foreground">{suggestion.result.reasoning}</span></p>
                            <Alert>
                                <ThumbsUp className="h-4 w-4" />
                                <AlertTitle>Suggested Fix</AlertTitle>
                                <AlertDescription>
                                    <p>The AI suggests mapping the new alias:</p>
                                    <p className="mt-2">
                                        <Badge variant="secondary">{suggestion.result.suggestedAlias || "None"}</Badge> &rarr; <Badge>{suggestion.result.suggestedTargetKey || "None"}</Badge>
                                    </p>
                                </AlertDescription>
                            </Alert>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => handleDismissSuggestion(suggestion!.command)}>Ignore</Button>
                        <Button onClick={handleSaveSuggestion} disabled={isSaving || !suggestion?.result.suggestedAlias || !suggestion?.result.suggestedTargetKey}>
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                            Approve & Save Alias
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquareWarning className="h-6 w-6 text-destructive" />
                        Failed Voice Commands
                    </CardTitle>
                    <CardDescription>
                        Review voice commands that the system failed to understand and use AI to train the system.
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
                                        onSuggestion={handleGetSuggestion}
                                        isProcessingId={isProcessingId}
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
