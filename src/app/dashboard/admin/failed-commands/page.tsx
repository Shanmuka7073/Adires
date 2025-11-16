
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
import { Loader2, Trash2, FileWarning, MessageSquareWarning, Sparkles, Lightbulb, Languages, PlusCircle, Save } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// A simple component to display the static suggestion
function SuggestionCard({ onSave }: { onSave: (alias: string, lang: string) => void }) {
    const { toast } = useToast();

    return (
        <Card className="mt-4 bg-primary/5 border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    Suggestion
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    The user likely meant to say <strong className="text-foreground">"Onions"</strong>.
                </p>
                <div className="space-y-2">
                    <h4 className="font-semibold">Suggested Aliases to Add:</h4>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center p-2 rounded-md bg-background">
                            <Badge variant="secondary">onion (en)</Badge>
                            <Button size="sm" variant="outline" onClick={() => toast({title: "Alias 'onion' added for English."})}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add
                            </Button>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-md bg-background">
                           <Badge variant="secondary">ఉల్లిపాయలు (te)</Badge>
                            <Button size="sm" variant="outline" onClick={() => toast({title: "Alias 'ఉల్లిపాయలు' added for Telugu."})}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add
                            </Button>
                        </div>
                        <div className="flex justify-between items-center p-2 rounded-md bg-background">
                           <Badge variant="secondary">प्याज (hi)</Badge>
                            <Button size="sm" variant="outline" onClick={() => toast({title: "Alias 'प्याज' added for Hindi."})}>
                                <PlusCircle className="mr-2 h-4 w-4" /> Add
                            </Button>
                        </div>
                    </div>
                </div>
                 <Button className="w-full" onClick={() => toast({title: "All suggestions saved!"})}>
                    <Save className="mr-2 h-4 w-4" />
                    Save All Suggestions
                </Button>
            </CardContent>
        </Card>
    );
}


function FailedCommandRow({ command }: { command: FailedVoiceCommand; }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isDeleting, startDelete] = useTransition();
    const [showSuggestion, setShowSuggestion] = useState(false);
    
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

    const handleSuggestFix = () => {
        // Just toggle the display of the static suggestion card
        setShowSuggestion(prev => !prev);
    };

    const handleSaveAlias = (alias: string, lang: string) => {
        // This is where you would normally save to the database.
        // For this example, we just show a toast.
        toast({
            title: `Alias Saved (Example)`,
            description: `Added "${alias}" for language "${lang}".`,
        });
        setShowSuggestion(false);
    };

    const formatDateSafe = (date: any) => {
        if (!date) return 'N/A';
        const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        return `${formatDistanceToNow(jsDate, { addSuffix: true })}`;
    }

    return (
        <TableRow>
            <TableCell colSpan={5} className="p-0">
                <Accordion type="single" collapsible>
                    <AccordionItem value={command.id} className="border-b-0">
                        <AccordionTrigger className="p-4">
                             <div className="flex items-center justify-between w-full">
                                <div className="font-mono text-xs w-1/5 text-left">{formatDateSafe(command.timestamp)}</div>
                                <div className="font-medium w-2/5 text-left">"{command.commandText}"</div>
                                <div className="w-1/5 text-center"><Badge variant="outline">{command.language}</Badge></div>
                                <div className="text-sm text-muted-foreground w-1/5 text-left">{command.reason}</div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <div className="p-4 bg-muted/50 space-y-4">
                                <Button onClick={handleSuggestFix} size="sm">
                                    <Sparkles className="mr-2 h-4 w-4" />
                                    {showSuggestion ? 'Hide Suggestion' : 'Suggest Fix'}
                                </Button>

                                {showSuggestion && <SuggestionCard onSave={handleSaveAlias} />}

                                <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting} className="float-right">
                                    {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                </Button>
                             </div>
                        </AccordionContent>
                    </AccordionItem>
                </Accordion>
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
                        Review voice commands that the system failed to understand and get suggestions for fixes.
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
                                    <TableHead className="w-1/5">Time</TableHead>
                                    <TableHead className="w-2/5">Command Text</TableHead>
                                    <TableHead className="w-1/5 text-center">Language</TableHead>
                                    <TableHead className="w-1/5">Reason</TableHead>
                                    <TableHead className="w-auto p-0"></TableHead>
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
