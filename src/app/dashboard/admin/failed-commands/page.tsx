
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
import { X, ArrowRight } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';

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


export default function FailedCommandsPage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [isProcessing, startTransition] = useTransition();

    const failedCommandsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: failedCommands, isLoading, mutate } = useCollection<FailedVoiceCommand>(failedCommandsQuery);

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
            <Card>
                <CardHeader>
                    <CardTitle>AI Training: Failed Commands Log</CardTitle>
                    <CardDescription>
                        This is a read-only log of voice commands the AI failed to understand. Use the "Voice Commands Control" dashboard to add aliases and train the AI.
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
                                    <TableHead>Reason</TableHead>
                                    <TableHead>Language</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedCommands.map(cmd => (
                                    <TableRow key={cmd.id}>
                                        <TableCell className="font-mono text-base">"{cmd.commandText}"</TableCell>
                                        <TableCell className="text-sm text-muted-foreground">{cmd.reason}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{cmd.language}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                             <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                onClick={() => handleReject(cmd.id)}
                                                disabled={isProcessing}
                                                title="Remove Log Entry"
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
