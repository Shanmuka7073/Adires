
'use client';

import { useState, useTransition, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, where, Firestore } from 'firebase/firestore';
import type { AppLog } from '@/lib/monitoring/logger';
import { clearAllLogs } from '@/lib/monitoring/logger';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    Activity, 
    ShieldAlert, 
    Trash2, 
    Download, 
    RefreshCw, 
    Wifi, 
    WifiOff, 
    CheckCircle2, 
    Loader2, 
    Filter,
    AlertCircle,
    Server,
    Clock
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

export default function SystemMonitoringPage() {
    const { firestore, user, profile, appReady } = useFirebase();
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [isClearing, startClear] = useTransition();
    const [severityFilter, setSeverityFilter] = useState<string>('all');

    // 1. Fetch Logs
    const logsQuery = useMemoFirebase(() => {
        if (!firestore) return null;
        const base = collection(firestore, 'app_logs');
        if (severityFilter !== 'all') {
            return query(base, where('severity', '==', severityFilter), orderBy('timestamp', 'desc'), limit(100));
        }
        return query(base, orderBy('timestamp', 'desc'), limit(100));
    }, [firestore, severityFilter]);

    const { data: logs, isLoading: logsLoading, refetch } = useCollection<AppLog>(logsQuery);

    const stats = useMemo(() => {
        if (!logs) return { errors: 0, warnings: 0, critical: 0 };
        return {
            errors: logs.filter(l => l.severity === 'error').length,
            warnings: logs.filter(l => l.severity === 'warning').length,
            critical: logs.filter(l => l.severity === 'critical').length,
        };
    }, [logs]);

    const handleClearLogs = () => {
        if (!firestore || !confirm('Permanently purge all system logs?')) return;
        startClear(async () => {
            await clearAllLogs(firestore);
            toast({ title: 'Logs Cleared' });
            refetch();
        });
    };

    const handleDownload = () => {
        if (!logs) return;
        const headers = ['Time', 'Severity', 'Type', 'Message', 'User', 'Route'];
        const csvContent = [
            headers.join(','),
            ...logs.map(l => [
                l.timestamp?.toDate()?.toISOString() || '',
                l.severity,
                l.type,
                `"${l.message.replace(/"/g, '""')}"`,
                l.userId || 'Guest',
                l.route
            ].join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `adires_logs_${format(new Date(), 'yyyy-MM-dd')}.csv`;
        a.click();
    };

    if (isAdminLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;
    if (!isAdmin) { router.replace('/dashboard'); return null; }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b pb-10 border-black/5">
                <div>
                    <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">Pulse</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Operational Health & Real-time Audit</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={handleDownload} className="rounded-full h-10 px-4 font-black text-[10px] uppercase tracking-widest border-2">
                        <Download className="mr-2 h-4 w-4" /> Export CSV
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleClearLogs} disabled={isClearing} className="rounded-full h-10 px-4 font-black text-[10px] uppercase tracking-widest text-red-500 hover:bg-red-50">
                        {isClearing ? <Loader2 className="animate-spin h-4 w-4" /> : <Trash2 className="mr-2 h-4 w-4" />} Clear Vault
                    </Button>
                </div>
            </div>

            {/* A. SYSTEM STATUS CARDS */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className={cn("h-12 w-12 rounded-2xl flex items-center justify-center", appReady ? "bg-green-100 text-green-600" : "bg-amber-100 text-amber-600")}>
                            <Activity className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black uppercase opacity-40">App State</p>
                            <p className="text-lg font-black uppercase italic">{appReady ? 'Synchronized' : 'Booting'}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center">
                            <ShieldAlert className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black uppercase opacity-40">Critical Events</p>
                            <p className="text-2xl font-black">{stats.critical + stats.errors}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                            <Server className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black uppercase opacity-40">Project ID</p>
                            <p className="text-[10px] font-mono font-bold truncate max-w-[120px]">{firestore?.app.options.projectId}</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="rounded-[2rem] border-0 shadow-lg bg-slate-900 text-white overflow-hidden">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/10 text-primary flex items-center justify-center">
                            <Wifi className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black uppercase opacity-40">Cloud Sync</p>
                            <p className="text-lg font-black text-green-400 uppercase">Active</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* B. LOGS FEED */}
            <div className="space-y-6">
                <div className="flex justify-between items-center px-1">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 flex items-center gap-2">
                        <Filter className="h-3 w-3" /> Event Manifest
                    </h2>
                    <div className="flex gap-1 bg-black/5 p-1 rounded-xl border">
                        {['all', 'critical', 'error', 'warning', 'info'].map(s => (
                            <button 
                                key={s} 
                                onClick={() => setSeverityFilter(s)}
                                className={cn(
                                    "px-3 h-7 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                                    severityFilter === s ? "bg-white shadow-sm text-primary" : "text-gray-400"
                                )}
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>

                <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
                    {logsLoading ? (
                        <div className="p-20 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>
                    ) : !logs || logs.length === 0 ? (
                        <div className="p-32 text-center opacity-30 flex flex-col items-center gap-4">
                            <CheckCircle2 className="h-16 w-16 text-green-500 opacity-20" />
                            <p className="font-black uppercase tracking-widest text-xs">Zero anomalies detected</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-black/5">
                                    <TableRow>
                                        <TableHead className="text-[10px] font-black uppercase pl-6">Timestamp</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase">Level</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase">Event & Route</TableHead>
                                        <TableHead className="text-[10px] font-black uppercase">Identity</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {logs.map((log) => (
                                        <TableRow key={log.id} className="group hover:bg-muted/30 border-b border-black/5">
                                            <TableCell className="py-6 pl-6">
                                                <div className="flex flex-col">
                                                    <span className="text-xs font-bold text-gray-900">{log.timestamp ? format(log.timestamp.toDate(), 'HH:mm:ss') : '...'}</span>
                                                    <span className="text-[8px] font-bold opacity-40 uppercase">{log.timestamp ? format(log.timestamp.toDate(), 'dd MMM') : ''}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={cn(
                                                    "text-[8px] font-black uppercase h-5 border-0 shadow-sm px-2",
                                                    log.severity === 'critical' ? "bg-red-600 text-white animate-pulse" :
                                                    log.severity === 'error' ? "bg-red-500 text-white" :
                                                    log.severity === 'warning' ? "bg-amber-500 text-white" : "bg-blue-500 text-white"
                                                )}>
                                                    {log.severity}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="max-w-md">
                                                    <p className="font-black text-xs uppercase tracking-tight text-gray-950 truncate">{log.type}</p>
                                                    <p className="text-[10px] font-medium text-gray-500 line-clamp-1 italic">"{log.message}"</p>
                                                    <p className="text-[8px] font-black text-primary uppercase mt-1 tracking-widest">{log.route}</p>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black uppercase opacity-40 tracking-tighter">UID: {log.userId?.slice(-6) || 'Guest'}</span>
                                                    <span className="text-[8px] font-bold text-indigo-600 uppercase tracking-widest">{log.accountType || 'External'}</span>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </Card>
            </div>

            {/* C. CRITICAL ALERTS PANEL */}
            <div className="grid md:grid-cols-2 gap-8">
                <Card className="rounded-[2.5rem] bg-red-50 border-2 border-red-100 p-8 shadow-lg">
                    <div className="flex gap-4 items-start">
                        <AlertCircle className="h-8 w-8 text-red-600 mt-1 shrink-0" />
                        <div>
                            <h3 className="font-black uppercase text-sm tracking-tight text-red-950">Integrity Protocol</h3>
                            <p className="text-xs font-bold text-red-800/60 leading-relaxed uppercase mt-2">
                                The system automatically flags "Critical" alerts for state loops, loading deadlocks, and Component crashes. These must be investigated immediately to prevent revenue loss.
                            </p>
                        </div>
                    </div>
                </Card>

                <Card className="rounded-[2.5rem] bg-indigo-900 text-white p-8 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><Clock className="h-32 w-32" /></div>
                    <div className="relative z-10">
                        <h3 className="text-xl font-black uppercase tracking-tight italic mb-2">Zero-Console Mode</h3>
                        <p className="text-sm font-bold opacity-60 leading-relaxed uppercase">
                            All errors are now serialized and stored. You no longer need browser developer tools to audit the system health.
                        </p>
                    </div>
                </Card>
            </div>
        </div>
    );
}
