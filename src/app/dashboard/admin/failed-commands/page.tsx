
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, query, orderBy } from 'firebase/firestore';
import type { FailedVoiceCommand } from '@/lib/types';
import { format, parseISO } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';

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

    const failedCommandsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'failedCommands'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: failedCommands, isLoading } = useCollection<FailedVoiceCommand>(failedCommandsQuery);

    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <CardTitle>Failed Voice Command Log</CardTitle>
                    <CardDescription>
                        A log of all voice commands that the system could not understand or act upon. Use this to identify areas for improvement.
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
                                    <TableHead>Timestamp</TableHead>
                                    <TableHead>Command Text</TableHead>
                                    <TableHead>Reason for Failure</TableHead>
                                    <TableHead>Language</TableHead>
                                    <TableHead>User ID</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {failedCommands.map(cmd => (
                                    <TableRow key={cmd.id}>
                                        <TableCell>{formatDateSafe(cmd.timestamp)}</TableCell>
                                        <TableCell className="font-mono">{cmd.commandText}</TableCell>
                                        <TableCell>
                                            <Badge variant="destructive">{cmd.reason}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{cmd.language}</Badge>
                                        </TableCell>
                                        <TableCell className="font-mono text-xs">{cmd.userId}</TableCell>
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
