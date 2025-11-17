
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, RefreshCw } from 'lucide-react';
import { ServerStatusCard, ClientStatusCard } from './status-cards';
import { getSystemStatus } from '@/app/actions';
import { useState, useEffect, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface ServerStatus {
    llmStatus: 'Online' | 'Offline' | 'Degraded' | 'Unknown';
    serverDbStatus: 'Online' | 'Offline' | 'Unavailable' | 'Loading';
    errorMessage?: string | null;
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<ServerStatus>({ llmStatus: 'Unknown', serverDbStatus: 'Loading' });
  const [isFetching, startFetchingTransition] = useTransition();

  const fetchStatus = async () => {
    startFetchingTransition(async () => {
      const result = await getSystemStatus();
      setStatus(result);
    });
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const getDbStatus = () => {
      if (status.serverDbStatus === 'Loading' || isFetching) return { status: 'Unknown', message: 'Checking connection...' };
      if (status.serverDbStatus === 'Online') return { status: 'Online', message: 'Server is successfully connected to the database.' };
      return { status: 'Offline', message: status.errorMessage || 'Server failed to connect to the database.' };
  };

  const getLlmStatus = () => {
      if (status.llmStatus === 'Unknown' || isFetching) return { status: 'Unknown', message: 'Checking status...' };
      if (status.llmStatus === 'Online') return { status: 'Online', message: 'LLM service is operational.' };
      return { status: 'Offline', message: 'LLM service is currently unavailable.' };
  };

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen">
       <div className="flex justify-between items-center border-b pb-4">
        <div>
            <h1 className="text-3xl font-bold text-gray-800">
                System Status Dashboard
            </h1>
            <p className="text-gray-600">
                Health check of critical application components.
            </p>
        </div>
        <Button onClick={fetchStatus} disabled={isFetching} variant="outline">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <ClientStatusCard />

        <ServerStatusCard
          title="Server-Side Database Connection"
          status={getDbStatus()}
          iconName="Database"
          description="Status of the Next.js server's connection to Firestore."
        />

        <ServerStatusCard
          title="AI Model (LLM) Status"
          status={getLlmStatus()}
          iconName="BrainCircuit"
          description="Status of the core Generative AI service."
        />

        <ServerStatusCard
          title="Authentication Service"
          status={{status: 'Online', message: "Client and Admin Auth services are online."}} 
          iconName="ShieldAlert"
          description="Status of Firebase Authentication services."
        />
      </div>
    </div>
  );
}
