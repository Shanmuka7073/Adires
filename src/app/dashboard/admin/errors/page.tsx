
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, query, orderBy, doc, deleteDoc, writeBatch, getDocs } from 'firebase/firestore';
import type { AppError } from '@/lib/types';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trash2, AlertTriangle, FileJson, ShieldOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useState, useTransition } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const ADMIN_EMAIL = 'admin@gmail.com';

function ErrorRow({ errorLog }: { errorLog: AppError }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isDeleting, startDelete] = useTransition();

    const handleDelete = async () => {
        if (!firestore) return;
        startDelete(async () => {
            const errorRef = doc(firestore, 'appErrors', errorLog.id);
            try {
                await deleteDoc(errorRef);
                toast({ title: "Log Deleted", description: "The error log has been successfully removed." });
            } catch (err) {
                console.error("Error deleting log:", err);
                toast({ variant: 'destructive', title: "Deletion Failed", description: "Could not remove the error log." });
            }
        });
    };

    const formatDateSafe = (date: any) => {
        if (!date) return 'N/A';
        const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        return `${formatDistanceToNow(jsDate, { addSuffix: true })}`;
    }

    return (
        <TableRow>
            <TableCell className="font-mono text-xs">{formatDateSafe(errorLog.timestamp)}</TableCell>
            <TableCell>{errorLog.userEmail}</TableCell>
            <TableCell>
                <Badge variant="destructive" className="whitespace-nowrap">
                    {errorLog.errorDetails?.method?.toUpperCase() || 'UNKNOWN'}
                    {' on '}
                    {errorLog.errorDetails?.path?.split('/').slice(-2, -1)[0] || '...'}
                </Badge>
            </TableCell>
            <TableCell className="font-mono text-xs">{errorLog.path}</TableCell>
            <TableCell className="text-right space-x-2">
                <Dialog>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">View Details</Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl">
                        <DialogHeader>
                            <DialogTitle>Error Details</DialogTitle>
                            <DialogDescription>Full context of the permission error.</DialogDescription>
                        </DialogHeader>
                        <ScrollArea className="max-h-[60vh] mt-4">
                            <pre className="bg-muted p-4 rounded-md text-xs overflow-x-auto">
                                {JSON.stringify(errorLog.errorDetails, null, 2)}
                            </pre>
                        </ScrollArea>
                    </DialogContent>
                </Dialog>
                <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
                    <Trash2 className="h-4 w-4" />
                </Button>
            </TableCell>
        </TableRow>
    );
}

export default function AppErrorsPage() {
    const { user, isUserLoading, firestore } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const [isClearing, startClearingTransition] = useTransition();

    const errorsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        return query(collection(firestore, 'appErrors'), orderBy('timestamp', 'desc'));
    }, [firestore]);

    const { data: errorLogs, isLoading: errorsLoading } = useCollection<AppError>(errorsQuery);

    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
        router.replace('/dashboard');
        return <p>Redirecting...</p>;
    }

    const handleClearAll = async () => {
        if (!firestore) return;
        startClearingTransition(async () => {
            try {
                const logsQuery = query(collection(firestore, 'appErrors'));
                const querySnapshot = await getDocs(logsQuery);
                const batch = writeBatch(firestore);
                querySnapshot.forEach((doc) => {
                    batch.delete(doc.ref);
                });
                await batch.commit();
                toast({ title: 'Success', description: 'All application error logs have been cleared.' });
            } catch (error) {
                console.error("Error clearing error logs:", error);
                toast({ variant: 'destructive', title: 'Error', description: 'Could not clear the error logs.' });
            }
        });
    };
    
    const isLoading = isUserLoading || errorsLoading;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle className="flex items-center gap-2"><ShieldOff className="h-6 w-6 text-destructive" /> Application Error Log</CardTitle>
                            <CardDescription>
                                A log of all permission errors and other critical issues encountered by users.
                            </CardDescription>
                        </div>
                        {errorLogs && errorLogs.length > 0 && (
                             <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" disabled={isClearing}>
                                        <Trash2 className="mr-2 h-4 w-4" />
                                        Clear All Logs
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                            This will permanently delete all {errorLogs.length} error logs. This action cannot be undone.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={handleClearAll} disabled={isClearing}>
                                            {isClearing ? 'Clearing...' : 'Yes, clear all'}
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                         <div className="space-y-4">
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                            <Skeleton className="h-12 w-full" />
                        </div>
                    ) : !errorLogs || errorLogs.length === 0 ? (
                        <div className="text-center py-12">
                            <FileJson className="mx-auto h-12 w-12 text-muted-foreground" />
                             <p className="mt-4 text-lg font-semibold">No errors logged!</p>
                            <p className="text-muted-foreground mt-2">The application is running smoothly.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Time</TableHead>
                                    <TableHead>User</TableHead>
                                    <TableHead>Action</TableHead>
                                    <TableHead>Page Path</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {errorLogs.map(log => (
                                    <ErrorRow key={log.id} errorLog={log} />
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
