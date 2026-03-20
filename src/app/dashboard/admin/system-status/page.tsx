
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, RefreshCw, Users, Store as StoreIcon } from 'lucide-react';
import { getSystemStatus } from '@/app/actions';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface ServerStatus {
    status: 'ok' | 'error' | 'loading';
    llmStatus: 'Online' | 'Offline' | 'Degraded' | 'Unknown';
    serverDbStatus: 'Online' | 'Offline' | 'Unavailable' | 'Loading';
    errorMessage?: string | null;
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

  const fetchStatus = useCallback(async () => {
    startFetchingTransition(async () => {
      try {
        const result = await getSystemStatus();
        setStatus(result);
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
        <Button onClick={fetchStatus} disabled={isFetching} variant="outline" className="rounded-xl h-10 border-2">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm tracking-tight">
                    <Database className="h-4 w-4 text-primary" />
                    Server Database
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase opacity-40">Admin SDK Status</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <p className={`font-black text-2xl uppercase tracking-tighter ${dbStatusInfo.color}`}>{status.serverDbStatus}</p>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">{dbStatusInfo.message}</p>
            </CardContent>
        </Card>

         <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm tracking-tight">
                    <BrainCircuit className="h-4 w-4 text-primary" />
                    AI Services
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase opacity-40">Gemini 1.5 Flash</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <p className={`font-black text-2xl uppercase tracking-tighter ${llmStatusInfo.color}`}>{status.llmStatus}</p>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">{llmStatusInfo.message}</p>
            </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-sm tracking-tight">
                    <ShieldAlert className="h-4 w-4 text-primary" />
                    Authentication
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase opacity-40">Platform Identity</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                <p className={`font-black text-2xl uppercase tracking-tighter ${authStatusInfo.color}`}>Online</p>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-1">{authStatusInfo.message}</p>
            </CardContent>
        </Card>
      </div>

      <div className="pt-8">
          <h2 className="text-xs font-black uppercase tracking-[0.3em] opacity-40 mb-6 px-1">Infrastructure Metrics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="rounded-[2rem] border-0 shadow-lg bg-white">
                  <CardHeader className="pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Total Active Users</span>
                  </CardHeader>
                  <CardContent className="flex items-end justify-between">
                      <p className="text-5xl font-black tracking-tighter italic text-gray-900">{status.counts?.users ?? 0}</p>
                      <Users className="h-10 w-10 opacity-10" />
                  </CardContent>
              </Card>
              <Card className="rounded-[2rem] border-0 shadow-lg bg-white">
                  <CardHeader className="pb-2">
                      <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Verified Local Hubs</span>
                  </CardHeader>
                  <CardContent className="flex items-end justify-between">
                      <p className="text-5xl font-black tracking-tighter italic text-gray-900">{status.counts?.stores ?? 0}</p>
                      <StoreIcon className="h-10 w-10 opacity-10" />
                  </CardContent>
              </Card>
          </div>
      </div>
    </div>
  );
}
