
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useFirebase } from '@/firebase';
import { cn } from '@/lib/utils';
import { Server, BrainCircuit, Database, ShieldAlert, Monitor } from 'lucide-react';
import { useMemo } from 'react';

// Define the type for the status prop
interface StatusInfo {
    status: 'Online' | 'Offline' | 'Degraded' | 'Unknown' | 'Unavailable' | 'Loading';
    message?: string;
}

const iconMap = {
    BrainCircuit,
    Database,
    ShieldAlert,
    Monitor,
    Server,
};

type IconName = keyof typeof iconMap;


const getStatusColor = (status: StatusInfo['status']) => {
    switch (status) {
        case 'Online': return 'text-green-500';
        case 'Offline':
        case 'Unavailable':
            return 'text-red-500';
        case 'Degraded': return 'text-yellow-500';
        default: return 'text-gray-500';
    }
};

export function ServerStatusCard({ title, status, description, iconName }: { title: string, status: StatusInfo, description: string, iconName: IconName }) {
    const Icon = iconMap[iconName];

    return (
        <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    {Icon && <Icon className="h-5 w-5" />}
                    {title}
                </CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <p className={cn("font-bold text-lg", getStatusColor(status.status))}>{status.status}</p>
                <p className="text-xs text-muted-foreground">{status.message}</p>
            </CardContent>
        </Card>
    );
}

export function ClientStatusCard() {
    const { firestore, auth, firebaseApp } = useFirebase();

    const clientStatus = useMemo(() => {
        if (firestore && auth && firebaseApp) {
            return { status: 'Online' as const, message: 'Services are connected.' };
        }
        return { status: 'Offline' as const, message: 'Client is not connected to Firebase.' };
    }, [firestore, auth, firebaseApp]);

    return (
         <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Monitor className="h-5 w-5" />
                    Client Database (Your Browser)
                </CardTitle>
                <CardDescription>Status of your browser's connection to Firestore.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className={cn("font-bold text-lg", getStatusColor(clientStatus.status))}>{clientStatus.status}</p>
                <p className="text-xs text-muted-foreground">{clientStatus.message}</p>
            </CardContent>
        </Card>
    )
}
