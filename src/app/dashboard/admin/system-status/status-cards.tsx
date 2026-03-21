
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
        <Card className="rounded-[2rem] border-0 shadow-lg overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm tracking-tight">
                    {Icon && <Icon className="h-4 w-4 text-primary" />}
                    {title}
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase opacity-40">{description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <p className={cn("font-black text-2xl uppercase tracking-tighter", getStatusColor(status.status))}>{status.status}</p>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">{status.message}</p>
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
         <Card className="rounded-[2rem] border-0 shadow-lg overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm tracking-tight">
                    <Monitor className="h-4 w-4 text-primary" />
                    Client Database
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase opacity-40">Local Browser Connection</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <p className={cn("font-black text-2xl uppercase tracking-tighter", getStatusColor(clientStatus.status))}>{clientStatus.status}</p>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">{clientStatus.message}</p>
            </CardContent>
        </Card>
    )
}
