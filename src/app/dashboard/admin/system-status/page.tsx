'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, Database, ShieldAlert, RefreshCw, Globe, Lock, Smartphone, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { getSystemStatus } from '@/app/actions';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';

interface ServerStatus {
    status: 'ok' | 'error' | 'loading';
    llmStatus: 'Online' | 'Offline' | 'Degraded' | 'Unknown';
    serverDbStatus: 'Online' | 'Offline' | 'Unavailable' | 'Loading';
    errorMessage?: string | null;
    identity?: string;
    projectId?: string;
    counts: { users: number; stores: number };
}

export default function SystemStatusPage() {
  const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
  const router = useRouter();
  const [status, setStatus] = useState<ServerStatus>({ 
    status: 'loading',
    llmStatus: 'Unknown', 
    serverDbStatus: 'Loading',
    counts: { users: 0, stores: 0 }
  });
  const [isFetching, startFetchingTransition] = useTransition();
  const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  const fetchStatus = useCallback(async () => {
    startFetchingTransition(async () => {
      try {
        const result = await getSystemStatus();
        setStatus({
            status: result.status as 'ok' | 'error' | 'loading',
            llmStatus: (result as any).llmStatus || 'Offline',
            serverDbStatus: (result as any).serverDbStatus || 'Online',
            errorMessage: (result as any).errorMessage || null,
            identity: (result as any).identity,
            projectId: (result as any).projectId,
            counts: result.counts || { users: 0, stores: 0 },
        });
      } catch (error) {
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
    if (!isAdminLoading && !isAdmin) {
      router.replace('/dashboard');
    }
  }, [isAdmin, isAdminLoading, router]);

  useEffect(() => {
    if (isAdmin) {
        fetchStatus();
        const interval = setInterval(fetchStatus, 30000);
        return () => clearInterval(interval);
    }
  }, [fetchStatus, isAdmin]);

  if (isAdminLoading || !isAdmin) {
    return <div className="p-12 text-center h-[80vh] flex flex-col items-center justify-center opacity-20"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>;
  }

  return (
    <div className="p-8 space-y-12 bg-gray-50 min-h-screen pb-32">
       <div className="flex justify-between items-center border-b pb-6 border-black/5">
        <div>
            <h1 className="text-4xl font-black text-gray-950 uppercase italic tracking-tighter">
                Infrastructure Hub
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                CONNECTED TO: <span className="text-primary">{clientProjectId || 'Environment Pending'}</span>
            </p>
        </div>
        <Button onClick={fetchStatus} disabled={isFetching} variant="outline" className="rounded-xl h-12 px-6 border-2 shadow-sm font-black text-[10px] uppercase tracking-widest">
          <RefreshCw className={cn("h-4 w-4 mr-2", isFetching && "animate-spin")} /> Re-Scan
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
         <Card className="rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-4 border-b border-black/5">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-xs tracking-widest">
                    <Lock className="h-4 w-4 text-primary" />
                    Client Project ID
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
                <p className="font-black text-2xl uppercase tracking-tighter text-gray-950">{clientProjectId || 'MISSING'}</p>
                <div className="mt-4 space-y-1">
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Environment Target</p>
                    <p className="text-xs font-black text-gray-700">Client-side Public SDK</p>
                </div>
            </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-4 border-b border-black/5">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-xs tracking-widest">
                    <Globe className="h-4 w-4 text-primary" />
                    Server Project ID
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
                <p className={cn("font-black text-2xl uppercase tracking-tighter", status.status === 'error' ? 'text-red-500' : 'text-primary')}>
                    {status.projectId || 'FETCHING...'}
                </p>
                <div className="mt-4 space-y-1">
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Admin SDK Identity</p>
                    <p className="text-xs font-black text-gray-700 truncate">{status.identity || 'Verifying credentials...'}</p>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
          {status.status === 'error' && (
              <div className="space-y-6">
                  <div className="p-8 rounded-[2.5rem] bg-red-50 border-2 border-red-100 flex items-start gap-4 shadow-lg text-red-900">
                      <ShieldAlert className="h-8 w-8 text-red-600 mt-1 shrink-0" />
                      <div>
                          <h3 className="font-black uppercase text-sm tracking-tight">Identity Verification Failed</h3>
                          <p className="text-xs font-bold opacity-60 leading-relaxed mt-2 uppercase tracking-wide">
                              The server failed to initialize the Admin SDK. Check your SERVICE_ACCOUNT environment variable.
                          </p>
                          <div className="mt-6 p-5 bg-black/10 rounded-2xl text-[10px] font-mono overflow-auto max-w-full border border-red-200">
                              <p className="font-black uppercase opacity-40 mb-2">RAW EXCEPTION:</p>
                              {status.errorMessage}
                          </div>
                      </div>
                  </div>
              </div>
          )}
          
          <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white p-8 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-40">Live Document Audit</h3>
              <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-2xl bg-muted/30 border border-black/5">
                      <p className="text-[8px] font-black uppercase opacity-40 mb-1 text-indigo-600">Global Users</p>
                      <p className="text-2xl font-black text-gray-950">{status.counts.users}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-black/5">
                      <p className="text-[8px] font-black uppercase opacity-40 mb-1 text-green-600">Merchant Hubs</p>
                      <p className="text-2xl font-black text-gray-950">{status.counts.stores}</p>
                  </div>
              </div>
          </Card>
      </div>
    </div>
  );
}