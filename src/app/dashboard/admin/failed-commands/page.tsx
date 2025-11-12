
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, query, orderBy, doc, deleteDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import type { FailedVoiceCommand, Product, Store as StoreType, VoiceAlias } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { X, ArrowRight, BrainCircuit } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { generalCommands } from '@/lib/locales/commands';

const ADMIN_EMAIL = 'admin@gmail.com';

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

const createSlug = (text: string) => text.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');

function TrainDialog({ command, isOpen, onOpenChange }: { command: FailedVoiceCommand; isOpen: boolean; onOpenChange: (open: boolean) => void }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const { masterProducts, stores } = useAppStore();
    const [selectedValue, setSelectedValue] = useState('');
    const [isSaving, startSaveTransition] = useTransition();

    const handleSaveAlias = () => {
        if (!selectedValue) {
            toast({ variant: 'destructive', title: 'Please select an item to map to.' });
            return;
        }

        startSaveTransition(async () => {
            if (!firestore) return;

            const [type, key] = selectedValue.split('::');
            const newAlias: Omit<VoiceAlias, 'id'> = {
                key,
                language: command.language,
                alias: command.commandText.toLowerCase(),
                type: type as 'product' | 'store' | 'command',
            };

            try {
                const aliasCollectionRef = collection(firestore, 'voiceAliases');
                await addDoc(aliasCollectionRef, newAlias);

                const failedCommandRef = doc(firestore, 'failedCommands', command.id);
                await deleteDoc(failedCommandRef);

                toast({ title: 'AI Trained!', description: `The system now understands "${command.commandText}".` });
                onOpenChange(false);
            } catch (error) {
                console.error('Error saving alias:', error);
                toast({ variant: 'destructive', title: 'Save Failed', description: 'Could not save the new alias.' });
            }
        });
    };
    
    const allCommands = useMemo(() => Object.entries(generalCommands).map(([key, value]) => ({ key, ...value })), []);

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Train AI</DialogTitle>
                    <DialogDescription>
                        Map the failed user command <span className="font-bold text-primary">"{command.commandText}"</span> to the correct product, store, or action.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Select onValueChange={setSelectedValue}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a product, store, or command..." />
                        </SelectTrigger>
                        <SelectContent className="max-h-80">
                            <SelectGroup>
                                <SelectLabel>Products</SelectLabel>
                                {masterProducts.map(p => (
                                    <SelectItem key={p.id} value={`product::${createSlug(p.name)}`}>{p.name}</SelectItem>
                                ))}
                            </SelectGroup>
                             <SelectGroup>
                                <SelectLabel>Stores</SelectLabel>
                                {stores.map(s => (
                                    <SelectItem key={s.id} value={`store::${createSlug(s.name)}`}>{s.name}</SelectItem>
                                ))}
                            </SelectGroup>
                             <SelectGroup>
                                <SelectLabel>General Commands</SelectLabel>
                                {allCommands.map(c => (
                                    <SelectItem key={c.key} value={`command::${c.key}`}>{c.display}</SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
                    <Button onClick={handleSaveAlias} disabled={!selectedValue || isSaving}>
                        {isSaving ? 'Training...' : 'Train AI'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function FailedCommandsPage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [isProcessing, startTransition] = useTransition();
    const [selectedCommand, setSelectedCommand] = useState<FailedVoiceCommand | null>(null);

    const failedCommandsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: failedCommands, isLoading } = useCollection<FailedVoiceCommand>(failedCommandsQuery);

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
              toast({ title: "Log Entry Removed", description: "The failed command log has been removed." });
            } catch (error) {
              console.error("Failed to remove log:", error);
              toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not remove the log entry." });
            }
        });
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            {selectedCommand && (
                <TrainDialog 
                    command={selectedCommand}
                    isOpen={!!selectedCommand}
                    onOpenChange={(open) => !open && setSelectedCommand(null)}
                />
            )}
            <Card>
                <CardHeader>
                    <CardTitle>AI Self-Learning Center</CardTitle>
                    <CardDescription>
                        Review voice commands the AI failed to understand. Use the "Train" button to teach the AI what the user meant.
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
                        <p className="text-muted-foreground text-center py-12">No failed commands have been logged yet. The AI is performing perfectly!</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User Said</TableHead>
                                    <TableHead>Reason for Failure</TableHead>
                                    <TableHead>Language</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedCommands.map(cmd => (
                                    <TableRow key={cmd.id}>
                                        <TableCell className="font-mono text-base">"{cmd.commandText}"</TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{cmd.reason}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{cmd.language}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <Button 
                                                variant="default"
                                                size="sm"
                                                onClick={() => setSelectedCommand(cmd)}
                                                disabled={isProcessing}
                                                className="mr-2"
                                             >
                                                <BrainCircuit className="mr-2 h-4 w-4" />
                                                Train
                                             </Button>
                                             <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleReject(cmd.id)}
                                                disabled={isProcessing}
                                                title="Reject & Remove Log Entry"
                                             >
                                                <X className="h-4 w-4" />
                                             </Button>
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
