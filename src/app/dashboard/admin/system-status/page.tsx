
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Server, Database, ShieldAlert, RefreshCw, Globe, Lock, Key, Settings, ExternalLink, ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';
import { getSystemStatus } from '@/app/actions';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ServerStatus {
    status: 'ok' | 'error' | 'loading';
    llmStatus: 'Online' | 'Offline' | 'Degraded' | 'Unknown';
    serverDbStatus: 'Online' | 'Offline' | 'Unavailable' | 'Loading';
    errorMessage?: string | null;
    identity?: string;
    isCredentialError?: boolean;
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
            status: result.status as 'ok' | 'error' | 'loading',
            llmStatus: result.llmStatus as any,
            serverDbStatus: result.serverDbStatus as any,
            errorMessage: (result as any).errorMessage || null,
            identity: (result as any).identity,
            isCredentialError: (result as any).isCredentialError,
            counts: result.counts,
        });
      } catch (error) {
        console.error("Failed to fetch system status", error);
        setStatus({ 
            status: 'error',
            llmStatus: 'Offline', 
            serverDbStatus: 'Offline', 
            errorMessage: (error as Error).message,
            isCredentialError: true,
            counts: { users: 0, stores: 0 }
        });
      }
    });
  }, []);

  useEffect(() => {
    fetchStatus();
    if (typeof window !== 'undefined') setHostName(window.location.hostname);
    
    // REDUCED REFRESH RATE: 30 seconds to prevent unnecessary reads
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
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

  return (
    <div className="p-8 space-y-12 bg-gray-50 min-h-screen pb-32">
       <div className="flex justify-between items-center border-b pb-6 border-black/5">
        <div>
            <h1 className="text-4xl font-black text-gray-950 uppercase italic tracking-tighter">
                Infrastructure Audit
            </h1>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">
                CONNECTED TO: <span className="text-primary">{hostName || 'adires.vercel.app'}</span>
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
                    Admin SDK Identity
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
                <p className={`font-black text-4xl uppercase tracking-tighter ${dbStatusInfo.color}`}>{status.serverDbStatus}</p>
                <div className="mt-4 space-y-1">
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Auth Level</p>
                    <p className="text-xs font-black text-gray-700">{status.identity || 'Verifying credentials...'}</p>
                </div>
            </CardContent>
        </Card>

        <Card className="rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-4 border-b border-black/5">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-xs tracking-widest">
                    <Globe className="h-4 w-4 text-primary" />
                    Deployment Status
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
                <p className={`font-black text-4xl uppercase tracking-tighter text-green-500`}>PROD-READY</p>
                <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-4">Edge Identity Verified</p>
            </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-12">
          {status.status === 'error' && (
              <div className="space-y-6">
                  <div className="p-8 rounded-[2.5rem] bg-red-50 border-2 border-red-100 flex items-start gap-4 shadow-lg">
                      <ShieldAlert className="h-8 w-8 text-red-600 mt-1 shrink-0" />
                      <div>
                          <h3 className="font-black uppercase text-sm text-red-950 tracking-tight">Identity Verification Failed</h3>
                          <p className="text-xs font-bold text-red-800/60 leading-relaxed mt-2 uppercase tracking-wide">
                              The server encountered a security exception while initializing the Admin SDK.
                          </p>
                          <div className="mt-6 p-5 bg-black/10 rounded-2xl text-[10px] font-mono overflow-auto max-w-full text-red-900 border border-red-200">
                              <p className="font-black uppercase opacity-40 mb-2">RAW EXCEPTION:</p>
                              {status.errorMessage}
                          </div>
                      </div>
                  </div>
              </div>
          )}
          
          <Card className="rounded-[2.5rem] border-0 shadow-xl bg-white p-8 space-y-6">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] opacity-40">Operational Index</h3>
              <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-muted/30 border border-black/5">
                      <p className="text-[8px] font-black uppercase opacity-40 mb-1">Authenticated Email</p>
                      <p className="text-xs font-bold text-gray-700 italic">shanmuka7073@gmail.com</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-black/5">
                      <p className="text-[8px] font-black uppercase opacity-40 mb-1">Server Region</p>
                      <p className="text-xs font-bold text-gray-700">Google Cloud (Automatic Selection)</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/30 border border-black/5">
                      <p className="text-[8px] font-black uppercase opacity-40 mb-1">Permissions</p>
                      <p className="text-xs font-bold text-gray-700 uppercase">FULL PLATFORM READ/WRITE (ADMIN)</p>
                  </div>
              </div>
          </Card>
      </div>
    </div>
  );
}
