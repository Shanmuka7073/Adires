
'use client';

import { useState, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit, deleteDoc, doc, writeBatch, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { 
    AlertTriangle, 
    Trash2, 
    RefreshCw, 
    Search, 
    Loader2, 
    ExternalLink,
    Filter,
    Terminal
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { Input } from '@/components/ui/input';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function ErrorVaultPage() {
    const { firestore } = useFirebase();
    const { isAdmin, isLoading: isAdminLoading } = useAdminAuth();
    const router = useRouter();
    const { toast } = useToast();
    const [search, setSearch] = useState('');
    const [isClearing, setIsClearing] = useState(false);

    const logsQuery = useMemoFirebase(() => 
        firestore ? query(collection(firestore, 'error_logs'), orderBy('timestamp', 'desc'), limit(100)) : null, 
    [firestore]);

    const { data: logs, isLoading, refetch } = useCollection<any>(logsQuery);

    const filteredLogs = useMemo(() => {
        if (!logs) return [];
        return logs.filter(l => 
            l.message?.toLowerCase().includes(search.toLowerCase()) || 
            l.userId?.includes(search) ||
            l.accountType?.includes(search)
        );
    }, [logs, search]);

    const handleClearAll = async () => {
        if (!firestore || !confirm("Permanently purge error logs?")) return;
        setIsClearing(true);
        try {
            const snap = await getDocs(collection(firestore, 'error_logs'));
            const batch = writeBatch(firestore);
            snap.docs.forEach(d => batch.delete(d.ref));
            await batch.commit();
            toast({ title: "Vault Purged" });
            refetch();
        } finally {
            setIsClearing(false);
        }
    };

    if (!isAdminLoading && !isAdmin) {
        router.replace('/dashboard');
        return null;
    }

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b pb-10 border-black/5 text-left">
                <div>
                    <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">Error Vault</h1>
                    <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">System-wide Crash Diagnostics</p>
                </div>
                <div className="flex gap-2 w-full md:w-auto">
                    <Button variant="outline" size="sm" onClick={() => refetch()} className="flex-1 rounded-xl h-10 border-2 font-black text-[10px] uppercase">
                        <RefreshCw className={cn("mr-2 h-3 w-3", isLoading && "animate-spin")} /> Refresh
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleClearAll} disabled={isClearing} className="flex-1 rounded-xl h-10 font-black text-[10px] uppercase text-red-500 hover:bg-red-50">
                        <Trash2 className="mr-2 h-3 w-3" /> Clear All
                    </Button>
                </div>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                    <Input 
                        placeholder="Search by message, UID, or role..." 
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="h-12 rounded-xl border-2 pl-10 font-bold uppercase text-xs shadow-sm bg-white"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="rounded-[2rem] border-0 shadow-lg bg-white overflow-hidden">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600">
                            <AlertTriangle className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black uppercase opacity-40">Total Logs</p>
                            <p className="text-2xl font-black">{logs?.length || 0}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-lg bg-slate-900 text-white overflow-hidden">
                    <CardContent className="p-6 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-2xl bg-white/10 flex items-center justify-center text-primary">
                            <Terminal className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-[8px] font-black uppercase opacity-40">Status</p>
                            <p className="text-lg font-black uppercase text-green-400">Monitoring Active</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white">
                {isLoading ? (
                    <div className="p-20 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-32 text-center opacity-30 flex flex-col items-center gap-4">
                        <CheckCircle2 className="h-16 w-16 text-green-500 opacity-20" />
                        <p className="font-black uppercase tracking-widest text-xs">No errors in vault</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader className="bg-black/5">
                                <TableRow>
                                    <TableHead className="text-[10px] font-black uppercase pl-6">Time & Role</TableHead>
                                    <TableHead className="text-[10px] font-black uppercase">Message & Context</TableHead>
                                    <TableHead className="text-right text-[10px] font-black uppercase pr-6">Source</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredLogs.map(log => (
                                    <TableRow key={log.id} className="border-b border-black/5 hover:bg-muted/30">
                                        <TableCell className="py-6 pl-6 text-left">
                                            <div className="flex flex-col">
                                                <span className="text-xs font-black text-gray-900">
                                                    {log.timestamp ? format(log.timestamp.toDate(), 'p') : '...'}
                                                </span>
                                                <Badge variant="outline" className="mt-1 w-fit text-[8px] font-black uppercase border-primary/20 text-primary">
                                                    {log.accountType || 'guest'}
                                                </Badge>
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-md text-left">
                                            <p className="font-black text-xs text-red-600 leading-tight line-clamp-2">
                                                {log.message}
                                            </p>
                                            <p className="text-[9px] font-bold opacity-40 uppercase mt-1 truncate">
                                                UID: {log.userId || 'anonymous'}
                                            </p>
                                            <div className="mt-2 text-[8px] font-mono p-2 bg-black/5 rounded-lg line-clamp-3 overflow-hidden text-gray-500">
                                                {log.stack || 'No stack trace available'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <a 
                                                href={log.url} 
                                                target="_blank" 
                                                className="inline-flex items-center gap-1.5 text-[9px] font-black uppercase text-primary hover:underline"
                                            >
                                                Page <ExternalLink className="h-3 w-3" />
                                            </a>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
            </Card>
        </div>
    );
}

function CheckCircle2({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
            <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
        </svg>
    )
}
