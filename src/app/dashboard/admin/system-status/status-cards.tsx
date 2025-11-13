
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, AlertCircle, Server, BrainCircuit, Database, Users, Store as StoreIcon, ShieldAlert } from 'lucide-react';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Status {
  status: 'ok' | 'error' | 'loading';
  message: string;
}

const iconMap = {
    Users,
    StoreIcon,
    ShieldAlert,
    Database,
    // Add other icons here as needed
};


interface ServerStatusCardProps {
    title: string;
    description: string;
    status: Status;
    iconName: keyof typeof iconMap;
    link?: string;
}

export function ServerStatusCard({ title, description, status, iconName, link }: ServerStatusCardProps) {
  const Icon = iconMap[iconName] || Server; // Fallback to a default icon

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
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
                <Icon className="h-6 w-6 text-muted-foreground" />
                <CardTitle className="text-lg">{title}</CardTitle>
            </div>
            {getStatusIcon()}
        </div>
        <CardDescription className="pt-2">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className={`font-mono text-sm ${getStatusColor()}`}>{status.message}</p>
        {link && status.status === 'error' && (
            <Button asChild variant="secondary" size="sm" className="mt-4">
                <Link href={link}>Review Errors</Link>
            </Button>
        )}
      </CardContent>
    </Card>
  );
}


export function ClientStatusCard() {
    const { firestore, isUserLoading } = useFirebase();
    const [firestoreStatus, setFirestoreStatus] = useState<Status>({ status: 'loading', message: 'Checking client connection...' });

    // Check Client Firestore Connection
    useEffect(() => {
        if (firestore) {
            setFirestoreStatus({ status: 'ok', message: 'Client successfully connected to Firestore.' });
        } else if (!isUserLoading) {
            setFirestoreStatus({ status: 'error', message: 'Client could not connect to Firestore.' });
        }
    }, [firestore, isUserLoading]);

    return (
         <ServerStatusCard 
            title="Client Firestore Connection"
            description="Verifies that the user's browser can connect to the database."
            status={firestoreStatus}
            iconName="Database"
        />
    )
}
