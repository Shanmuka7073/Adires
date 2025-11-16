'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CheckCircle, AlertCircle, Server, BrainCircuit, Database, Users, Store as StoreIcon, ShieldAlert, RefreshCw } from 'lucide-react';
import { useFirebase, useMemoFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import Link from 'next/link';

interface Status {
  status: 'ok' | 'error' | 'loading' | 'Online' | 'Offline' | 'Degraded' | 'Unavailable';
  message: string;
}

const iconMap = {
    Users,
    StoreIcon,
    ShieldAlert,
    Database,
    BrainCircuit,
    Server
};


interface ServerStatusCardProps {
    title: string;
    description: string;
    status: Status;
    iconName: keyof typeof iconMap;
    link?: string;
    onRefresh?: () => void;
    isRefreshing?: boolean;
}

export function ServerStatusCard({ title, description, status, iconName, link, onRefresh, isRefreshing }: ServerStatusCardProps) {
  const Icon = iconMap[iconName] || Server; // Fallback to a default icon

  const getStatusColor = () => {
    switch (status.status) {
      case 'ok':
      case 'Online':
        return 'text-green-500';
      case 'error':
      case 'Offline':
      case 'Degraded':
      case 'Unavailable':
        return 'text-destructive';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusIcon = () => {
    switch (status.status) {
      case 'ok':
      case 'Online':
        return <CheckCircle className={`h-6 w-6 ${getStatusColor()}`} />;
      case 'error':
      case 'Offline':
      case 'Degraded':
      case 'Unavailable':
        return <AlertCircle className={`h-6 w-6 ${getStatusColor()}`} />;
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
            <div className="flex items-center gap-2">
                {onRefresh && (
                    <Button variant="ghost" size="icon" onClick={onRefresh} disabled={isRefreshing}>
                        <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                    </Button>
                )}
                {getStatusIcon()}
            </div>
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
