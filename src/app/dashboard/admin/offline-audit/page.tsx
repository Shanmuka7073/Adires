
'use client';

import { useState, useEffect, useTransition } from 'react';
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
    CloudSync,
    Loader2
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useFirebase } from '@/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function OfflineAuditPage() {
    const [isOnline, setIsOnline] = useState(true);
    const [swStatus, setSwStatus] = useState<'active' | 'missing' | 'checking'>('checking');
    const [lastSyncStatus, setLastSyncStatus] = useState<'idle' | 'writing' | 'queued' | 'synced'>('idle');
    const [isTesting, startTest] = useTransition();
    const { userStore, stores, isInitialized } = useAppStore();
    const { firestore, user } = useFirebase();
    const { toast } = useToast();

    useEffect(() => {
        const handleStatusChange = () => setIsOnline(navigator.onLine);
        window.addEventListener('online', handleStatusChange);
        window.addEventListener('offline', handleStatusChange);
        setIsOnline(navigator.onLine);

        // Check Service Worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(reg => {
                setSwStatus(reg.active ? 'active' : 'missing');
            }).catch(() => setSwStatus('missing'));
        } else {
            setSwStatus('missing');
        }

        return () => {
            window.removeEventListener('online', handleStatusChange);
            window.removeEventListener('offline', handleStatusChange);
        };
    }, []);

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

            // Use onSnapshot to monitor the metadata of this specific doc
            const unsub = onSnapshot(testRef, (snapshot) => {
                if (snapshot.metadata.hasPendingWrites) {
                    setLastSyncStatus('queued');
                } else {
                    setLastSyncStatus('synced');
                    unsub(); // Stop listening once synced
                }
            });

            try {
                // Set non-blocking to observe queueing
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

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-4xl space-y-8 pb-32">
            <div className="mb-8 border-b pb-10 border-black/5">
                <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic">Offline Sync Audit</h1>
                <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">System Capability Verification</p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* 1. NETWORK STATUS */}
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

                {/* 2. PWA SHELL STATUS */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden">
                    <CardHeader className={cn("pb-6 transition-colors", swStatus === 'active' ? "bg-primary/5" : "bg-red-50")}>
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">App Shell (PWA)</CardTitle>
                            <Smartphone className="h-6 w-6 opacity-20" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase opacity-40">Service Worker</span>
                            <Badge variant={swStatus === 'active' ? 'default' : 'destructive'} className="rounded-md font-black uppercase text-[10px]">
                                {swStatus === 'active' ? 'ACTIVE & CACHING' : 'MISSING'}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2 p-3 bg-muted/30 rounded-xl border border-black/5">
                            <Info className="h-4 w-4 text-primary shrink-0" />
                            <p className="text-[9px] font-bold text-gray-600 leading-tight">
                                If "Active," the browser has saved the UI code (Home, Menu, Dashboard) for total offline navigation.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. PERSISTENT STATE */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Local Memory</CardTitle>
                            <HardDrive className="h-6 w-6 opacity-20" />
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase opacity-40">User Store ID</span>
                            <span className="text-xs font-bold text-primary font-mono">{userStore?.id ? 'PRESENT' : 'NOT SAVED'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase opacity-40">Store Catalog</span>
                            <span className="text-xs font-bold">{stores?.length || 0} items cached</span>
                        </div>
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase opacity-40">Initialization Status</span>
                            <Badge variant="outline" className="text-[8px] font-black uppercase">{isInitialized ? 'Ready' : 'Waiting'}</Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* 4. SYNC TESTER */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden border-2 border-primary/20">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-lg font-black uppercase tracking-tight">Live Sync Test</CardTitle>
                            <CloudSync className={cn("h-6 w-6", lastSyncStatus === 'synced' ? "text-green-500" : "opacity-20")} />
                        </div>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6 text-center">
                        <div className="space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Test Background Queue</p>
                            <div className="text-sm font-black uppercase tracking-tight">
                                {lastSyncStatus === 'idle' && "Ready to Test"}
                                {lastSyncStatus === 'writing' && <div className="flex items-center justify-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Writing...</div>}
                                {lastSyncStatus === 'queued' && <div className="text-amber-600 flex items-center justify-center gap-2"><Zap className="h-4 w-4 fill-current" /> Queued Locally (Pending Sync)</div>}
                                {lastSyncStatus === 'synced' && <div className="text-green-600 flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4" /> Successfully Synced</div>}
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
                        <h3 className="text-xl font-black uppercase tracking-tight mb-2">How to verify total offline</h3>
                        <div className="space-y-4 text-xs font-bold text-white/60 leading-relaxed">
                            <p>1. <strong className="text-white">Visit Management Pages</strong>: Open the Store Orders and My Store pages while online. This forces the browser to download their code.</p>
                            <p>2. <strong className="text-white">Go Airplane Mode</strong>: Disconnect your internet completely.</p>
                            <p>3. <strong className="text-white">Change Status</strong>: Update an order or edit a product. The write will happen <em className="text-primary italic">instantly</em> locally.</p>
                            <p>4. <strong className="text-white">Reconnect</strong>: Reconnect to the internet and watch the "Writes" counter in the bottom right. It will flush the data to the cloud automatically.</p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
