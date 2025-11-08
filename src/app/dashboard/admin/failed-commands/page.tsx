
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { FailedVoiceCommand } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Check, X, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition, useState, useEffect } from 'react';
import { addAliasToLocales, getLocales } from '@/app/actions';
import { Input } from '@/components/ui/input';

const ADMIN_EMAIL = 'admin@gmail.com';

const createSlug = (text: string) => text.toLowerCase().replace(/ /g, '-');

const formatDateSafe = (date: any) => {
    if (!date) return 'N/A';
    if (date.seconds) {
      return format(new Date(date.seconds * 1000), 'PPP p');
    }
    if (typeof date === 'string') {
        try {
            return format(parseISO(date), 'PPP p');
        } catch (e) {
            return 'Invalid Date';
        }
    }
    return 'N/A';
};


export default function FailedCommandsPage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [isProcessing, startTransition] = useTransition();
    const [editableSuggestions, setEditableSuggestions] = useState<Record<string, string>>({});

    const failedCommandsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: failedCommands, isLoading, mutate } = useCollection<FailedVoiceCommand>(failedCommandsQuery);
    
    useEffect(() => {
        if (failedCommands) {
            const initialSuggestions = failedCommands.reduce((acc, cmd) => {
                acc[cmd.id] = cmd.suggestedProduct || '';
                return acc;
            }, {});
            setEditableSuggestions(initialSuggestions);
        }
    }, [failedCommands]);


    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }
    
    const handleReject = (commandId: string) => {
        if (!firestore) return;
        startTransition(async () => {
            const commandRef = doc(firestore, 'failedCommands', commandId);
            try {
              await deleteDoc(commandRef);
              toast({ title: "Suggestion Rejected", description: "The failed command log has been removed." });
            } catch (error) {
              console.error("Failed to reject command:", error);
              toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not remove the log entry." });
            }
        });
    }

    const handleAddAlias = (command: FailedVoiceCommand) => {
        const finalProductName = editableSuggestions[command.id];

        if (!finalProductName || !command.commandText || !command.language) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please ensure there is a product name to associate the alias with.' });
            return;
        }

        startTransition(async () => {
            const productKey = createSlug(finalProductName);
            try {
                const result = await addAliasToLocales(productKey, command.commandText, command.language);
                if (result.success) {
                    const commandRef = doc(firestore, 'failedCommands', command.id);
                    await deleteDoc(commandRef);
                    toast({ title: 'Alias Added!', description: `"${command.commandText}" is now an alias for "${finalProductName}".` });
                } else {
                    throw new Error("Server action failed.");
                }
            } catch (error) {
                console.error("Failed to add alias:", error);
                toast({ variant: 'destructive', title: 'Failed to Add Alias', description: (error as Error).message });
            }
        });
    }
    
    const handleSuggestionChange = (commandId: string, value: string) => {
        setEditableSuggestions(prev => ({
            ...prev,
            [commandId]: value
        }));
    };


    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <CardTitle>AI Training Center: Failed Commands</CardTitle>
                    <CardDescription>
                        Review voice commands the AI failed to understand. The AI suggests the closest product match. You can approve the suggestion, correct it, and then approve it to teach the AI.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : !failedCommands || failedCommands.length === 0 ? (
                        <p className="text-muted-foreground text-center py-12">No failed commands have been logged yet. Great job!</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User Said</TableHead>
                                    <TableHead>AI Suggestion (Editable)</TableHead>
                                    <TableHead>Confidence</TableHead>
                                    <TableHead>Language</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedCommands.map(cmd => (
                                    <TableRow key={cmd.id}>
                                        <TableCell className="font-mono text-base">"{cmd.commandText}"</TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-2">
                                                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                                                <Input 
                                                    value={editableSuggestions[cmd.id] || ''}
                                                    onChange={(e) => handleSuggestionChange(cmd.id, e.target.value)}
                                                    placeholder="Enter correct product name..."
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            {cmd.similarityScore ? (
                                                <Badge variant={cmd.similarityScore > 0.7 ? 'default' : (cmd.similarityScore > 0.4 ? 'secondary' : 'destructive')}>
                                                    {(cmd.similarityScore * 100).toFixed(0)}%
                                                </Badge>
                                            ) : (
                                                 <span className="text-muted-foreground text-xs">N/A</span>
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{cmd.language}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                           <div className="flex gap-2 justify-end">
                                             <Button 
                                                variant="destructive" 
                                                size="icon" 
                                                onClick={() => handleReject(cmd.id)}
                                                disabled={isProcessing}
                                                title="Reject Suggestion"
                                             >
                                                <X className="h-4 w-4" />
                                            </Button>
                                            <Button 
                                                variant="default" 
                                                size="icon" 
                                                onClick={() => handleAddAlias(cmd)}
                                                disabled={isProcessing || !editableSuggestions[cmd.id]}
                                                title="Add as Alias"
                                             >
                                                <Check className="h-4 w-4" />
                                            </Button>
                                           </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
