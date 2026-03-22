
'use client';

import { useState, useEffect, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Wifi, 
    WifiOff, 
    CheckCircle2, 
    Activity,
    Smartphone,
    Cloud,
    Loader2,
    AlertCircle,
    ShieldCheck,
    RefreshCw,
    Check,
    Globe,
    Lock,
    Wrench,
    Bug,
    Info
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface DiagnosticState {
    sw: {
        status: 'active' | 'missing' | 'checking' | 'unsupported' | 'insecure' | 'waiting' | 'uncontrolled';
        reason: string;
        details?: string;
    };
    manifest: {
        status: 'found' | 'missing' | 'checking';
        reason: string;
    };
    prompt: {
        status: 'ready' | 'waiting' | 'blocked' | 'checking';
        reason: string;
    };
    domain: {
        status: 'production' | 'development' | 'unrecognized';
        reason: string;
    };
}

export default function OfflineAuditPage() {
    const [isOnline, setIsOnline] = useState(true);
    const [diag, setDiag] = useState<DiagnosticState>({
        sw: { status: 'checking', reason: 'Analyzing browser environment...' },
        manifest: { status: 'checking', reason: 'Searching for web manifest...' },
        prompt: { status: 'checking', reason: 'Listening for install prompt...' },
        domain: { status: 'development', reason: 'Checking host authority...' }
    });
    const [lastSyncStatus, setLastSyncStatus] = useState<'idle' | 'writing' | 'queued' | 'synced'>('idle');
    const [isTesting, startTest] = useTransition();
    const [isRepairing, startRepair] = useTransition();
    
    const { user, firestore } = useFirebase();
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const { toast } = useToast();
    const router = useRouter();

    const performAudit = async () => {
        if (typeof window === 'undefined') return;

        // 1. Check Network
        setIsOnline(navigator.onLine);

        // 2. Check Domain Authority
        const host = window.location.hostname;
        if (host === 'adires.vercel.app') {
            setDiag(prev => ({ ...prev, domain: { status: 'production', reason: 'Official production domain verified.' } }));
        } else if (host === 'localhost' || host === '127.0.0.1') {
            setDiag(prev => ({ ...prev, domain: { status: 'development', reason: 'Local development environment.' } }));
        } else {
            setDiag(prev => ({ ...prev, domain: { status: 'unrecognized', reason: `Host: ${host}. Ensure this is added to Firebase Authorized Domains.` } }));
        }

        // 3. Check Service Worker (DEEP INSPECTION)
        if (!('serviceWorker' in navigator)) {
            setDiag(prev => ({ ...prev, sw: { status: 'unsupported', reason: 'Browser lacks SW support.', details: 'This browser version does not support Progressive Web App technology.' } }));
        } else {
            const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
            if (!isSecure) {
                setDiag(prev => ({ ...prev, sw: { status: 'insecure', reason: 'PWA DISABLED: Browser requires HTTPS.', details: 'Service workers only run over secure connections or localhost.' } }));
            } else {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    const activeReg = registrations.find(r => r.active);
                    const waitingReg = registrations.find(r => r.waiting);
                    const installingReg = registrations.find(r => r.installing);
                    
                    const isControlled = !!navigator.serviceWorker.controller;

                    if (activeReg) {
                        if (isControlled) {
                            setDiag(prev => ({ ...prev, sw: { status: 'active', reason: `Shell Active: ${activeReg.scope}`, details: 'The Service Worker is active and currently controlling this page session.' } }));
                        } else {
                            setDiag(prev => ({ ...prev, sw: { status: 'uncontrolled', reason: 'Active but Uncontrolled.', details: 'Worker is running but hasn\'t "claimed" the current tab. A page refresh will fix this.' } }));
                        }
                    } else if (waitingReg) {
                        setDiag(prev => ({ ...prev, sw: { status: 'waiting', reason: 'Update Waiting.', details: 'A new version of the app shell is downloaded. Click "Force Register" to push it through.' } }));
                    } else if (installingReg) {
                        setDiag(prev => ({ ...prev, sw: { status: 'waiting', reason: 'Installing...', details: 'The app shell is currently being downloaded into the browser cache. Please wait.' } }));
                    } else {
                        setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'No SW Registration Found.', details: 'The browser has no record of registering a worker. This usually happens if the register component failed to fire.' } }));
                    }
                } catch (e: any) {
                    setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'SW Registry Error.', details: e.message } }));
                }
            }
        }

        // 4. Check Manifest
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (manifestLink) {
            setDiag(prev => ({ ...prev, manifest: { status: 'found', reason: `Link: ${manifestLink.getAttribute('href')}` } }));
        } else {
            setDiag(prev => ({ ...prev, manifest: { status: 'missing', reason: 'No manifest link detected in <head>.' } }));
        }

        // 5. Check Prompt Readiness
        if (window.deferredInstallPrompt) {
            setDiag(prev => ({ ...prev, prompt: { status: 'ready', reason: 'Install Prompt Primed.' } }));
        } else {
            setDiag(prev => ({ ...prev, prompt: { status: 'waiting', reason: 'Waiting for User interaction.' } }));
        }
    };

    const handleRepairShell = () => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
        
        startRepair(async () => {
            try {
                toast({ title: "Initiating Repair", description: "Re-registering app shell..." });
                const reg = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/',
                    updateViaCache: 'none'
                });
                
                // Monitor the installation state machine
                if (reg.installing) {
                    const sw = reg.installing;
                    sw.onstatechange = () => {
                        if (sw.state === 'installed') {
                            toast({ title: "Cache Complete", description: "Forcing activation..." });
                            sw.postMessage({ type: 'SKIP_WAITING' });
                        }
                    };
                } else if (reg.waiting) {
                    toast({ title: "Worker Waiting", description: "Forcing activation..." });
                    reg.waiting.postMessage({ type: 'SKIP_WAITING' });
                } else if (reg.active && !navigator.serviceWorker.controller) {
                    toast({ title: "Activating", description: "Claiming current page..." });
                    window.location.reload();
                } else {
                    toast({ title: "Shell Active", description: "Service worker is operational." });
                }

                performAudit();
            } catch (error: any) {
                console.error('Manual repair failed:', error);
                toast({ variant: 'destructive', title: "Repair Failed", description: error.message });
            }
        });
    };

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) {
            router.replace('/dashboard');
        }
        performAudit();
        
        window.addEventListener('pwa-install-available', performAudit);
        return () => window.removeEventListener('pwa-install-available', performAudit);
    }, [isAdmin, isAdminLoading, router]);

    const handleTestSync = async () => {
        if (!firestore || !user) return;
        startTest(async () => {
            setLastSyncStatus('writing');
            const testRef = doc(firestore, 'diagnostic_logs', `test-${Date.now()}`);
            
            const unsub = onSnapshot(testRef, (snap) => {
                if (snap.metadata.hasPendingWrites) setLastSyncStatus('queued');
                else { setLastSyncStatus('synced'); unsub(); }
            });

            try {
                await setDoc(testRef, { 
                    timestamp: serverTimestamp(), 
                    userId: user.uid, 
                    type: 'sync-test',
                    platform: 'Adires Admin',
                    host: window.location.hostname
                });
            } catch (e: any) {
                console.error("Sync test failed:", e);
                setLastSyncStatus('idle');
                toast({ 
                    variant: 'destructive', 
                    title: "Write Failed", 
                    description: "Check rules for 'diagnostic_logs'." 
                });
            }
        });
    };

    if (isAdminLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-4xl space-y-12 pb-32">
            <div className="flex justify-between items-end border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">System Audit</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Exact Error Diagnostics</p>
                </div>
                <Button onClick={performAudit} variant="outline" className="rounded-full h-12 px-6 font-black uppercase text-[10px] tracking-widest border-2">
                    <RefreshCw className="mr-2 h-4 w-4" /> Re-Scan
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* SW CHECK (THE "EXACT ERROR" SECTION) */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white col-span-full">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <Lock className="h-4 w-4 text-primary" /> App Shell (Service Worker)
                            </CardTitle>
                            <Button 
                                size="sm" 
                                variant="ghost" 
                                onClick={handleRepairShell} 
                                disabled={isRepairing}
                                className="h-7 rounded-lg text-[8px] font-black uppercase bg-primary/10 hover:bg-primary/20 text-primary"
                            >
                                {isRepairing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="mr-1 h-3 w-3" />}
                                Force Register
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase opacity-40">Internal Browser State</span>
                            <Badge variant={diag.sw.status === 'active' ? 'default' : diag.sw.status === 'waiting' || diag.sw.status === 'uncontrolled' ? 'secondary' : 'destructive'} className="font-black uppercase text-[9px]">
                                {diag.sw.status.toUpperCase()}
                            </Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-5 bg-muted/30 rounded-2xl border-2 border-transparent">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Primary Detection</p>
                                <p className="text-sm font-black text-gray-900 leading-tight">{diag.sw.reason}</p>
                            </div>
                            <div className="p-5 bg-black/5 rounded-2xl border-2 border-transparent">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 flex items-center gap-1"><Bug className="h-3 w-3"/> Root Cause Analysis</p>
                                <p className="text-[11px] font-bold text-gray-600 leading-relaxed">{diag.sw.details}</p>
                            </div>
                        </div>

                        {diag.sw.status === 'uncontrolled' && (
                            <Alert className="bg-blue-50 border-blue-100 rounded-2xl">
                                <Info className="h-4 w-4 text-blue-600" />
                                <AlertTitle className="text-[10px] font-black uppercase tracking-widest text-blue-800">Refresh Required</AlertTitle>
                                <AlertDescription className="text-xs font-bold text-blue-900 leading-tight">
                                    The shell is active, but the current tab is stale. Please refresh the browser once to allow the worker to take control.
                                </AlertDescription>
                            </Alert>
                        )}
                    </CardContent>
                </Card>

                {/* DOMAIN CHECK */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Globe className="h-4 w-4 text-primary" /> Domain Authority
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase opacity-40">Environment</span>
                            <Badge variant={diag.domain.status === 'production' ? 'default' : 'secondary'} className="font-black uppercase text-[9px]">
                                {diag.domain.status.toUpperCase()}
                            </Badge>
                        </div>
                        <p className="text-[11px] font-bold text-gray-600 leading-tight p-4 bg-muted/30 rounded-2xl border border-black/5">
                            {diag.domain.reason}
                        </p>
                    </CardContent>
                </Card>

                {/* SYNC TEST */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white border-2 border-primary/20">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Cloud className="h-4 w-4 text-primary" /> Sync Integrity
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6 text-center">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Queue Status</p>
                            <div className="text-sm font-black text-gray-900 uppercase min-h-[24px]">
                                {lastSyncStatus === 'idle' && "Ready to Test"}
                                {lastSyncStatus === 'writing' && "Triggering Write..."}
                                {lastSyncStatus === 'queued' && <span className="text-amber-600 flex items-center justify-center gap-2 animate-pulse"><Zap className="h-4 w-4 fill-current"/> Queued Locally</span>}
                                {lastSyncStatus === 'synced' && <span className="text-green-600 flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4"/> Synced!</span>}
                            </div>
                        </div>
                        <Button onClick={handleTestSync} disabled={isTesting} className="w-full max-w-sm h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                            Test Background Sync
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button asChild variant="outline" className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2">
                    <Link href="/dashboard/admin/manifest-help">Edit PWA Manifest</Link>
                </Button>
                <Button asChild variant="outline" className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2">
                    <Link href="/dashboard/admin">Return to Dashboard</Link>
                </Button>
            </div>
        </div>
    );
}

function Zap(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 14.899 13 2l-2.474 7.961L19.526 10 10.526 22.899 13 14.938Z" />
    </svg>
  )
}
