
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
    Globe,
    Lock,
    Wrench,
    Bug,
    Info,
    Flame
} from 'lucide-react';
import { useFirebase, useMemoFirebase } from '@/firebase';
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

        setIsOnline(navigator.onLine);

        const host = window.location.hostname;
        if (host === 'adires.vercel.app') {
            setDiag(prev => ({ ...prev, domain: { status: 'production', reason: 'Official production domain verified.' } }));
        } else if (host === 'localhost' || host === '127.0.0.1') {
            setDiag(prev => ({ ...prev, domain: { status: 'development', reason: 'Local development environment.' } }));
        } else {
            setDiag(prev => ({ ...prev, domain: { status: 'unrecognized', reason: `Host: ${host}. Check Authorized Domains.` } }));
        }

        if (!('serviceWorker' in navigator)) {
            setDiag(prev => ({ ...prev, sw: { status: 'unsupported', reason: 'Browser lacks SW support.' } }));
        } else {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                const activeReg = registrations.find(r => r.active);
                const isControlled = !!navigator.serviceWorker.controller;

                if (activeReg) {
                    if (isControlled) {
                        setDiag(prev => ({ ...prev, sw: { status: 'active', reason: `Shell Active: ${activeReg.scope}`, details: 'The Service Worker is active and controlling this session.' } }));
                    } else {
                        setDiag(prev => ({ ...prev, sw: { status: 'uncontrolled', reason: 'Active but Uncontrolled.', details: 'Worker is running but haven\'t claimed this tab. Refresh required.' } }));
                    }
                } else {
                    setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'No SW Registration Found.' } }));
                }
            } catch (e: any) {
                setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'Registry Error.' } }));
            }
        }
    };

    const handleRepairShell = () => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
        startRepair(async () => {
            try {
                await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
                toast({ title: "Repair Initiated", description: "Reloading to apply changes..." });
                setTimeout(() => window.location.reload(), 1500);
            } catch (error: any) {
                toast({ variant: 'destructive', title: "Repair Failed" });
            }
        });
    };

    const handleEmergencyReset = async () => {
        if (typeof window === 'undefined') return;
        
        startRepair(async () => {
            try {
                localStorage.clear();
                sessionStorage.clear();
                
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let reg of regs) await reg.unregister();
                
                const dbs = await window.indexedDB.databases();
                for (let db of dbs) {
                    if (db.name) window.indexedDB.deleteDatabase(db.name);
                }
                
                toast({ title: "Emergency Reset Complete", description: "All local data purged. Reloading..." });
                setTimeout(() => window.location.reload(), 2000);
            } catch (e: any) {
                toast({ variant: 'destructive', title: "Reset Failed", description: e.message });
            }
        });
    };

    useEffect(() => {
        if (!isAdminLoading && !isAdmin) router.replace('/dashboard');
        performAudit();
    }, [isAdmin, isAdminLoading, router]);

    if (isAdminLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-4xl space-y-12 pb-32">
            <div className="flex justify-between items-end border-b pb-10 border-black/5">
                <div className="min-w-0 flex-1">
                    <h1 className="text-3xl md:text-6xl font-black font-headline tracking-tight uppercase italic leading-none text-gray-950 truncate">System Audit</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Precision Diagnostic Center</p>
                </div>
                <Button onClick={performAudit} variant="outline" className="rounded-full h-12 px-6 font-black uppercase text-[10px] tracking-widest border-2 shrink-0">
                    <RefreshCw className="mr-2 h-4 w-4" /> Re-Scan
                </Button>
            </div>

            <Alert variant="destructive" className="rounded-[2rem] border-2 bg-red-50 p-8 shadow-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
                <div className="ml-2">
                    <AlertTitle className="text-red-950 font-black uppercase text-sm">Emergency System Reset</AlertTitle>
                    <AlertDescription className="text-red-800 text-xs font-bold opacity-60 leading-relaxed mt-2 uppercase">
                        Use this if you see "IndexedDB Corruption" errors. This will clear all local memory, logout the device, and force a clean reload from the cloud.
                    </AlertDescription>
                    <Button onClick={handleEmergencyReset} disabled={isRepairing} className="mt-6 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-8 shadow-xl">
                        {isRepairing ? <Loader2 className="animate-spin h-4 w-4" /> : <Flame className="mr-2 h-4 w-4" />}
                        Nuke Local Cache & Repair
                    </Button>
                </div>
            </Alert>

            <div className="grid md:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white col-span-full">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <Lock className="h-4 w-4 text-primary" /> App Shell (Service Worker)
                            </CardTitle>
                            <Button size="sm" variant="ghost" onClick={handleRepairShell} disabled={isRepairing} className="h-7 rounded-lg text-[8px] font-black uppercase bg-primary/10 text-primary">
                                {isRepairing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Wrench className="mr-1 h-3 w-3" />}
                                Repair Shell
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase opacity-40">Internal Browser State</span>
                            <Badge variant={diag.sw.status === 'active' ? 'default' : 'destructive'} className="font-black uppercase text-[9px]">
                                {diag.sw.status.toUpperCase()}
                            </Badge>
                        </div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="p-5 bg-muted/30 rounded-2xl border-2 border-transparent">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2">Detection</p>
                                <p className="text-sm font-black text-gray-900 leading-tight">{diag.sw.reason}</p>
                            </div>
                            <div className="p-5 bg-black/5 rounded-2xl border-2 border-transparent">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-2 flex items-center gap-1"><Bug className="h-3 w-3"/> Details</p>
                                <p className="text-[11px] font-bold text-gray-600 leading-relaxed">{diag.sw.details || 'No extended issues detected.'}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button asChild variant="outline" className="h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest border-2">
                    <Link href="/dashboard/admin">Return to Decision Hub</Link>
                </Button>
            </div>
        </div>
    );
}

function AlertTriangle(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
  )
}
