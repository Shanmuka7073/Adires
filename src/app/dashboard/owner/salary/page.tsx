'use client';

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react';
import { useFirebase, useCollection, useDoc, useMemoFirebase } from '@/firebase';
import { collection, query, where, doc, orderBy, Timestamp } from 'firebase/firestore';
import type { Store, EmployeeProfile, AttendanceRecord, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarIcon, Loader2, FileText, CheckCircle, XCircle, Eye, Info } from 'lucide-react';
import { format, startOfMonth, endOfMonth, getDaysInMonth, startOfDay, differenceInDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { approveRegularization, rejectRegularization } from '@/app/actions';
import { useAppStore } from '@/lib/store';

// LAZY LOAD HEAVY DATE PICKER
const Calendar = dynamic(() => import('@/components/ui/calendar').then(mod => mod.Calendar), { 
    loading: () => <div className="h-64 w-full bg-muted animate-pulse rounded-xl" />
});

const Popover = dynamic(() => import('@/components/ui/popover').then(mod => mod.Popover), { ssr: false });
const PopoverContent = dynamic(() => import('@/components/ui/popover').then(mod => mod.PopoverContent), { ssr: false });
const PopoverTrigger = dynamic(() => import('@/components/ui/popover').then(mod => mod.PopoverTrigger), { ssr: false });

function ApprovalRequests({ storeId }: { storeId: string }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isUpdating, startUpdate] = useTransition();
    const [rejectionReason, setRejectionReason] = useState("");
    const [selectedRequest, setSelectedRequest] = useState<AttendanceRecord | null>(null);

    const requestsQuery = useMemoFirebase(() => {
        if (!firestore || !storeId) return null;
        return query(
            collection(firestore, `stores/${storeId}/attendance`),
            where('status', '==', 'pending_approval')
        );
    }, [firestore, storeId]);

    const { data: requests, isLoading, refetch } = useCollection<AttendanceRecord>(requestsQuery);

    const handleApproval = async (request: AttendanceRecord, isApproved: boolean) => {
        if (!isApproved && !rejectionReason.trim()) {
            toast({ variant: "destructive", title: "Reason Required" });
            return;
        }

        startUpdate(async () => {
            const action = isApproved
                ? approveRegularization(request.id, storeId, true)
                : rejectRegularization(request.id, storeId, rejectionReason);
            
            try {
                await action;
                toast({ title: 'Success' });
                setSelectedRequest(null);
                setRejectionReason("");
                if (refetch) refetch();
            } catch (e) {
                toast({ variant: "destructive", title: "Failed" });
            }
        });
    };

    if (isLoading) return <Skeleton className="h-24 w-full rounded-2xl" />;
    if (!requests || requests.length === 0) return null;

    return (
        <>
            <Dialog open={!!selectedRequest} onOpenChange={(o) => !o && setSelectedRequest(null)}>
                <DialogContent className="rounded-[2rem] border-0 shadow-2xl">
                    <DialogHeader><DialogTitle className="font-black uppercase">Reject Request</DialogTitle></DialogHeader>
                    <div className="py-4"><Label className="text-[10px] font-black uppercase opacity-40">Reason for employee</Label><Textarea value={rejectionReason} onChange={(e) => setRejectionReason(e.target.value)} className="rounded-xl border-2" /></div>
                    <DialogFooter><Button variant="ghost" onClick={() => setSelectedRequest(null)}>Cancel</Button><Button variant="destructive" onClick={() => handleApproval(selectedRequest!, false)} disabled={isUpdating}>Confirm Reject</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-4">
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 px-1 text-amber-600">Pending Attendance Approvals</h3>
                {requests.map(req => (
                    <Card key={req.id} className="rounded-2xl border-2 border-amber-200 bg-amber-50/50 p-4 flex justify-between items-center">
                        <div className="min-w-0">
                            <p className="font-black text-xs uppercase text-amber-900 truncate">ID: {req.employeeId.slice(-6)}</p>
                            <p className="text-[10px] font-bold text-amber-700 opacity-60 uppercase">{req.workDateStr}</p>
                        </div>
                        <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="h-8 rounded-lg text-amber-900" onClick={() => setSelectedRequest(req)}><XCircle className="h-4 w-4" /></Button>
                            <Button size="sm" className="h-8 rounded-lg bg-amber-600 text-white" onClick={() => handleApproval(req, true)}><CheckCircle className="h-4 w-4" /></Button>
                        </div>
                    </Card>
                ))}
            </div>
        </>
    );
}

export default function SalaryReportsPage() {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<any>({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) });
    const { userStore, stores, fetchInitialData } = useAppStore();

    const myStore = useMemo(() => userStore || stores.find(s => s.ownerId === user?.uid) || null, [userStore, stores, user?.uid]);

    const employeesQuery = useMemoFirebase(() => (firestore && myStore) ? query(collection(firestore, 'employeeProfiles'), where('storeId', '==', myStore.id)) : null, [myStore, firestore]);
    const { data: employees, isLoading: employeesLoading } = useCollection<EmployeeProfile>(employeesQuery);

    const handleDownload = () => {
        if (!selectedEmployeeId || !dateRange.from) return;
        const period = format(dateRange.from, 'yyyy-MM');
        const slipId = `${myStore?.id}_${selectedEmployeeId}_${period}`;
        window.open(`/api/salary-slip/docx?slipId=${slipId}&storeId=${myStore?.id}`, '_blank');
    };

    if (!myStore) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    return (
        <div className="container mx-auto py-12 px-4 md:px-6 max-w-4xl space-y-12 pb-32 animate-in fade-in duration-500">
            <div className="border-b pb-10 border-black/5">
                <h1 className="text-6xl font-black font-headline tracking-tighter uppercase italic leading-none text-gray-950">Payroll Audit</h1>
                <p className="font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Financial Settlement Center</p>
            </div>

            <ApprovalRequests storeId={myStore.id} />

            <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-40">Target Employee</Label>
                    <Select onValueChange={setSelectedEmployeeId} value={selectedEmployeeId || ''}>
                        <SelectTrigger className="h-12 rounded-xl border-2 font-bold"><SelectValue placeholder="Select staff member" /></SelectTrigger>
                        <SelectContent className="rounded-xl border-2">
                            {employees?.map(emp => (
                                <SelectItem key={emp.userId} value={emp.userId} className="rounded-lg">{emp.role} • {emp.employeeId}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase opacity-40">Settlement Period</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="w-full h-12 rounded-xl border-2 font-black text-[10px] uppercase justify-start">
                                <CalendarIcon className="mr-2 h-4 w-4 opacity-40" />
                                {dateRange.from ? format(dateRange.from, "MMM yyyy") : "Select Month"}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 border-0 shadow-2xl rounded-3xl overflow-hidden" align="end">
                            <Calendar mode="range" selected={dateRange} onSelect={setDateRange} initialFocus />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            {selectedEmployeeId && (
                <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-slate-900 text-white relative">
                    <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12"><FileText className="h-32 w-32" /></div>
                    <CardHeader className="p-8 pb-4 relative z-10">
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Settlement Engine</CardTitle>
                        <CardDescription className="text-white/40 font-bold text-[10px] uppercase">Review attendance before issuing slip</CardDescription>
                    </CardHeader>
                    <CardContent className="p-8 pt-0 relative z-10">
                        <Button onClick={handleDownload} className="w-full h-14 rounded-2xl bg-white text-gray-950 font-black uppercase text-xs tracking-widest shadow-2xl hover:bg-white/90">
                            Download Official Statement
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
