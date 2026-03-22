
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
    Download,
    FileCode,
    SmartphoneNfc,
    Globe
} from 'lucide-react';
import { useAppStore } from '@/lib/store';
import { useFirebase } from '@/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';

interface DiagnosticState {
    sw: {
        status: 'active' | 'missing' | 'checking' | 'unsupported' | 'insecure';
        reason: string;
    };
    manifest: {
        status: 'found' | 'missing' | 'checking';
        reason: string;
    };
    prompt: {
        status: 'ready' | 'waiting' | 'blocked' | 'checking';
        reason: string;
    };
}

export default function OfflineAuditPage() {
    const [isOnline, setIsOnline] = useState(true);
    const [diag, setDiag] = useState<DiagnosticState>({
        sw: { status: 'checking', reason: 'Analyzing browser environment...' },
        manifest: { status: 'checking', reason: 'Searching for web manifest...' },
        prompt: { status: 'checking', reason: 'Listening for install prompt...' }
    });
    const [lastSyncStatus, setLastSyncStatus] = useState<'idle' | 'writing' | 'queued' | 'synced'>('idle');
    const [isTesting, startTest] = useTransition();
    
    const { user, firestore } = useFirebase();
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const { toast } = useToast();
    const router = useRouter();

    const performAudit = async () => {
        if (typeof window === 'undefined') return;

        // 1. Check Network
        setIsOnline(navigator.onLine);

        // 2. Check Service Worker
        if (!('serviceWorker' in navigator)) {
            setDiag(prev => ({ ...prev, sw: { status: 'unsupported', reason: 'Browser lacks SW support (Common in older browsers or incognito).' } }));
        } else {
            const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            if (!isSecure) {
                setDiag(prev => ({ ...prev, sw: { status: 'insecure', reason: 'PWA DISABLED: Browser requires HTTPS or localhost.' } }));
            } else {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    const active = registrations.find(r => r.active || r.waiting);
                    if (active) {
                        setDiag(prev => ({ ...prev, sw: { status: 'active', reason: `Active scope: ${active.scope}` } }));
                    } else {
                        setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'No Service Worker found. Visit the Home page once to trigger registration.' } }));
                    }
                } catch (e) {
                    setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'Error querying SW registry.' } }));
                }
            }
        }

        // 3. Check Manifest
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (manifestLink) {
            setDiag(prev => ({ ...prev, manifest: { status: 'found', reason: `Link detected: ${manifestLink.getAttribute('href')}` } }));
        } else {
            setDiag(prev => ({ ...prev, manifest: { status: 'missing', reason: 'Manifest link not found in head. This will block installation.' } }));
        }

        // 4. Check Prompt Readiness
        if (window.deferredInstallPrompt) {
            setDiag(prev => ({ ...prev, prompt: { status: 'ready', reason: 'Browser event fired! "Install App" button should be visible.' } }));
        } else {
            setDiag(prev => ({ ...prev, prompt: { status: 'waiting', reason: 'Waiting for browser event. Chrome requires user engagement (clicks/scrolls) before firing.' } }));
        }
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
                await setDoc(testRef, { timestamp: serverTimestamp(), userId: user.uid, type: 'sync-test' });
                toast({ title: "Sync Test Started" });
            } catch (e) {
                toast({ variant: 'destructive', title: "Write Failed" });
            }
        });
    };

    if (isAdminLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-4xl space-y-12 pb-32">
            <div className="flex justify-between items-end border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">PWA Audit</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Reason-Based Diagnostic center</p>
                </div>
                <Button onClick={performAudit} variant="outline" className="rounded-full h-12 px-6 font-black uppercase text-[10px] tracking-widest border-2">
                    <RefreshCw className="mr-2 h-4 w-4" /> Re-Scan System
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                {/* SW CHECK */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Service Worker
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase opacity-40">Status</span>
                            <Badge variant={diag.sw.status === 'active' ? 'default' : 'destructive'} className="font-black uppercase text-[9px]">
                                {diag.sw.status.toUpperCase()}
                            </Badge>
                        </div>
                        <p className="text-[11px] font-bold text-gray-600 leading-tight p-4 bg-muted/30 rounded-2xl border border-black/5">
                            {diag.sw.reason}
                        </p>
                    </CardContent>
                </Card>

                {/* MANIFEST CHECK */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <FileCode className="h-4 w-4 text-primary" /> Registry Link
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase opacity-40">Manifest Discovery</span>
                            <Badge variant={diag.manifest.status === 'found' ? 'default' : 'destructive'} className="font-black uppercase text-[9px]">
                                {diag.manifest.status.toUpperCase()}
                            </Badge>
                        </div>
                        <p className="text-[11px] font-bold text-gray-600 leading-tight p-4 bg-muted/30 rounded-2xl border border-black/5">
                            {diag.manifest.reason}
                        </p>
                    </CardContent>
                </Card>

                {/* PROMPT READINESS */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <SmartphoneNfc className="h-4 w-4 text-primary" /> Install Event
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase opacity-40">Prompt State</span>
                            <Badge variant={diag.prompt.status === 'ready' ? 'default' : 'secondary'} className="font-black uppercase text-[9px]">
                                {diag.prompt.status.toUpperCase()}
                            </Badge>
                        </div>
                        <p className="text-[11px] font-bold text-gray-600 leading-tight p-4 bg-muted/30 rounded-2xl border border-black/5">
                            {diag.prompt.reason}
                        </p>
                    </CardContent>
                </Card>

                {/* NETWORK & SYNC */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white border-2 border-primary/20">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Cloud className="h-4 w-4 text-primary" /> Sync Diagnostics
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-6 text-center">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Queue Status</p>
                            <p className="font-black text-sm uppercase">
                                {lastSyncStatus === 'idle' && "Idle"}
                                {lastSyncStatus === 'writing' && "Triggering Write..."}
                                {lastSyncStatus === 'queued' && "Queued (Waiting for Sync)"}
                                {lastSyncStatus === 'synced' && "Sync Success!"}
                            </p>
                        </div>
                        <Button onClick={handleTestSync} disabled={isTesting} className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                            Test Background Sync
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-[3rem] border-0 shadow-2xl bg-slate-900 text-white p-10">
                <div className="flex items-start gap-6">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-primary shrink-0">
                        <Globe className="h-6 w-6" />
                    </div>
                    <div>
                        <h3 className="text-xl font-black uppercase tracking-tight mb-2">PWA Installation Checklist</h3>
                        <div className="space-y-4 text-xs font-bold text-white/60 leading-relaxed">
                            <p>1. <strong className="text-white">Is the page HTTPS?</strong>: Chrome will hide the install button on insecure HTTP pages.</p>
                            <p>2. <strong className="text-white">User Engagement</strong>: Browsers often wait for you to click or scroll before showing the prompt.</p>
                            <p>3. <strong className="text-white">Already Installed?</strong>: Check if the app is already on your home screen.</p>
                            <p>4. <strong className="text-white">Private Browsing</strong>: PWAs are disabled in Incognito/Private tabs.</p>
                        </div>
                    </div>
                </div>
            </Card>
        </div>
    );
}
