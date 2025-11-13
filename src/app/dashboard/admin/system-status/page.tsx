
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { CheckCircle, AlertCircle, Users, Server, BrainCircuit, Database, ShieldAlert } from 'lucide-react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { getSystemStatus } from '@/app/actions';
import { collection, query, where, limit } from 'firebase/firestore';
import type { Store } from '@/lib/types';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const ADMIN_EMAIL = 'admin@gmail.com';

interface Status {
  status: 'ok' | 'error' | 'loading';
  message: string;
}

function StatusCard({ title, description, status, onTest, testLabel }: { title: string; description: string; status: Status; onTest?: () => void; testLabel?: string; }) {
  const getStatusColor = () => {
    switch (status.status) {
      case 'ok': return 'text-green-500';
      case 'error': return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'ok': return <CheckCircle className={`h-6 w-6 ${getStatusColor()}`} />;
      case 'error': return <AlertCircle className={`h-6 w-6 ${getStatusColor()}`} />;
      default: return <Skeleton className="h-6 w-6 rounded-full" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
            <CardTitle className="text-lg">{title}</CardTitle>
            {getStatusIcon()}
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={`font-mono text-sm ${getStatusColor()}`}>{status.message}</p>
        {onTest && (
            <Button onClick={onTest} variant="secondary" size="sm" className="mt-4">
                {testLabel || 'Run Test'}
            </Button>
        )}
      </CardContent>
    </Card>
  );
}

export default function SystemStatusPage() {
  const { user, isUserLoading, firestore } = useFirebase();
  const router = useRouter();

  const [backendStatus, setBackendStatus] = useState<Status>({ status: 'loading', message: 'Checking backend status...' });
  const [firestoreStatus, setFirestoreStatus] = useState<Status>({ status: 'loading', message: 'Checking client connection...' });
  
  const adminStoreQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    return query(collection(firestore, 'stores'), where('name', '==', 'LocalBasket'), limit(1));
  }, [firestore]);
  
  const { data: adminStores, isLoading: isMasterStoreLoading, error: masterStoreError } = useCollection<Store>(adminStoreQuery);
  const { data: errors, isLoading: isErrorsLoading } = useCollection(useMemoFirebase(() => firestore ? collection(firestore, 'appErrors') : null, [firestore]));

  // Check Backend Status (Server Action)
  useEffect(() => {
    getSystemStatus().then(result => {
      if (result.status === 'ok') {
        setBackendStatus({ status: 'ok', message: `${result.userCount} users registered.` });
      } else {
        setBackendStatus({ status: 'error', message: 'Could not connect to backend services.' });
      }
    }).catch(() => {
        setBackendStatus({ status: 'error', message: 'Failed to execute status check.' });
    });
  }, []);

  // Check Client Firestore Connection
  useEffect(() => {
    if (firestore) {
      setFirestoreStatus({ status: 'ok', message: 'Client successfully connected to Firestore.' });
    } else if (!isUserLoading) {
       setFirestoreStatus({ status: 'error', message: 'Client could not connect to Firestore.' });
    }
  }, [firestore, isUserLoading]);
  
  useEffect(() => {
    if (!isUserLoading && (!user || user.email !== ADMIN_EMAIL)) {
      router.replace('/dashboard');
    }
  }, [isUserLoading, user, router]);
  
  const masterStoreStatus = useMemo((): Status => {
    if (isMasterStoreLoading) return { status: 'loading', message: 'Verifying master store...' };
    if (masterStoreError) return { status: 'error', message: 'Permission error checking store.' };
    if (!adminStores || adminStores.length === 0) return { status: 'error', message: 'Master "LocalBasket" store not found.' };
    return { status: 'ok', message: 'Master store is configured.' };
  }, [isMasterStoreLoading, adminStores, masterStoreError]);

  const errorLogStatus = useMemo((): Status => {
    if (isErrorsLoading) return { status: 'loading', message: 'Checking error logs...' };
    if (!errors) return { status: 'ok', message: 'No errors logged.' };
    return { status: 'error', message: `${errors.length} error(s) logged. Review required.` };
  }, [isErrorsLoading, errors]);

  if (isUserLoading || !user || user.email !== ADMIN_EMAIL) {
    return <div className="container mx-auto py-12">Loading...</div>;
  }
  
  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold font-headline">System Health Check</h1>
        <p className="text-lg text-muted-foreground mt-2">
          An overview of your application's core services and configurations.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
        <StatusCard 
            title="Backend Services"
            description="Checks server functions and user authentication status."
            status={backendStatus}
            icon={Server}
        />
         <StatusCard 
            title="Client Firestore Connection"
            description="Verifies that the user's browser can connect to the database."
            status={firestoreStatus}
            icon={Database}
        />
        <StatusCard 
            title="GenAI API"
            description="Checks if the GenAI services are configured. Test with the AI Test Card on the main admin dashboard."
            status={{ status: 'ok', message: 'GenAI provider configured.'}}
            icon={BrainCircuit}
            onTest={() => router.push('/dashboard/admin')}
            testLabel="Go to Test Card"
        />
        <StatusCard 
            title="Master Store"
            description="Ensures the master 'LocalBasket' store for canonical products exists."
            status={masterStoreStatus}
            icon={Store}
        />
         <StatusCard 
            title="User Count"
            description="Total number of registered users in the system."
            status={backendStatus.status === 'error' ? {status: 'error', message: 'Could not fetch count.'} : {status: backendStatus.status, message: backendStatus.message}}
            icon={Users}
        />
         <StatusCard 
            title="Application Error Log"
            description="Monitors for logged application or permission errors."
            status={errorLogStatus}
            icon={ShieldAlert}
            onTest={errorLogStatus.status === 'error' ? () => router.push('/dashboard/admin/errors') : undefined}
            testLabel="Review Errors"
        />
      </div>
    </div>
  );
}
