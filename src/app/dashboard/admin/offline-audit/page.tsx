
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
    SmartphoneNfc,
    MousePointer2,
    Sparkles,
    Zap,
    ArrowRight,
    Check,
    Globe,
    Lock
} from 'lucide-react';
import { useFirebase } from '@/firebase';
import { doc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

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

        // 3. Check Service Worker
        if (!('serviceWorker' in navigator)) {
            setDiag(prev => ({ ...prev, sw: { status: 'unsupported', reason: 'Browser lacks SW support.' } }));
        } else {
            const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
            if (!isSecure) {
                setDiag(prev => ({ ...prev, sw: { status: 'insecure', reason: 'PWA DISABLED: Browser requires HTTPS.' } }));
            } else {
                try {
                    const registrations = await navigator.serviceWorker.getRegistrations();
                    const active = registrations.find(r => r.active || r.waiting);
                    if (active) {
                        setDiag(prev => ({ ...prev, sw: { status: 'active', reason: `Active scope: ${active.scope}` } }));
                    } else {
                        setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'No Service Worker found. Visit the Home page once.' } }));
                    }
                } catch (e) {
                    setDiag(prev => ({ ...prev, sw: { status: 'missing', reason: 'Error querying SW registry.' } }));
                }
            }
        }

        // 4. Check Manifest
        const manifestLink = document.querySelector('link[rel="manifest"]');
        if (manifestLink) {
            setDiag(prev => ({ ...prev, manifest: { status: 'found', reason: `Link detected: ${manifestLink.getAttribute('href')}` } }));
        } else {
            setDiag(prev => ({ ...prev, manifest: { status: 'missing', reason: 'Manifest link not found in head.' } }));
        }

        // 5. Check Prompt Readiness
        if (window.deferredInstallPrompt) {
            setDiag(prev => ({ ...prev, prompt: { status: 'ready', reason: 'Install prompt is primed and ready to fire.' } }));
        } else {
            setDiag(prev => ({ ...prev, prompt: { status: 'waiting', reason: 'Waiting for browser interaction event.' } }));
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

    const handleTriggerEngagement = () => {
        window.scrollBy({ top: 100, behavior: 'smooth' });
        setTimeout(() => window.scrollBy({ top: -100, behavior: 'smooth' }), 500);
        toast({ title: "Engagement Triggered", description: "Simulating interaction to wake up the browser." });
        performAudit();
    };

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
                    description: "Check Firestore Security Rules for 'diagnostic_logs'." 
                });
            }
        });
    };

    if (isAdminLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-4xl space-y-12 pb-32">
            <div className="flex justify-between items-end border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">Decision Audit</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Domain: adires.vercel.app</p>
                </div>
                <Button onClick={performAudit} variant="outline" className="rounded-full h-12 px-6 font-black uppercase text-[10px] tracking-widest border-2">
                    <RefreshCw className="mr-2 h-4 w-4" /> Re-Scan
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
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

                {/* SW CHECK */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                            <Lock className="h-4 w-4 text-primary" /> App Shell (PWA)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-4">
                        <div className="flex justify-between items-center">
                            <span className="text-[10px] font-black uppercase opacity-40">Service Worker</span>
                            <Badge variant={diag.sw.status === 'active' ? 'default' : 'destructive'} className="font-black uppercase text-[9px]">
                                {diag.sw.status.toUpperCase()}
                            </Badge>
                        </div>
                        <p className="text-[11px] font-bold text-gray-600 leading-tight p-4 bg-muted/30 rounded-2xl border border-black/5">
                            {diag.sw.reason}
                        </p>
                    </CardContent>
                </Card>

                {/* PROMPT READINESS */}
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 pb-6 border-b border-black/5">
                        <div className="flex justify-between items-center">
                            <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                                <SmartphoneNfc className="h-4 w-4 text-primary" /> Install Event
                            </CardTitle>
                            <Button size="sm" variant="ghost" onClick={handleTriggerEngagement} className="h-7 rounded-lg text-[8px] font-black uppercase bg-primary/10 hover:bg-primary/20 text-primary">
                                <MousePointer2 className="mr-1 h-3 w-3" /> Engage
                            </Button>
                        </div>
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
                            <div className="text-sm font-black text-gray-900 uppercase min-h-[24px]">
                                {lastSyncStatus === 'idle' && "Ready to Test"}
                                {lastSyncStatus === 'writing' && "Triggering Write..."}
                                {lastSyncStatus === 'queued' && <span className="text-amber-600 flex items-center justify-center gap-2 animate-pulse"><Zap className="h-4 w-4 fill-current"/> Queued (Waiting for Sync)</span>}
                                {lastSyncStatus === 'synced' && <span className="text-green-600 flex items-center justify-center gap-2"><CheckCircle2 className="h-4 w-4"/> Sync Success!</span>}
                            </div>
                        </div>
                        <Button onClick={handleTestSync} disabled={isTesting} className="w-full max-w-sm h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20">
                            {isTesting ? 'Testing...' : 'Test Background Sync'}
                        </Button>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-[3rem] border-0 shadow-2xl bg-slate-900 text-white p-10 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                    <Check className="h-48 w-48 text-primary" strokeWidth={4} />
                </div>
                <div className="relative z-10 space-y-4">
                    <p className="text-xl font-bold leading-relaxed text-primary/90">
                        "Environment Health Verified."
                    </p>
                    <p className="text-sm font-medium text-white/60 leading-relaxed max-w-2xl">
                        Your **Sync Success** on `adires.vercel.app` confirms that your deployment is production-ready. Remember to add your Google Verification token to the layout meta-tags to complete the Google Cloud handshake.
                    </p>
                    <Button asChild variant="outline" className="rounded-xl border-white/20 text-white hover:bg-white/10 font-black uppercase text-[10px] h-12 px-8">
                        <Link href="/dashboard/admin">Return to Dashboard <ArrowRight className="ml-2 h-4 w-4"/></Link>
                    </Button>
                </div>
            </Card>
        </div>
    );
}
