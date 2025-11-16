
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Trash2, KeyRound, CheckCircle, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';
import { formatDistanceToNow } from 'date-fns';

const ADMIN_EMAIL = 'admin@gmail.com';

// Define the type for a login attempt log
type LoginAttempt = {
  id: string;
  email: string;
  timestamp: any; // Can be Firebase Timestamp or Date
  status: 'success' | 'failure';
  ipAddress: string;
  userAgent: string;
  location?: string;
  errorMessage?: string;
};

function LoginHistoryRow({ log }: { log: LoginAttempt }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isDeleting, startDelete] = useTransition();

  const handleDelete = () => {
    if (!firestore) return;
    startDelete(async () => {
      const logRef = doc(firestore, 'loginHistory', log.id);
      try {
        await deleteDoc(logRef);
        toast({ title: 'Log Deleted', description: 'The login record has been removed.' });
      } catch (err) {
        console.error('Error deleting log:', err);
        toast({ variant: 'destructive', title: 'Deletion Failed' });
      }
    });
  };

  const formatDateSafe = (date: any) => {
    if (!date) return 'N/A';
    try {
      const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
      return formatDistanceToNow(jsDate, { addSuffix: true });
    } catch {
      return 'Invalid Date';
    }
  };

  const statusVariant = log.status === 'success' ? 'default' : 'destructive';
  const StatusIcon = log.status === 'success' ? CheckCircle : XCircle;

  return (
    <TableRow>
      <TableCell className="font-mono text-xs">{formatDateSafe(log.timestamp)}</TableCell>
      <TableCell>
        <Badge variant={statusVariant} className="flex items-center gap-1.5">
          <StatusIcon className="h-3.5 w-3.5" />
          {log.status}
        </Badge>
      </TableCell>
      <TableCell>{log.email}</TableCell>
      <TableCell className="font-mono text-xs">{log.ipAddress}</TableCell>
      <TableCell className="text-sm text-muted-foreground">{log.location || 'N/A'}</TableCell>
      <TableCell className="text-right">
        <Button variant="ghost" size="icon" onClick={handleDelete} disabled={isDeleting}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default function LoginHistoryPage() {
  const { user, isUserLoading, firestore } = useFirebase();
  const router = useRouter();

  const loginHistoryQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'loginHistory'), orderBy('timestamp', 'desc'));
  }, [firestore]);

  const { data: loginLogs, isLoading: logsLoading } = useCollection<LoginAttempt>(loginHistoryQuery);

  if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
    router.replace('/dashboard');
    return <p>Redirecting...</p>;
  }

  const isLoading = isUserLoading || logsLoading;

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-6 w-6 text-primary" /> Login Attempt History
          </CardTitle>
          <CardDescription>A log of all successful and failed login attempts to your application.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : !loginLogs || loginLogs.length === 0 ? (
            <div className="text-center py-12">
              <KeyRound className="mx-auto h-12 w-12 text-muted-foreground" />
              <p className="mt-4 text-lg font-semibold">No login attempts recorded yet.</p>
              <p className="text-muted-foreground mt-2">This table will populate as users try to log in.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loginLogs.map((log) => (
                  <LoginHistoryRow key={log.id} log={log} />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
