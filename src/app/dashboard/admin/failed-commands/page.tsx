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
import { Loader2, Trash2, FileWarning, MessageSquareWarning, Sparkles, Lightbulb, PlusCircle, Save } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { suggestAliasTarget } from '@/app/actions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AISuggestion {
  suggestedTarget: string;
  confidence: number;
}

function SuggestionCard({ suggestion, failedCommand, onSave }: { suggestion: AISuggestion; failedCommand: FailedVoiceCommand; onSave: (aliases: { lang: string, text: string }[]) => void; }) {
    const { toast } = useToast();
    const [newAliases, setNewAliases] = useState({ en: '', te: '', hi: '' });

    const handleSave = () => {
        const aliasesToSave = Object.entries(newAliases)
            .filter(([, text]) => text.trim() !== '')
            .map(([lang, text]) => ({ lang, text: text.trim() }));
        
        if (aliasesToSave.length > 0) {
            onSave(aliasesToSave);
        } else {
            toast({ variant: 'destructive', title: 'No aliases to save.' });
        }
    };
    
    // Pre-fill English alias with the failed command text
    useState(() => {
        setNewAliases(prev => ({...prev, en: failedCommand.commandText.toLowerCase()}));
    });

    return (
        <Card className="mt-4 bg-primary/5 border-primary/20">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Lightbulb className="h-5 w-5 text-primary" />
                    AI Suggestion (Confidence: {(suggestion.confidence * 100).toFixed(0)}%)
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    The user said <strong className="text-foreground">"{failedCommand.commandText}"</strong> and likely meant <strong className="text-foreground">"{suggestion.suggestedTarget}"</strong>.
                </p>
                <div className="space-y-4">
                    <h4 className="font-semibold">Add New Aliases for "{suggestion.suggestedTarget}":</h4>
                    <div>
                        <Label htmlFor="en-alias">English Alias</Label>
                        <Input id="en-alias" value={newAliases.en} onChange={e => setNewAliases(p => ({...p, en: e.target.value}))} placeholder="e.g., onion" />
                    </div>
                     <div>
                        <Label htmlFor="te-alias">Telugu Alias</Label>
                        <Input id="te-alias" value={newAliases.te} onChange={e => setNewAliases(p => ({...p, te: e.target.value}))} placeholder="e.g., ఉల్లిపాయలు" />
                    </div>
                     <div>
                        <Label htmlFor="hi-alias">Hindi Alias</Label>
                        <Input id="hi-alias" value={newAliases.hi} onChange={e => setNewAliases(p => ({...p, hi: e.target.value}))} placeholder="e.g., प्याज" />
                    </div>
                </div>
                 <Button className="w-full" onClick={handleSave}>
                    <Save className="mr-2 h-4 w-4" />
                    Save New Aliases
                </Button>
            </CardContent>
        </Card>
    );
}


function FailedCommandRow({ command }: { command: FailedVoiceCommand; }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isDeleting, startDelete] = useTransition();
    const [isSuggesting, startSuggestion] = useTransition();
    const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
    const [showSuggestionCard, setShowSuggestionCard] = useState(false);
    const { masterProducts, commands } = useAppStore();

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
        startSuggestion(async () => {
            const possibleTargets = [
                ...masterProducts.map(p => p.name),
                ...Object.values(commands).map(c => c.display),
            ];

            try {
                const result = await suggestAliasTarget({
                    failedCommand: command.commandText,
                    possibleTargets,
                });
                if (result.suggestedTarget && result.confidence > 0.5) {
                    setSuggestion(result);
                    setShowSuggestionCard(true);
                } else {
                    toast({ variant: 'destructive', title: 'No suggestion found', description: 'The AI could not find a confident match for this command.' });
                }
            } catch (error) {
                console.error("AI suggestion failed:", error);
                toast({ variant: 'destructive', title: 'AI Request Failed', description: 'Could not get a suggestion from the AI model. Check server logs.' });
            }
        });
    };

    const handleSaveAliases = async (aliases: { lang: string, text: string }[]) => {
       if (!firestore || !suggestion) return;

       const key = suggestion.suggestedTarget.toLowerCase().replace(/ /g, '-');
       const type = masterProducts.some(p => p.name === suggestion.suggestedTarget) ? 'product' : 'command';

       const batch = writeBatch(firestore);

       aliases.forEach(({ lang, text }) => {
           const aliasRef = doc(collection(firestore, 'voiceAliases'));
           batch.set(aliasRef, {
               key: key,
               language: lang,
               alias: text,
               type: type
           });
       });
       
       // Also delete the failed command since it's now fixed.
       const failedCommandRef = doc(firestore, 'failedCommands', command.id);
       batch.delete(failedCommandRef);

       try {
           await batch.commit();
           toast({ title: 'Aliases Saved!', description: `New voice aliases for "${suggestion.suggestedTarget}" have been added.` });
           setShowSuggestionCard(false);
       } catch (error) {
           console.error("Failed to save aliases:", error);
           toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the new aliases.' });
       }
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
                        <AccordionTrigger className="p-4 hover:no-underline">
                             <div className="flex items-center justify-between w-full">
                                <div className="font-mono text-xs w-1/5 text-left">{formatDateSafe(command.timestamp)}</div>
                                <div className="font-medium w-2/5 text-left">"{command.commandText}"</div>
                                <div className="w-1/5 text-center"><Badge variant="outline">{command.language}</Badge></div>
                                <div className="text-sm text-muted-foreground w-1/5 text-left">{command.reason}</div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                             <div className="p-4 bg-muted/50 space-y-4">
                                <div className="flex items-center justify-between">
                                    <Button onClick={handleSuggestFix} size="sm" disabled={isSuggesting}>
                                        {isSuggesting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                                        {showSuggestionCard ? 'Refresh Suggestion' : 'AI Suggest Fix'}
                                    </Button>

                                    <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting} className="float-right">
                                        {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                    </Button>
                                </div>
                                
                                {showSuggestionCard && suggestion && <SuggestionCard suggestion={suggestion} failedCommand={command} onSave={handleSaveAliases} />}
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
                        Review voice commands that the system failed to understand and use AI to suggest fixes.
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
