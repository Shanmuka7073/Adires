
'use client';

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, orderBy, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
import type { Store, EmployeeProfile, AttendanceRecord, SalarySlip } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarIcon, Loader2, FileText, CheckCircle, XCircle } from 'lucide-react';
import { format, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


function ApprovalRequests({ storeId }: { storeId: string }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isUpdating, startUpdate] = useTransition();

    const requestsQuery = useMemoFirebase(() => {
        if (!firestore || !storeId) return null;
        return query(
            collection(firestore, `stores/${storeId}/attendance`),
            where('status', '==', 'pending_approval')
        );
    }, [firestore, storeId]);

    const { data: requests, isLoading, refetch } = useCollection<AttendanceRecord>(requestsQuery);

    const handleApproval = (recordId: string, isApproved: boolean) => {
        if (!firestore || !storeId) return;
        
        startUpdate(async () => {
            const newStatus = isApproved ? 'approved' : 'rejected';
            const recordRef = doc(firestore, `stores/${storeId}/attendance`, recordId);
            const updateData = { status: newStatus, workHours: isApproved ? 8 : 0 };

            try {
              await updateDoc(recordRef, updateData);
              toast({ title: 'Request Updated', description: `The attendance request has been ${newStatus}.` });
              if (refetch) refetch();
            } catch(error) {
              const permissionError = new FirestorePermissionError({
                  path: recordRef.path,
                  operation: 'update',
                  requestResourceData: updateData,
              });
              errorEmitter.emit('permission-error', permissionError);
            }
        });
    };

    const handleApproveAll = () => {
        if (!firestore || !requests || requests.length === 0) return;
        
        startUpdate(async () => {
            const batch = writeBatch(firestore);
            requests.forEach(req => {
                const recordRef = doc(firestore, `stores/${storeId}/attendance`, req.id);
                batch.update(recordRef, { status: 'approved', workHours: 8 });
            });

            try {
              await batch.commit();
              toast({ title: 'All Requests Approved', description: `${requests.length} requests have been approved.` });
              if (refetch) refetch();
            } catch(error) {
              const firstReq = requests[0];
              const permissionError = new FirestorePermissionError({
                  path: `stores/${storeId}/attendance/${firstReq.id}`,
                  operation: 'update',
                  requestResourceData: { status: 'approved', workHours: 8 },
              });
              errorEmitter.emit('permission-error', permissionError);
            }
        });
    };

    if (isLoading) return <Skeleton className="h-24 w-full" />;

    if (!requests || requests.length === 0) {
        return (
             <Card>
                <CardHeader>
                    <CardTitle>No Pending Approvals</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">There are no missed attendance requests from your employees right now.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-amber-400 bg-amber-50">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-amber-900">Attendance Approval Requests</CardTitle>
                        <CardDescription className="text-amber-800">Review and approve or reject missed punch-in requests from your employees.</CardDescription>
                    </div>
                     <Button size="sm" onClick={handleApproveAll} disabled={isUpdating}>
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Approve All ({requests.length})
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Employee ID</TableHead>
                            <TableHead>Date Requested</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map(req => (
                            <TableRow key={req.id}>
                                <TableCell className="font-mono">{req.employeeId.slice(0, 8)}...</TableCell>
                                <TableCell>{format(new Date(req.workDate), 'PPP')}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button size="sm" variant="ghost" onClick={() => handleApproval(req.id, false)} disabled={isUpdating}>
                                        <XCircle className="mr-2 h-4 w-4 text-destructive" /> Reject
                                    </Button>
                                    <Button size="sm" onClick={() => handleApproval(req.id, true)} disabled={isUpdating}>
                                        <CheckCircle className="mr-2 h-4 w-4" /> Approve
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    );
}


export default function SalaryReportsPage() {
    const { user, firestore } = useFirebase();
    const { toast } = useToast();
    const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
    const [dateRange, setDateRange] = useState<DateRange | undefined>({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    const [isGenerating, startGeneration] = useTransition();

    const storeQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid)) : null), [user, firestore]);
    const { data: stores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
    const myStore = useMemo(() => stores?.[0], [stores]);

    const employeesQuery = useMemoFirebase(() => (myStore ? query(collection(firestore, 'employeeProfiles'), where('storeId', '==', myStore.id)) : null), [myStore, firestore]);
    const { data: employees, isLoading: employeesLoading } = useCollection<EmployeeProfile>(employeesQuery);

    const attendanceQuery = useMemoFirebase(() => {
        if (!myStore || !selectedEmployeeId || !dateRange?.from || !dateRange?.to) return null;
        return query(
            collection(firestore, `stores/${myStore.id}/attendance`),
            where('employeeId', '==', selectedEmployeeId),
            where('workDate', '>=', format(dateRange.from, 'yyyy-MM-dd')),
            where('workDate', '<=', format(dateRange.to, 'yyyy-MM-dd')),
            orderBy('workDate', 'desc')
        );
    }, [myStore, selectedEmployeeId, dateRange]);
    const { data: attendanceRecords, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);

    const selectedEmployee = useMemo(() => employees?.find(e => e.userId === selectedEmployeeId), [employees, selectedEmployeeId]);

    const reportData = useMemo(() => {
        if (!attendanceRecords || !selectedEmployee) return null;

        const presentOrApprovedRecords = attendanceRecords.filter(r => r.status === 'present' || r.status === 'approved');

        const totalHours = presentOrApprovedRecords.reduce((acc, record) => acc + (record.workHours || 0), 0);
        let baseSalary = 0;

        if (selectedEmployee.salaryType === 'monthly') {
            baseSalary = selectedEmployee.salaryRate;
        } else {
            baseSalary = totalHours * selectedEmployee.salaryRate;
        }
        const netPay = baseSalary; // Add deductions/bonuses logic here in future

        return { totalHours, baseSalary, netPay, records: attendanceRecords };
    }, [attendanceRecords, selectedEmployee]);

    // Effect to automatically generate the salary slip when data is ready
    useEffect(() => {
        const generateAndSaveSlip = async () => {
            if (!myStore || !selectedEmployee || !reportData || !dateRange?.from || !dateRange?.to || !firestore) {
                return;
            }

            // CRITICAL FIX: Only generate if there is a salary to be paid.
            if (reportData.baseSalary <= 0) {
                console.log(`Skipping salary slip for ${selectedEmployee.userId} as base salary is zero.`);
                return;
            }

            const slipData: Omit<SalarySlip, 'id'> = {
                employeeId: selectedEmployee.userId,
                storeId: myStore.id,
                periodStart: format(dateRange.from, 'yyyy-MM-dd'),
                periodEnd: format(dateRange.to, 'yyyy-MM-dd'),
                baseSalary: reportData.baseSalary,
                overtimeHours: 0,
                overtimePay: 0,
                deductions: 0,
                netPay: reportData.netPay,
                generatedAt: serverTimestamp(),
            };
            
            const slipId = `${selectedEmployee.userId}_${format(dateRange.from, 'yyyy-MM')}`;
            const slipRef = doc(firestore, `stores/${myStore.id}/salarySlips`, slipId);

            try {
                await setDoc(slipRef, slipData, { merge: true });
                console.log(`Salary slip for ${selectedEmployee.userId} for ${format(dateRange.from, 'MMMM yyyy')} was automatically saved.`);
            } catch (error) {
                console.error("Auto-generation of salary slip failed:", error);
                 const permissionError = new FirestorePermissionError({
                    path: slipRef.path,
                    operation: 'write',
                    requestResourceData: slipData,
                });
                errorEmitter.emit('permission-error', permissionError);
            }
        };

        if (reportData && !attendanceLoading) {
            generateAndSaveSlip();
        }
    }, [reportData, attendanceLoading, myStore, selectedEmployee, dateRange, firestore]);
    
    if (storeLoading) return <div className="container mx-auto py-12">Loading store information...</div>
    if (!myStore) return <div className="container mx-auto py-12">You must have a store to access this page.</div>

    return (
        <div className="container mx-auto py-12 px-4 md:px-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-3"><FileText className="h-8 w-8 text-primary" /> Salary Reports</CardTitle>
                    <CardDescription>Select an employee and a date range to view attendance and generate salary slips.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <ApprovalRequests storeId={myStore.id} />
                    <div className="grid md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label>Employee</Label>
                            {employeesLoading ? <Skeleton className="h-10 w-full" /> : (
                                <Select onValueChange={setSelectedEmployeeId} value={selectedEmployeeId || ''}>
                                    <SelectTrigger><SelectValue placeholder="Select an employee" /></SelectTrigger>
                                    <SelectContent>
                                        {employees?.map(emp => (
                                            <SelectItem key={emp.userId} value={emp.userId}>{emp.role} ({emp.employeeId})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>
                         <div className="space-y-2">
                             <Label>Date Range</Label>
                            <Popover>
                                <PopoverTrigger asChild>
                                <Button
                                    id="date"
                                    variant={"outline"}
                                    className={cn("w-full justify-start text-left font-normal", !dateRange && "text-muted-foreground")}
                                >
                                    <CalendarIcon className="mr-2 h-4 w-4" />
                                    {dateRange?.from ? (
                                    dateRange.to ? (
                                        `${format(dateRange.from, "LLL dd, y")} - ${format(dateRange.to, "LLL dd, y")}`
                                    ) : (
                                        format(dateRange.from, "LLL dd, y")
                                    )
                                    ) : (
                                    <span>Pick a date</span>
                                    )}
                                </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                    initialFocus
                                    mode="range"
                                    defaultMonth={dateRange?.from}
                                    selected={dateRange}
                                    onSelect={setDateRange}
                                    numberOfMonths={2}
                                />
                                </PopoverContent>
                            </Popover>
                         </div>
                    </div>

                    {selectedEmployeeId && (
                        <Card>
                            <CardHeader><CardTitle>Attendance Details</CardTitle></CardHeader>
                            <CardContent>
                                {attendanceLoading ? <p>Loading attendance...</p> : !reportData?.records || reportData.records.length === 0 ? (
                                    <p className="text-muted-foreground">No attendance records found for this period.</p>
                                ) : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Punch In</TableHead><TableHead>Punch Out</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {reportData.records.map(rec => (
                                                <TableRow key={rec.id}>
                                                    <TableCell>{format(new Date(rec.workDate), 'PPP')}</TableCell>
                                                    <TableCell>{rec.punchInTime ? format((rec.punchInTime as any).toDate(), 'p') : 'N/A'}</TableCell>
                                                    <TableCell>{rec.punchOutTime ? format((rec.punchOutTime as any).toDate(), 'p') : 'N/A'}</TableCell>
                                                    <TableCell className="text-right font-mono capitalize">{rec.status.replace('_', ' ')}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {reportData && reportData.baseSalary > 0 && (
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader><CardTitle>Salary Calculation</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between"><span>Total Hours Worked:</span><span className="font-bold">{reportData.totalHours.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span>Base Salary:</span><span className="font-bold">₹{reportData.baseSalary.toFixed(2)}</span></div>
                                <div className="flex justify-between text-lg font-bold text-primary border-t pt-2"><span>Net Payable:</span><span>₹{reportData.netPay.toFixed(2)}</span></div>
                            </CardContent>
                            <CardFooter>
                                <p className="text-xs text-muted-foreground">A salary slip for this period has been automatically saved.</p>
                            </CardFooter>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
