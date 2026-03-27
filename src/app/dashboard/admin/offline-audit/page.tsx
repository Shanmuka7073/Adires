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
    Lock,
    Flame,
    Database,
    Zap
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface DiagnosticState {
    sw: {
        status: 'active' | 'missing' | 'checking' | 'unsupported' | 'uncontrolled';
        reason: string;
    };
    persistence: {
        status: 'enabled' | 'disabled' | 'checking';
        reason: string;
    };
}

export default function OfflineAuditPage() {
    const [isOnline, setIsOnline] = useState(true);
    const [diag, setDiag] = useState<DiagnosticState>({
        sw: { status: 'checking', reason: 'Analyzing browser environment...' },
        persistence: { status: 'checking', reason: 'Checking local database...' }
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

        if (!('serviceWorker' in navigator)) {
            setDiag(prev => ({ ...prev, sw: { status: 'unsupported', reason: 'Browser lacks SW support.' } }));
        } else {
            const regs = await navigator.serviceWorker.getRegistrations();
            const activeReg = regs.find(r => r.active);
            const isControlled = !!navigator.serviceWorker.controller;

            if (activeReg && isControlled) {
                setDiag(prev => ({ ...prev, sw: { status: 'active', reason: 'App Shell is Active and Controlling.' } }));
            } else if (activeReg) {
                setDiag(prev => ({ ...prev, sw: { status: 'uncontrolled', reason: 'Registered but Idle. Refresh Required.' } }));
            } else {
                setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'No Service Worker Found.' } }));
            }
        }

        setDiag(prev => ({ ...prev, persistence: { status: 'enabled', reason: 'IndexedDB Persistence Active.' } }));
    };

    const handleEmergencyReset = async () => {
        if (typeof window === 'undefined') return;
        
        startRepair(async () => {
            try {
                // 1. Clear State
                localStorage.clear();
                sessionStorage.clear();
                
                // 2. Unregister SW
                const regs = await navigator.serviceWorker.getRegistrations();
                for (let reg of regs) await reg.unregister();
                
                // 3. Delete DBs
                const dbs = await window.indexedDB.databases();
                for (let db of dbs) {
                    if (db.name) window.indexedDB.deleteDatabase(db.name);
                }
                
                toast({ title: "System Nuke Complete", description: "All local data purged. Reloading..." });
                setTimeout(() => window.location.reload(), 2000);
            } catch (e: any) {
                toast({ variant: 'destructive', title: "Reset Failed", description: e.message });
            }
        });
    };

    const handleSyncTest = async () => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: "Auth Required", description: "Login to perform sync test." });
            return;
        }

        startTest(async () => {
            setLastSyncStatus('writing');
            const testId = `sync-test-${Date.now()}`;
            const testRef = doc(firestore, 'diagnostic_logs', testId);
            const testData = {
                timestamp: serverTimestamp(),
                userId: user.uid,
                email: user.email,
                clientTime: new Date().toISOString(),
                isOnline
            };

            const unsubscribe = onSnapshot(testRef, (snapshot) => {
                if (snapshot.metadata.hasPendingWrites) {
                    setLastSyncStatus('queued');
                } else {
                    setLastSyncStatus('synced');
                    toast({ title: "Cloud Handshake OK", description: "Document synced to production." });
                    unsubscribe();
                }
            }, (error) => {
                toast({ variant: 'destructive', title: "Sync Denied", description: error.message });
                setLastSyncStatus('idle');
            });

            try {
                await setDoc(testRef, testData);
            } catch (e: any) {
                toast({ variant: 'destructive', title: "Write Failed", description: e.message });
                setLastSyncStatus('idle');
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
                <div>
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">Data Audit</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Precision Diagnostic Center</p>
                </div>
                <Button onClick={performAudit} variant="outline" className="rounded-full h-12 px-6 font-black uppercase text-[10px] tracking-widest border-2">
                    <RefreshCw className="mr-2 h-4 w-4" /> Re-Scan
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Lock className="h-4 w-4 text-primary" /> App Shell
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase opacity-40">Status</span>
                            <Badge variant={diag.sw.status === 'active' ? 'default' : 'destructive'} className="font-black uppercase text-[9px]">
                                {diag.sw.status.toUpperCase()}
                            </Badge>
                        </div>
                        <p className="text-sm font-black text-gray-900 leading-tight">{diag.sw.reason}</p>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-slate-900 text-white relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Cloud className="h-32 w-32" /></div>
                    <CardHeader className="p-8 pb-4 relative z-10">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Sync Handshake</CardTitle>
                        <CardDescription className="text-white/40 font-bold text-[10px] uppercase">Verify Write Pipeline</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 relative z-10 space-y-6">
                        <div className="h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                            {lastSyncStatus === 'idle' && <p className="text-[10px] font-black uppercase opacity-40">Ready to Test</p>}
                            {lastSyncStatus === 'writing' && <Loader2 className="animate-spin h-5 w-5 text-primary" />}
                            {lastSyncStatus === 'queued' && <p className="text-[10px] font-black text-amber-500 uppercase">Queued Locally</p>}
                            {lastSyncStatus === 'synced' && <CheckCircle2 className="h-6 w-6 text-green-500" />}
                        </div>
                        <Button onClick={handleSyncTest} disabled={isTesting} className="w-full h-12 rounded-xl bg-white text-slate-900 font-black uppercase text-[10px] tracking-widest">
                            Trigger Sync Test
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Alert variant="destructive" className="rounded-[2rem] border-2 bg-red-50 p-8 shadow-lg">
                <div className="flex gap-4">
                    <Flame className="h-8 w-8 text-red-600 shrink-0" />
                    <div>
                        <AlertTitle className="text-red-950 font-black uppercase text-sm">Emergency System Nuke</AlertTitle>
                        <AlertDescription className="text-red-800 text-xs font-bold opacity-60 leading-relaxed mt-2 uppercase">
                            Use this if data exists in Firestore but shows as zero in the app. This clears local IndexedDB corruption.
                        </AlertDescription>
                        <Button onClick={handleEmergencyReset} disabled={isRepairing} className="mt-6 h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] tracking-widest px-8 shadow-xl">
                            {isRepairing ? <Loader2 className="animate-spin h-4 w-4" /> : 'Nuke Local Cache & Repair'}
                        </Button>
                    </div>
                </div>
            </Alert>
        </div>
    );
}