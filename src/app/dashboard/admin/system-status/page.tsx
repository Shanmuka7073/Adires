
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, RefreshCw } from 'lucide-react';
import { getSystemStatus } from '@/app/actions';
import { useState, useEffect, useTransition, useCallback } from 'react';
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

  const fetchStatus = useCallback(async () => {
    startFetchingTransition(async () => {
      try {
        const result = await getSystemStatus();
        setStatus(result);
      } catch (error) {
        console.error("Failed to fetch system status", error);
        setStatus({ 
            llmStatus: 'Offline', 
            serverDbStatus: 'Offline', 
            errorMessage: (error as Error).message 
        });
      }
    });
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const getStatusInfo = (currentStatus: 'Online' | 'Offline' | 'Degraded' | 'Unavailable' | 'Loading' | 'Unknown') => {
      switch(currentStatus) {
          case 'Online': return { color: 'text-green-500', message: 'Service is operational.' };
          case 'Offline': return { color: 'text-red-500', message: 'Service is offline or unreachable.' };
          case 'Degraded': return { color: 'text-yellow-500', message: 'Service is running with degraded performance.' };
          case 'Unavailable': return { color: 'text-red-500', message: status.errorMessage || 'Server failed to connect.' };
          case 'Loading':
          case 'Unknown':
          default: return { color: 'text-gray-500', message: 'Checking status...' };
      }
  };

  const dbStatusInfo = getStatusInfo(status.serverDbStatus);
  const llmStatusInfo = getStatusInfo(status.llmStatus);
  const authStatusInfo = getStatusInfo('Online'); // Assuming auth is always online for this view

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
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    Server Database (Admin)
                </CardTitle>
                <CardDescription>Status of the Next.js server's connection to Firestore.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className={`font-bold text-lg ${dbStatusInfo.color}`}>{status.serverDbStatus}</p>
                <p className="text-xs text-muted-foreground">{dbStatusInfo.message}</p>
            </CardContent>
        </Card>
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <BrainCircuit className="h-5 w-5" />
                    AI Model (LLM) Status
                </CardTitle>
                <CardDescription>Status of the core Generative AI service.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className={`font-bold text-lg ${llmStatusInfo.color}`}>{status.llmStatus}</p>
                <p className="text-xs text-muted-foreground">{llmStatusInfo.message}</p>
            </CardContent>
        </Card>
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <ShieldAlert className="h-5 w-5" />
                    Authentication Service
                </CardTitle>
                <CardDescription>Status of Firebase Authentication services.</CardDescription>
            </CardHeader>
            <CardContent>
                <p className={`font-bold text-lg ${authStatusInfo.color}`}>Online</p>
                <p className="text-xs text-muted-foreground">{authStatusInfo.message}</p>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
