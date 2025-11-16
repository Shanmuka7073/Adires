'use client';

import { useState, useTransition, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { FailedVoiceCommand } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, Trash2, FileWarning, MessageSquareWarning, Wand2, AlertCircle } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { suggestAliasTarget, type AliasTargetSuggestionOutput } from '@/app/actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';


function SuggestionDialog({ suggestion, command, onApply, isOpen, onOpenChange }: { suggestion: AliasTargetSuggestionOutput | null; command: FailedVoiceCommand; onApply: () => void; isOpen: boolean; onOpenChange: (open: boolean) => void; }) {
    if (!suggestion) return null;
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>AI Suggestion for: "{command.commandText}"</DialogTitle>
                    <DialogDescription>
                        The AI analyzed the failed command and provided the following suggestion.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div>
                        <Label className="font-semibold">AI Reasoning</Label>
                        <p className="text-sm p-3 bg-muted rounded-md">{suggestion.reasoning}</p>
                    </div>
                    <div>
                        <Label className="font-semibold">Suggested Target</Label>
                        <p className="text-sm font-mono p-2 bg-muted rounded-md">{suggestion.suggestedTargetKey || 'None'}</p>
                    </div>
                     <div>
                        <Label className="font-semibold">Suggested New Alias</Label>
                        <p className="text-sm font-mono p-2 bg-muted rounded-md">{suggestion.suggestedAlias || 'None'}</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="secondary" onClick={() => onOpenChange(false)}>Close</Button>
                    <Button onClick={onApply} disabled={!suggestion.suggestedTargetKey || !suggestion.suggestedAlias}>
                        Apply This Fix
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function FailedCommandRow({ command }: { command: FailedVoiceCommand; }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { stores, masterProducts, commands } = useAppStore();
    const [isDeleting, startDelete] = useTransition();
    const [isSuggesting, startSuggestion] = useTransition();
    const [isApplyingFix, startApplyingFix] = useTransition();
    const [suggestion, setSuggestion] = useState<AliasTargetSuggestionOutput | null>(null);
    const [isSuggestionOpen, setIsSuggestionOpen] = useState(false);
    
    const getAiSuggestion = () => {
        startSuggestion(async () => {
            try {
                const output = await suggestAliasTarget({
                    commandText: command.commandText,
                    language: command.language,
                    validProducts: masterProducts.map(p => p.name),
                    validStores: stores.map(s => s.name),
                    validCommands: Object.keys(commands)
                });

                if (output) {
                    setSuggestion(output);
                    setIsSuggestionOpen(true);
                } else {
                    toast({ variant: 'destructive', title: 'AI Error', description: 'The AI model did not return a valid suggestion.' });
                }
            } catch (error) {
                console.error("AI suggestion failed:", error);
                toast({ variant: 'destructive', title: 'AI Request Failed', description: 'Could not get a suggestion from the AI model. Check server logs.' });
            }
        });
    };

    const handleApplyFix = () => {
        if (!suggestion?.suggestedTargetKey || !suggestion?.suggestedAlias || !firestore) {
            toast({ variant: 'destructive', title: "Cannot Apply Fix", description: "The suggestion is incomplete." });
            return;
        }

        startApplyingFix(async () => {
             const batch = writeBatch(firestore);
             const aliasType = masterProducts.some(p => p.name === suggestion.suggestedTargetKey) ? 'product' :
                              stores.some(s => s.name === suggestion.suggestedTargetKey) ? 'store' : 'command';

             const newAliasRef = doc(collection(firestore, 'voiceAliases'));
             batch.set(newAliasRef, {
                 key: suggestion.suggestedTargetKey,
                 language: command.language,
                 alias: suggestion.suggestedAlias,
                 type: aliasType,
             });

             const commandRef = doc(firestore, 'failedCommands', command.id);
             batch.delete(commandRef);

             try {
                await batch.commit();
                toast({ title: "Fix Applied!", description: `The alias "${suggestion.suggestedAlias}" has been added.` });
                setIsSuggestionOpen(false);
             } catch (error) {
                 toast({ variant: 'destructive', title: "Failed to Apply Fix" });
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
        <TableRow>
             <SuggestionDialog suggestion={suggestion} command={command} onApply={handleApplyFix} isOpen={isSuggestionOpen} onOpenChange={setIsSuggestionOpen} />
            <TableCell className="font-mono text-xs">{formatDateSafe(command.timestamp)}</TableCell>
            <TableCell>"{command.commandText}"</TableCell>
            <TableCell><Badge variant="outline">{command.language}</Badge></TableCell>
            <TableCell className="text-sm text-muted-foreground">{command.reason}</TableCell>
            <TableCell className="text-right">
                <div className="flex justify-end gap-2">
                    <Button variant="outline" size="sm" onClick={getAiSuggestion} disabled={isSuggesting}>
                        {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        AI Suggest Fix
                    </Button>
                    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                </div>
            </TableCell>
        </TableRow>
    );
}

export default function FailedCommandsPage() {
    const { firestore } = useFirebase();

    const commandsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: failedCommands, isLoading } = useCollection<FailedVoiceCommand>(commandsQuery);

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <MessageSquareWarning className="h-6 w-6 text-destructive" />
                        Failed Voice Commands
                    </CardTitle>
                    <CardDescription>
                        Review voice commands that the system failed to understand. Use the AI to suggest and apply fixes.
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
