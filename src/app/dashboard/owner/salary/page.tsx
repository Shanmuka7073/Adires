
'use client';

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react';
import { useFirebase, useCollection, useDoc, useMemoFirebase, errorEmitter } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc, writeBatch, setDoc, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Store, EmployeeProfile, AttendanceRecord, SalarySlip, ReasonEntry, User } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarIcon, Loader2, FileText, CheckCircle, XCircle, Eye, Info, MessageSquare } from 'lucide-react';
import { format, startOfMonth, endOfMonth, getDaysInMonth, isSameDay, isPast, differenceInDays, startOfDay } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { generateSalarySlipDoc } from '@/lib/generateSalarySlipDoc';
import { getAdminServices } from '@/firebase/admin-init';


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

    const toDateSafe = (d: any): Date => d instanceof Timestamp ? d.toDate() : new Date(d);

    const handleApproval = async (record: AttendanceRecord, isApproved: boolean) => {
        if (!firestore || !storeId) return;

        let rejectionReason = "";
        if (!isApproved) {
            rejectionReason = prompt("Please provide a reason for rejection:") || "Rejected without reason.";
        }
        
        startUpdate(async () => {
            const newStatus = isApproved ? 'approved' : 'rejected';
            const recordRef = doc(firestore, `stores/${storeId}/attendance`, record.id);
            
            const lastReasonIndex = (record.reasonHistory?.length || 0) - 1;
            const updatedReasonHistory = record.reasonHistory ? [...record.reasonHistory] : [];

            if (lastReasonIndex >= 0) {
                updatedReasonHistory[lastReasonIndex] = {
                    ...updatedReasonHistory[lastReasonIndex],
                    status: newStatus,
                    rejectionReason: !isApproved ? rejectionReason : undefined,
                };
            }

            const updateData: Partial<AttendanceRecord> = { 
                status: newStatus,
                rejectionCount: newStatus === 'rejected' ? (record.rejectionCount || 0) + 1 : record.rejectionCount,
                reasonHistory: updatedReasonHistory,
            };

            if (isApproved) {
                updateData.workHours = record.workHours > 0 ? record.workHours : 8; // Grant 8 hours if it was a missed day
            } else {
                updateData.workHours = 0;
            }

            try {
              // Explicitly include identifiers to prevent issues if `updateData` is incomplete
              await updateDoc(recordRef, {
                  ...updateData
              });
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
                            <TableHead>Employee</TableHead>
                            <TableHead>Date</TableHead>
                            <TableHead>Reason</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {requests.map(req => (
                            <TableRow key={req.id}>
                                <TableCell className="font-mono">{req.employeeId.slice(0, 8)}...</TableCell>
                                <TableCell>{format(toDateSafe(req.workDate), 'PPP')}</TableCell>
                                <TableCell className="text-sm italic text-muted-foreground">{req.reasonHistory && req.reasonHistory.length > 0 ? req.reasonHistory[req.reasonHistory.length - 1].text : "No reason given"}</TableCell>
                                <TableCell className="text-right space-x-2">
                                    <Button size="sm" variant="ghost" onClick={() => handleApproval(req, false)} disabled={isUpdating}>
                                        <XCircle className="mr-2 h-4 w-4 text-destructive" /> Reject
                                    </Button>
                                    <Button size="sm" onClick={() => handleApproval(req, true)} disabled={isUpdating}>
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

function GeneratedSlipsList({ employee, myStore }: { employee: EmployeeProfile, myStore: Store }) {
    const { firestore } = useFirebase();
    
    const slipsQuery = useMemoFirebase(() => {
        if (!firestore || !myStore || !employee) return null;
        return query(
            collection(firestore, `stores/${myStore.id}/salarySlips`),
            where('employeeId', '==', employee.userId),
            orderBy('periodStart', 'desc')
        );
    }, [firestore, myStore, employee]);

    const { data: slips, isLoading } = useCollection<SalarySlip>(slipsQuery);

    return (
         <Card>
            <CardHeader>
                <CardTitle>Generated Salary Slips</CardTitle>
                <CardDescription>A list of all salary slips generated for {employee.role}.</CardDescription>
            </CardHeader>
            <CardContent>
                 {isLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </div>
                ) : slips && slips.length > 0 ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Pay Period</TableHead>
                                <TableHead>Net Pay</TableHead>
                                <TableHead className="text-right">Actions</TableHead>
                            </TableRow>
                        </TableHeader>
                         <TableBody>
                            {slips.map(slip => (
                                <TableRow key={slip.id}>
                                    <TableCell>{format(new Date(slip.periodStart), 'MMMM yyyy')}</TableCell>
                                    <TableCell className="font-bold">₹{slip.netPay.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Button asChild variant="outline" size="sm">
                                            <Link href={`/dashboard/salary-slip/${slip.id}`} target="_blank">
                                                <Eye className="mr-2 h-4 w-4" />
                                                View Slip
                                            </Link>
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                ) : (
                    <p className="text-muted-foreground text-center">No salary slips have been generated for this employee yet.</p>
                )}
            </CardContent>
        </Card>
    )
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
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[] | null>(null);
    const [attendanceLoading, setAttendanceLoading] = useState(false);

    const storeQuery = useMemoFirebase(() => (user ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid)) : null), [user, firestore]);
    const { data: stores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
    const myStore = useMemo(() => stores?.[0], [stores]);

    const employeesQuery = useMemoFirebase(() => (myStore ? query(collection(firestore, 'employeeProfiles'), where('storeId', '==', myStore.id)) : null), [myStore, firestore]);
    const { data: employees, isLoading: employeesLoading } = useCollection<EmployeeProfile>(employeesQuery);

    const selectedEmployee = useMemo(() => employees?.find(e => e.userId === selectedEmployeeId), [employees, selectedEmployeeId]);

    const fetchAttendance = useCallback(async () => {
        if (!myStore || !selectedEmployeeId || !dateRange?.from || !dateRange?.to || !firestore) {
            setAttendanceRecords([]);
            return;
        }
        setAttendanceLoading(true);
        try {
            const start = startOfDay(dateRange.from);
            const end = endOfMonth(dateRange.to); // Ensure we get the full month
            
            const startTimestamp = Timestamp.fromDate(start);
            const endTimestamp = Timestamp.fromDate(end);

            const q = query(
              collection(firestore, `stores/${myStore.id}/attendance`),
              where('employeeId', '==', selectedEmployeeId),
              where('workDate', '>=', startTimestamp),
              where('workDate', '<=', endTimestamp),
              orderBy('workDate', 'desc')
            );
            const querySnapshot = await getDocs(q);
            const records = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
            setAttendanceRecords(records);
        } catch (error) {
            console.error("ATTENDANCE FETCH FAILED (Owner)", { employeeId: selectedEmployeeId, storeId: myStore.id, error });
            toast({ variant: 'destructive', title: "Error", description: "Could not load attendance records. Check Firestore index and rules." });
            setAttendanceRecords(null);
        } finally {
            setAttendanceLoading(false);
        }
    }, [myStore, selectedEmployeeId, dateRange, firestore, toast]);

    useEffect(() => {
        if (selectedEmployeeId && dateRange?.from && dateRange?.to) {
            fetchAttendance();
        }
    }, [selectedEmployeeId, dateRange, fetchAttendance]);


    const reportData = useMemo(() => {
        if (!attendanceRecords || !selectedEmployee || !dateRange?.from || !dateRange.to) return null;

        const uniqueDates = new Set<string>();
        const presentOrApprovedRecords = attendanceRecords.filter(r => {
            const workDateStr = r.workDate instanceof Timestamp ? r.workDate.toDate().toISOString().split('T')[0] : new Date(r.workDate).toISOString().split('T')[0];
            const isCountable = (r.status === 'present' || r.status === 'approved' || r.status === 'partially_present');
            if (isCountable && !uniqueDates.has(workDateStr)) {
                uniqueDates.add(workDateStr);
                return true;
            }
            return false;
        });

        const partialDaysRecords = presentOrApprovedRecords.filter(r => r.status === 'partially_present');
        
        let totalHours = 0;
        let baseSalary = 0;
        
        const totalDaysInPeriod = differenceInDays(dateRange.to, dateRange.from) + 1;

        if (selectedEmployee.salaryType === 'monthly') {
            const daysInMonthOfSalary = getDaysInMonth(dateRange.from);
            const perDaySalary = selectedEmployee.salaryRate / daysInMonthOfSalary;
            const payableDays = presentOrApprovedRecords.reduce((acc, record) => {
                if (record.status === 'partially_present' && record.workHours > 0) {
                    return acc + (record.workHours / 8); 
                }
                return acc + 1;
            }, 0);
            baseSalary = perDaySalary * payableDays;
            totalHours = presentOrApprovedRecords.reduce((acc, record) => acc + (record.workHours || 8), 0);
        } else { // hourly
            totalHours = presentOrApprovedRecords.reduce((acc, record) => acc + (record.workHours || 0), 0);
            baseSalary = totalHours * selectedEmployee.salaryRate;
        }

        const netPay = baseSalary;

        return { 
            totalHours, 
            baseSalary, 
            netPay, 
            records: presentOrApprovedRecords,
            presentDays: uniqueDates.size,
            totalDays: totalDaysInPeriod,
            partialDays: partialDaysRecords.length,
            absentDays: totalDaysInPeriod - uniqueDates.size,
        };
    }, [attendanceRecords, selectedEmployee, dateRange]);

    const handleGenerateSlip = async () => {
        if (!myStore || !selectedEmployee || !reportData || !dateRange?.from || !dateRange.to) {
            toast({ variant: 'destructive', title: 'Cannot Generate', description: 'Missing required data.' });
            return;
        }
        if (reportData.baseSalary <= 0) {
            toast({ variant: 'destructive', title: 'Cannot Generate', description: 'Calculated salary is zero.' });
            return;
        }
        
        startGeneration(async () => {
            const slipId = `${myStore.id}_${selectedEmployee.userId}_${format(dateRange.from!, 'yyyy-MM')}`;
            const slipData: Omit<SalarySlip, 'id'|'generatedAt'> = {
                employeeId: selectedEmployee.userId, storeId: myStore.id,
                periodStart: dateRange.from!.toISOString(), periodEnd: dateRange.to!.toISOString(),
                baseSalary: reportData.baseSalary, overtimeHours: 0, overtimePay: 0,
                deductions: 0, netPay: reportData.netPay,
            };

            try {
                const slipRef = doc(firestore, `stores/${myStore.id}/salarySlips`, slipId);
                await setDoc(slipRef, { ...slipData, id: slipId, generatedAt: serverTimestamp() }, { merge: true });
                toast({ title: 'Salary Slip Stored!', description: `A slip for ${selectedEmployee.role} has been saved.` });
                
                // Fetch full user details for the doc generation
                const userDocRef = doc(firestore, 'users', selectedEmployee.userId);
                const userDoc = await getDoc(userDocRef);
                const userData = userDoc.data() as User;
                
                if (!userData) {
                    throw new Error("Could not find user details for DOCX generation.");
                }
                const fullEmployeeProfile = { ...userData, ...selectedEmployee };
                
                await generateSalarySlipDoc({
                    companyName: myStore.name,
                    payslipNo: `PSL-${slipId.slice(0,8)}`,
                    employeeName: `${fullEmployeeProfile.firstName} ${fullEmployeeProfile.lastName}`,
                    employeeId: fullEmployeeProfile.employeeId,
                    designation: fullEmployeeProfile.role,
                    payPeriod: format(dateRange.from!, 'MMMM yyyy'),
                    totalHours: reportData.totalHours,
                    baseSalary: reportData.baseSalary,
                    pf: 0, // Placeholder, can be calculated later
                    esi: 0, // Placeholder
                    netPay: reportData.netPay,
                });
            } catch (error: any) {
                console.error("Failed to generate salary slip:", error);
                toast({ variant: 'destructive', title: 'Error', description: error.message });
            }
        });
    };
    
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
                    {myStore && <ApprovalRequests storeId={myStore.id} />}
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
                        <>
                        {selectedEmployee && myStore && <GeneratedSlipsList employee={selectedEmployee} myStore={myStore} />}
                        <Card>
                            <CardHeader><CardTitle>Attendance Details for Period</CardTitle></CardHeader>
                            <CardContent>
                                {attendanceLoading ? <p>Loading attendance...</p> : !reportData?.records || reportData.records.length === 0 ? (
                                    <p className="text-muted-foreground">No attendance records found for this period.</p>
                                ) : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Punch In</TableHead><TableHead>Punch Out</TableHead><TableHead>Work Hours</TableHead><TableHead className="text-right">Status</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {reportData.records.map(rec => (
                                                <TableRow key={rec.id}>
                                                    <TableCell>{rec.workDate instanceof Timestamp ? format(rec.workDate.toDate(), 'PPP') : 'Invalid Date'}</TableCell>
                                                    <TableCell>{rec.punchInTime ? format(rec.punchInTime instanceof Timestamp ? rec.punchInTime.toDate() : new Date(rec.punchInTime), 'p') : '—'}</TableCell>
                                                    <TableCell>{rec.punchOutTime ? format(rec.punchOutTime instanceof Timestamp ? rec.punchOutTime.toDate() : new Date(rec.punchOutTime), 'p') : '—'}</TableCell>
                                                    <TableCell>{rec.workHours > 0 ? rec.workHours.toFixed(2) : '-'}</TableCell>
                                                    <TableCell className="text-right font-mono capitalize">{rec.status.replace(/_/g, ' ')}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                        </>
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
                                <Button className="w-full" onClick={handleGenerateSlip} disabled={isGenerating}>
                                    {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                                    Generate & Download Slip
                                </Button>
                            </CardFooter>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
