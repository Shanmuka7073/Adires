'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useCollection, useMemoFirebase, useFirebase } from '@/firebase';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { FailedVoiceCommand, Product, Store } from '@/lib/types';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { Button } from '@/components/ui/button';
import { Loader2, Trash2, Bot, Sparkles, Lightbulb } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition, useState, useMemo } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useAppStore } from '@/lib/store';
import { suggestAlias } from '@/ai/flows/suggest-alias-flow';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';


function FailedCommandRow({ command }: { command: FailedVoiceCommand }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isDeleting, startDeleteTransition] = useTransition();
    const [isSuggesting, startSuggestionTransition] = useTransition();
    const [suggestion, setSuggestion] = useState<any>(null);
    const { masterProducts, stores } = useAppStore();

    const itemNames = useMemo(() => {
        const productNames = masterProducts.map(p => p.name);
        const storeNames = stores.map(s => s.name);
        return [...new Set([...productNames, ...storeNames])];
    }, [masterProducts, stores]);

    const handleDelete = () => {
        if (!firestore) return;
        startDeleteTransition(async () => {
            try {
                await deleteDoc(doc(firestore, 'failedCommands', command.id));
                toast({ title: 'Command Deleted', description: 'The failed command has been removed.' });
            } catch (error) {
                console.error("Failed to delete command:", error);
                toast({ variant: 'destructive', title: 'Deletion Failed' });
            }
        });
    };

    const handleGetSuggestion = () => {
        startSuggestionTransition(async () => {
            try {
                const result = await suggestAlias({
                    commandText: command.commandText,
                    language: command.language,
                    itemNames,
                });
                setSuggestion(result);
            } catch (error) {
                console.error("Failed to get suggestion:", error);
                toast({ variant: 'destructive', title: 'AI Suggestion Failed' });
            }
        });
    };

    return (
        <Card>
            <CardContent className="p-4 flex flex-col md:flex-row justify-between items-start gap-4">
                <div className="flex-1 space-y-2">
                    <p className="font-mono text-lg text-primary">"{command.commandText}"</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{formatDistanceToNow(command.timestamp.toDate(), { addSuffix: true })}</span>
                        <Badge variant="outline">{command.language}</Badge>
                    </div>
                     {suggestion && (
                        <div className="mt-4 p-3 bg-primary/10 rounded-lg border border-primary/20 text-sm">
                            <div className="flex items-center gap-2 font-semibold text-primary">
                                <Lightbulb className="h-4 w-4" />
                                <span>AI Suggestion</span>
                            </div>
                            {suggestion.isSuggestionAvailable ? (
                                <div className="mt-2 space-y-1">
                                    <p>Create alias <Badge variant="secondary">{suggestion.suggestedAlias}</Badge> for item <Badge>{suggestion.suggestedKey}</Badge>?</p>
                                    <p className="text-xs text-muted-foreground italic">Reason: {suggestion.reasoning}</p>
                                </div>
                            ) : (
                                <p className="text-muted-foreground mt-2">No high-confidence suggestion found.</p>
                            )}
                        </div>
                    )}
                </div>
                <div className="flex items-center gap-2 self-start md:self-center">
                    <Button onClick={handleGetSuggestion} disabled={isSuggesting} size="sm">
                        {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                        <span className="ml-2">Get Suggestion</span>
                    </Button>
                     <AlertDialog>
                        <AlertDialogTrigger asChild>
                           <Button variant="ghost" size="icon" disabled={isDeleting}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This will permanently delete the failed command log: "{command.commandText}".
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </CardContent>
        </Card>
    );
}


export default function SuggestionsPage() {
  const { firestore } = useFirebase();
  const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
  
  const failedCommandsQuery = useMemoFirebase(() => {
    if (!firestore || !isAdmin) return null;
    return query(
        collection(firestore, 'failedCommands'),
        orderBy('timestamp', 'desc')
    );
  }, [firestore, isAdmin]);

  const { data: failedCommands, isLoading: commandsLoading } = useCollection<FailedVoiceCommand>(failedCommandsQuery);

  if (isAdminLoading || commandsLoading) return <p className="p-8">Loading suggestions...</p>;
  if (!isAdmin) return <p className="p-8">Access Denied. You must be an admin to view this page.</p>;

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
       <Card>
        <CardHeader>
            <div className="flex items-center gap-3">
                <Bot className="h-8 w-8 text-primary" />
                <div>
                    <CardTitle className="text-3xl font-headline">AI-Powered Suggestions</CardTitle>
                    <CardDescription>Review failed voice commands and use AI to generate suggestions for new aliases.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent>
            {failedCommands && failedCommands.length > 0 ? (
                <div className="space-y-4">
                    {failedCommands.map(command => (
                        <FailedCommandRow key={command.id} command={command} />
                    ))}
                </div>
            ) : (
                 <div className="text-center py-16">
                    <p className="text-lg font-semibold">No failed commands found!</p>
                    <p className="text-muted-foreground mt-2">The voice assistant is working perfectly.</p>
                </div>
            )}
        </CardContent>
       </Card>
    </div>
  );
}
