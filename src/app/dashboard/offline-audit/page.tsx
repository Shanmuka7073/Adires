
'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
    Wifi, 
    WifiOff, 
    CheckCircle2, 
    XCircle, 
    Database, 
    HardDrive, 
    Zap, 
    RotateCw, 
    Info, 
    Activity,
    Smartphone,
    Cloud,
    Loader2,
    ShieldAlert,
    AlertCircle,
    ShieldCheck,
    ArrowLeft
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useFirebase } from '@/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import Link from 'next/link';

interface DiagnosticState {
    sw: {
        status: 'active' | 'missing' | 'checking' | 'unsupported' | 'insecure';
        reason: string;
    };
    memory: {
        storeId: 'saved' | 'not_saved' | 'not_applicable' | 'checking';
        reason: string;
    };
}

export default function OfflineAuditPage() {
    const [isOnline, setIsOnline] = useState(true);
    const [diag, setDiag] = useState<DiagnosticState>({
        sw: { status: 'checking', reason: 'Analyzing browser environment...' },
        memory: { storeId: 'checking', reason: 'Checking local persistence...' }
    });
    const [lastSyncStatus, setLastSyncStatus] = useState<'idle' | 'writing' | 'queued' | 'synced'>('idle');
    const [isTesting, startTest] = useTransition();
    
    const { userStore, stores, isInitialized } = useAppStore();
    const { firestore, user } = useFirebase();
    const { isRestaurantOwner, isAdmin } = useAdminAuth();
    const { toast } = useToast();

    useEffect(() => {
        const handleStatusChange = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);
        setIsOnline(navigator.onLine);

        const checkPWA = async () => {
            if (typeof window === 'undefined') return;

            if (!('serviceWorker' in navigator)) {
                setDiag(prev => ({ ...prev, sw: { status: 'unsupported', reason: 'This browser does not support Service Workers (PWA).' } }));
                return;
            }

            const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (!isSecure) {
                setDiag(prev => ({ ...prev, sw: { status: 'insecure', reason: 'PWA features are disabled because this connection is not HTTPS.' } }));
                return;
            }

            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                const adiresSW = registrations.find(reg => reg.active || reg.waiting || reg.installing);
                
                if (adiresSW) {
                    if (navigator.serviceWorker.controller) {
                        setDiag(prev => ({ ...prev, sw: { status: 'active', reason: 'Shell is active and controlling this page.' } }));
                    } else {
                        setDiag(prev => ({ ...prev, sw: { status: 'active', reason: 'Shell is registered but needs a refresh to take control.' } }));
                    }
                } else {
                    setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'No Service Worker found. Visit Home to trigger registration.' } }));
                }
            } catch (e) {
                setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'Error checking worker: ' + (e as Error).message } }));
            }
        };

        const checkMemory = () => {
            if (!user) {
                setDiag(prev => ({ ...prev, memory: { storeId: 'not_saved', reason: 'User not logged in. Persistence is disabled for guests.' } }));
                return;
            }

            if (userStore?.id) {
                setDiag(prev => ({ ...prev, memory: { storeId: 'saved', reason: `Persisted Store: ${userStore.name}` } }));
            } else if (isAdmin) {
                setDiag(prev => ({ ...prev, memory: { storeId: 'not_applicable', reason: 'Admin role detected. Platform management does not require a store ID.' } }));
            } else if (!isRestaurantOwner) {
                setDiag(prev => ({ ...prev, memory: { storeId: 'not_applicable', reason: 'Customer role detected. Shopping does not require a persistent store ID.' } }));
            } else {
                setDiag(prev => ({ ...prev, memory: { storeId: 'not_saved', reason: 'Fetch failed or store profile has not been created yet.' } }));
            }
        };

        checkPWA();
        checkMemory();

        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, [user, userStore, isAdmin, isRestaurantOwner]);

    const handleTestOfflineWrite = async () => {
        if (!firestore || !user) {
            toast({ variant: 'destructive', title: "Connection Required", description: "You must be logged in to test writes." });
            return;
        }

        startTest(async () => {
            setLastSyncStatus('writing');
            const testId = `diag-${Date.now()}`;
            const testRef = doc(firestore, 'diagnostic_logs', testId);
            const data = {
                timestamp: serverTimestamp(),
                userId: user.uid,
                status: 'test',
                clientTime: new Date().toISOString(),
                isOfflineTest: !isOnline
            };

            const unsub = onSnapshot(testRef, (snapshot) => {
                if (snapshot.metadata.hasPendingWrites) {
                    setLastSyncStatus('queued');
                } else {
                    setLastSyncStatus('synced');
                    unsub();
                }
            });

            try {
                setDoc(testRef, data).catch(e => {
                    console.error("Diagnostic write failed:", e);
                });
                
                toast({ 
                    title: isOnline ? "Write Successful" : "Queued Locally", 
                    description: isOnline ? "Data sent to cloud." : "Data will sync when you go online." 
                });
            } catch (err) {
                console.error(err);
            }
        });
    };

    const backLink = isAdmin ? '/dashboard/admin' : '/dashboard/restaurant';

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-4xl space-y-8 pb-32">
            <div className="mb-8 border-b pb-10 border-black/5 flex justify-between items-end">
                <div>
                    <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic leading-none">Offline Audit</h1>
                    <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Local-First Diagnostic Center</p>
                </div>
                <Button asChild variant="ghost" className="rounded-full h-10 px-6 font-black uppercase text-[10px] tracking-widest hover:bg-black/5">
                    <Link href={backLink}><ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard</Link>
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden">
                    <CardHeader className={cn("pb-6 transition-colors", isOnline ? "bg-green-50" : "bg-amber-50")}>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Network Layer</CardTitle>
                            {isOnline ? <Wifi className="text-green-600 h-6 w-6" /> : <WifiOff className="text-amber-600 h-6 w-6" />}
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase opacity-40">Status</span>
                            <Badge className={cn("rounded-md font-black uppercase text-[10px]", isOnline ? "bg-green-500" : "bg-amber-500")}>
                                {isOnline ? 'Online' : 'Offline'}
                            </Badge>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase opacity-40">Browser Support</span>
                            <span className="text-xs font-bold text-green-600 flex items-center gap-1">
                                <CheckCircle2 className="h-3 w-3" /> Navigator.onLine OK
                            </span>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden">
                    <CardHeader className={cn("pb-6 transition-colors", diag.sw.status === 'active' ? "bg-primary/5" : "bg-red-50")}>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">App Shell (PWA)</CardTitle>
                            <Smartphone className="h-6 w-6 opacity-20" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase opacity-40">Service Worker</span>
                            <Badge 
                                variant={diag.sw.status === 'active' ? 'default' : 'destructive'} 
                                className="rounded-md font-black uppercase text-[10px]"
                            >
                                {diag.sw.status === 'active' ? 'ACTIVE' : diag.sw.status.toUpperCase()}
                            </Badge>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-2xl border border-black/5">
                            {diag.sw.status === 'active' ? (
                                <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Diagnosis</p>
                                <p className="text-[11px] font-bold text-gray-700 leading-tight">
                                    {diag.sw.reason}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden">
                    <CardHeader className={cn("pb-6 border-b border-black/5 transition-colors", diag.memory.storeId === 'saved' ? "bg-primary/5" : "bg-muted/5")}>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Local Memory</CardTitle>
                            <HardDrive className="h-6 w-6 opacity-20" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase opacity-40">Store Identity</span>
                            <Badge 
                                variant={diag.memory.storeId === 'saved' || diag.memory.storeId === 'not_applicable' ? 'outline' : 'destructive'}
                                className="rounded-md font-black uppercase text-[10px]"
                            >
                                {diag.memory.storeId.replace('_', ' ').toUpperCase()}
                            </Badge>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-muted/30 rounded-2xl border border-black/5">
                            {diag.memory.storeId === 'saved' || diag.memory.storeId === 'not_applicable' ? (
                                <ShieldCheck className="h-5 w-5 text-green-600 shrink-0 mt-0.5" />
                            ) : (
                                <AlertCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            )}
                            <div className="space-y-1">
                                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Explanation</p>
                                <p className="text-[11px] font-bold text-gray-700 leading-tight">
                                    {diag.memory.reason}
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden border-2 border-primary/20">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Sync Test</CardTitle>
                            <Cloud className={cn("h-6 w-6", lastSyncStatus === 'synced' ? "text-green-500" : "opacity-20")} />
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6 text-center">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Test Background Queue</p>
                            <div className="text-sm font-black uppercase tracking-tight">
                                {lastSyncStatus === 'idle' && "Ready to Test"}
                                {lastSyncStatus === 'writing' && <div className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Writing...</div>}
                                {lastSyncStatus === 'queued' && <div className="text-amber-600 flex items-center justify-center gap-2"><Zap className="h-4 w-4 fill-current" /> Queued (Pending)</div>}
                                {lastSyncStatus === 'synced' && <div className="text-green-600 flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4" /> Synced</div>}
                            </div>
                        </div>
                        <Button 
                            onClick={handleTestOfflineWrite} 
                            disabled={isTesting || !isInitialized}
                            className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20"
                        >
                            {isTesting ? 'Initiating...' : 'Trigger Sync Check'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-[2.5rem] border-0 shadow-xl bg-slate-900 text-white p-8">
                <div className="flex items-start gap-6">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-primary shrink-0">
                        <Activity className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-2">How to Fix Issues</h3>
                        <div className="space-y-4 text-xs font-bold text-white/60 leading-relaxed">
                            <p>1. <strong className="text-white">Service Worker Missing?</strong>: Access the app via <code className="text-primary">localhost</code> or <code className="text-primary">https</code>. PWAs will not register over insecure HTTP.</p>
                            <p>2. <strong className="text-white">Store Identity Not Saved?</strong>: Login as a Store Owner. Customers do not persist specific store profiles.</p>
                            <p>3. <strong className="text-white">Still Missing?</strong>: Refresh the page while online. This forces the browser to re-cache the App Shell.</p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
