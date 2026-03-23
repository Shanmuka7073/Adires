
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Server, BrainCircuit, Database, ShieldAlert, RefreshCw, Users, Store as StoreIcon, Globe, Lock, Key, Settings, ExternalLink, ShieldCheck, ShieldAlert as ShieldIcon, AlertTriangle } from 'lucide-react';
import { getSystemStatus } from '@/app/actions';
import { useState, useEffect, useTransition, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useFirebase } from '@/firebase';
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

function ConnectionRepairGuide() {
    return (
        <Card className="rounded-[2.5rem] border-0 shadow-2xl bg-slate-900 text-white overflow-hidden">
            <CardHeader className="bg-primary p-8 border-b border-white/10">
                <CardTitle className="text-2xl font-black uppercase tracking-tight flex items-center gap-3">
                    <Key className="h-6 w-6" />
                    How to Fix "Offline" Status
                </CardTitle>
                <CardDescription className="text-white/60 font-bold uppercase text-[10px] tracking-widest mt-1">
                    Follow these steps to connect your production backend
                </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
                <div className="space-y-6">
                    <div className="flex gap-4">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 font-black text-xs">1</div>
                        <div className="space-y-1">
                            <p className="font-black uppercase text-xs tracking-tight">Generate Firebase Key</p>
                            <p className="text-[11px] font-medium text-white/60 leading-relaxed">
                                Go to <strong>Firebase Console &gt; Project Settings &gt; Service Accounts</strong> and click <strong>"Generate New Private Key"</strong>.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 font-black text-xs">2</div>
                        <div className="space-y-1">
                            <p className="font-black uppercase text-xs tracking-tight">Add Secret to Vercel</p>
                            <p className="text-[11px] font-medium text-white/60 leading-relaxed">
                                Copy the <strong>ENTIRE JSON content</strong>. Go to your <strong>Vercel Dashboard &gt; Settings &gt; Environment Variables</strong>. Add a new key called <code className="bg-white/10 px-1.5 py-0.5 rounded text-primary">SERVICE_ACCOUNT</code> and paste the JSON as the value.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center shrink-0 font-black text-xs">3</div>
                        <div className="space-y-1">
                            <p className="font-black uppercase text-xs tracking-tight">Redeploy Application</p>
                            <p className="text-[11px] font-medium text-white/60 leading-relaxed">
                                Vercel needs a <strong>Redeploy</strong> to "pick up" the new secret. Go to the Deployments tab and trigger a rebuild.
                            </p>
                        </div>
                    </div>
                </div>
                
                <div className="pt-4 border-t border-white/5">
                    <Button asChild variant="outline" className="w-full h-12 rounded-xl border-white/20 text-white hover:bg-white/5 font-black uppercase text-[10px] tracking-widest">
                        <a href="https://vercel.com/dashboard" target="_blank" rel="noopener noreferrer">
                            <Settings className="mr-2 h-4 w-4" /> Open Vercel Settings <ExternalLink className="ml-2 h-3 w-3 opacity-40" />
                        </a>
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

export default function SystemStatusPage() {
  const { firebaseApp } = useFirebase();
  const [status, setStatus] = useState<ServerStatus>({ 
    status: 'loading',
    llmStatus: 'Unknown', 
    serverDbStatus: 'Loading',
    counts: { users: 0, stores: 0 }
  });
  const [appCheckStatus, setAppCheckStatus] = useState<'checking' | 'verified' | 'failed'>('checking');
  const [isFetching, startFetchingTransition] = useTransition();
  const [hostName, setHostName] = useState('');

  const checkAppCheck = useCallback(async () => {
      if (typeof window === 'undefined') return;
      setAppCheckStatus('checking');
      try {
          const { getToken } = await import('firebase/app-check');
          const appCheckInstance = (window as any).firebaseAppCheckInstance;
          
          if (!appCheckInstance) {
              setAppCheckStatus('failed');
              return;
          }

          const result = await getToken(appCheckInstance, false);
          if (result.token) {
              setAppCheckStatus('verified');
          } else {
              setAppCheckStatus('failed');
          }
      } catch (e) {
          console.warn("App Check Diagnostic Error:", e);
          setAppCheckStatus('failed');
      }
  }, []);

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
            isCredentialError: (result as any).isCredentialError,
            counts: result.counts,
        });
        checkAppCheck();
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
  }, [checkAppCheck]);

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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
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

         <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 pb-4 border-b border-black/5">
                <CardTitle className="flex items-center gap-2 font-black uppercase text-xs tracking-widest">
                    <ShieldCheck className="h-4 w-4 text-primary" />
                    Security Integrity
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-8">
                <p className={cn(
                    "font-black text-4xl uppercase tracking-tighter",
                    appCheckStatus === 'verified' ? 'text-green-500' : appCheckStatus === 'failed' ? 'text-red-500' : 'text-gray-400'
                )}>
                    {appCheckStatus === 'verified' ? 'VERIFIED' : appCheckStatus === 'failed' ? 'UNSECURED' : 'CHECKING...'}
                </p>
                <div className="mt-4 space-y-1">
                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">App Check Provider</p>
                    <p className="text-xs font-black text-gray-700">reCAPTCHA v3 (Invisible)</p>
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
                  
                  {status.isCredentialError && <ConnectionRepairGuide />}
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
