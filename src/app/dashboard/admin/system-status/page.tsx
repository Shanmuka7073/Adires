'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, RefreshCw, Users, Store as StoreIcon, Globe, Lock } from 'lucide-react';
import { getSystemStatus } from '@/app/actions';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface ServerStatus {
    status: 'ok' | 'error' | 'loading';
    llmStatus: 'Online' | 'Offline' | 'Degraded' | 'Unknown';
    serverDbStatus: 'Online' | 'Offline' | 'Unavailable' | 'Loading';
    errorMessage?: string | null;
    identity?: string;
    counts: { users: number; stores: number };
}

export default function SystemStatusPage() {
  const [status, setStatus] = useState<ServerStatus>({ 
    status: 'loading',
    llmStatus: 'Unknown', 
    serverDbStatus: 'Loading',
    counts: { users: 0, stores: 0 }
  });
  const [isFetching, startFetchingTransition] = useTransition();
  const [hostName, setHostName] = useState('');

  const fetchStatus = useCallback(async () => {
    startFetchingTransition(async () => {
      try {
        const result = await getSystemStatus();
        setStatus({
            status: result.status,
            llmStatus: result.llmStatus as any,
            serverDbStatus: result.serverDbStatus as any,
            errorMessage: (result as any).errorMessage || null,
            identity: (result as any).identity,
            counts: result.counts,
        });
      } catch (error) {
        console.error("Failed to fetch system status", error);
        setStatus({ 
            status: 'error',
            llmStatus: 'Offline', 
            serverDbStatus: 'Offline', 
            errorMessage: (error as Error).message,
            counts: { users: 0, stores: 0 }
        });
      }
    });
  }, []);

  useEffect(() => {
    fetchStatus();
    if (typeof window !== 'undefined') setHostName(window.location.hostname);
  }, [fetchStatus]);

  const getStatusInfo = (currentStatus: string) => {
      switch(currentStatus) {
          case 'Online': return { color: 'text-green-500', message: 'Service is operational.' };
          case 'Offline': return { color: 'text-red-500', message: status.errorMessage || 'Service is offline or unreachable.' };
          case 'Degraded': return { color: 'text-yellow-500', message: 'Service is running with degraded performance.' };
          case 'Unavailable': return { color: 'text-red-500', message: status.errorMessage || 'Server failed to connect.' };
          default: return { color: 'text-gray-500', message: 'Checking status...' };
      }
  };

  const dbStatusInfo = getStatusInfo(status.serverDbStatus);
  const llmStatusInfo = getStatusInfo(status.llmStatus);

  return (
    <div className="p-8 space-y-8 bg-gray-50 min-h-screen pb-32">
       <div className="flex justify-between items-center border-b pb-4">
        <div>
            <h1 className="text-3xl font-black text-gray-950 uppercase italic tracking-tighter">
                Infrastructure Audit
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                Connected to: <span className="text-primary">{hostName || 'adires.vercel.app'}</span>
            </p>
        </div>
        <Button onClick={fetchStatus} disabled={isFetching} variant="outline" className="rounded-xl h-10 border-2 shadow-sm font-black text-[10px] uppercase">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} /> Re-Scan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4 border-b border-black/5">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-xs tracking-widest">
                    <Lock className="h-4 w-4 text-primary" />
                    Admin SDK Identity
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <p className={`font-black text-2xl uppercase tracking-tighter ${dbStatusInfo.color}`}>{status.serverDbStatus}</p>
                <div className="mt-2 space-y-1">
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Auth Level</p>
                    <p className="text-xs font-bold text-gray-700">{status.identity || 'Verifying credentials...'}</p>
                </div>
            </CardContent>
        </Card>

         <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4 border-b border-black/5">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-xs tracking-widest">
                    <Database className="h-4 w-4 text-primary" />
                    Firestore OPS
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <p className="text-[8px] font-black uppercase opacity-40">User Records</p>
                        <p className="text-2xl font-black tracking-tighter">{status.counts.users}</p>
                    </div>
                    <div>
                        <p className="text-[8px] font-black uppercase opacity-40">Business Hubs</p>
                        <p className="text-2xl font-black tracking-tighter">{status.counts.stores}</p>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4 border-b border-black/5">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-xs tracking-widest">
                    <Globe className="h-4 w-4 text-primary" />
                    Edge Delivery
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
                <p className={`font-black text-2xl uppercase tracking-tighter text-green-500`}>PROD-READY</p>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">Domain: {hostName}</p>
            </CardContent>
        </Card>
      </div>

      {status.status === 'error' && (
          <div className="p-8 rounded-[2.5rem] bg-red-50 border-2 border-red-100 flex items-start gap-4">
              <ShieldAlert className="h-6 w-6 text-red-600 mt-1 shrink-0" />
              <div>
                  <h3 className="font-black uppercase text-sm text-red-950">Credential Failure</h3>
                  <p className="text-xs font-medium text-red-800 leading-relaxed mt-1">
                      The server could not initialize the Admin SDK. Ensure the <strong>SERVICE_ACCOUNT</strong> secret is correctly added to your environment variables.
                  </p>
                  <pre className="mt-4 p-4 bg-black/10 rounded-xl text-[10px] font-mono overflow-auto max-w-full">
                      {status.errorMessage}
                  </pre>
              </div>
          </div>
      )}
    </div>
  );
}
