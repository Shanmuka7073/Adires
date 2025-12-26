
'use client';

import { useState, useMemo, useTransition, useCallback, useEffect } from 'react';
import { useFirebase, useCollection, useDoc, useMemoFirebase, errorEmitter } from '@/firebase';
import { collection, query, where, addDoc, serverTimestamp, doc, updateDoc, writeBatch, setDoc, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import type { Store, EmployeeProfile, AttendanceRecord, SalarySlip, ReasonEntry } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar as CalendarIcon, Loader2, FileText, CheckCircle, XCircle, Eye, Info, MessageSquare } from 'lucide-react';
import { format, startOfMonth, endOfMonth, getDaysInMonth, isSameDay, isPast, isToday, differenceInMinutes, differenceInDays } from 'date-fns';
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
                                <TableCell>{format(new Date(req.workDate), 'PPP')}</TableCell>
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

function generatePayslipHtml(slip: SalarySlip, employee: EmployeeProfile, store: Store, attendance: any) {
    const gross = slip.baseSalary + slip.overtimePay;
    const totalDeduction = slip.deductions;
    const netPay = slip.netPay;

    function numberToWords(num: number): string {
        const a = ['','one ','two ','three ','four ', 'five ','six ','seven ','eight ','nine ','ten ','eleven ','twelve ','thirteen ','fourteen ','fifteen ','sixteen ','seventeen ','eighteen ','nineteen '];
        const b = ['', '', 'twenty','thirty','forty','fifty', 'sixty','seventy','eighty','ninety'];

        function inWords(n: number): string {
            let str = '';
            if (n > 99) {
                str += a[Math.floor(n / 100)] + 'hundred ';
                n %= 100;
            }
            if (n > 19) {
                str += b[Math.floor(n / 10)] + ' ' + a[n % 10];
            } else {
                str += a[n];
            }
            return str.trim();
        }

        if (num === 0) return 'Zero';
        let words = '';
        const crore = Math.floor(num / 10000000);
        if (crore > 0) {
            words += inWords(crore) + ' Crore ';
            num %= 10000000;
        }
        const lakh = Math.floor(num / 100000);
        if (lakh > 0) {
            words += inWords(lakh) + ' Lakh ';
            num %= 100000;
        }
        const thousand = Math.floor(num / 1000);
        if (thousand > 0) {
            words += inWords(thousand) + ' Thousand ';
            num %= 1000;
        }
        if (num > 0) {
            words += inWords(num);
        }
        return words.trim().split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
    }

    const netPayInWords = () => {
        const rupees = Math.floor(netPay);
        const paise = Math.round((netPay - rupees) * 100);
        let words = numberToWords(rupees) + ' Rupees';
        if (paise > 0) {
            words += ' and ' + numberToWords(paise) + ' Paise';
        }
        return words + ' Only';
    }
    
    let paymentDetailsHtml = `<p><b>Payment Mode:</b> ${employee.payoutMethod === 'upi' ? 'UPI' : 'Bank Transfer'}</p>`;
    if (employee.payoutMethod === 'upi' && employee.upiId) {
        paymentDetailsHtml += `<p><b>UPI ID:</b> ${employee.upiId}</p>`;
    } else if (employee.payoutMethod === 'bank' && employee.bankDetails) {
        paymentDetailsHtml += `
            <p><b>A/C Holder:</b> ${employee.bankDetails.accountHolderName}</p>
            <p><b>A/C No:</b> ${employee.bankDetails.accountNumber}</p>
            <p><b>IFSC:</b> ${employee.bankDetails.ifscCode || 'N/A'}</p>
        `;
    }

    return `
      <html>
        <head><meta charset='utf-8'><title>Salary Slip for ${format(new Date(slip.periodStart), 'MMMM yyyy')}</title></head>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px; font-size: 14px;">
          <div style="width: 800px; margin: auto; padding: 20px; border: 1px solid #eee; box-shadow: 0 0 10px rgba(0,0,0,0.1);">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 10px; margin-bottom: 20px;">
              <div>
                <h1 style="font-size: 24px; font-weight: bold; margin: 0;">${store.name}</h1>
                <p style="font-size: 12px; color: #666; margin: 5px 0 0;">${store.address}</p>
              </div>
              <div style="text-align: right;">
                <h2 style="font-size: 20px; font-weight: 600; margin: 0;">Salary Slip</h2>
                <p style="font-size: 12px; margin: 5px 0 0;">For the Month of ${format(new Date(slip.periodStart), 'MMMM yyyy')}</p>
                 <p style="font-size: 12px; margin: 5px 0 0;">Payslip No: ${slip.id.toUpperCase().slice(0, 15)}</p>
                 <p style="font-size: 12px; margin: 5px 0 0;">Generated On: ${format(new Date(), 'dd MMM yyyy')}</p>
              </div>
            </div>
            <table style="width: 100%; margin-bottom: 20px; font-size: 14px;">
              <tr>
                <td style="padding: 5px; vertical-align: top;"><b>Employee Name:</b> ${employee.firstName} ${employee.lastName}</td>
                <td style="padding: 5px; vertical-align: top;"><b>Employee ID:</b> ${employee.employeeId}</td>
              </tr>
              <tr>
                <td style="padding: 5px; vertical-align: top;"><b>Designation:</b> ${employee.role}</td>
                <td style="padding: 5px; vertical-align: top;"><b>Date of Joining:</b> ${format(new Date(employee.hireDate), 'dd MMM yyyy')}</td>
              </tr>
               <tr>
                <td style="padding: 5px;" colspan="2">
                   ${paymentDetailsHtml}
                </td>
              </tr>
            </table>
            <div style="display: flex; justify-content: space-between; text-align: center; margin-bottom: 20px; font-size: 12px; background: #f9f9f9; padding: 10px; border-radius: 5px;">
                <div><b>Total Days in Month:</b> ${attendance.totalDays}</div>
                <div><b>Present Days:</b> ${attendance.presentDays}</div>
                <div><b>Partial Days:</b> ${attendance.partialDays}</div>
                <div><b>Absent/Rejected:</b> ${attendance.absentDays}</div>
            </div>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 14px;">
              <tr style="background-color: #f2f2f2;">
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Earnings</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount (₹)</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: left;">Deductions</th>
                <th style="border: 1px solid #ddd; padding: 8px; text-align: right;">Amount (₹)</th>
              </tr>
              <tr>
                <td style="border: 1px solid #ddd; padding: 8px;">Base Salary (${attendance.presentDays} payable days)</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${slip.baseSalary.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">Standard Deductions</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${slip.deductions.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
              <tr style="font-weight: bold;">
                <td style="border: 1px solid #ddd; padding: 8px;">Gross Earnings</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${gross.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                <td style="border: 1px solid #ddd; padding: 8px;">Total Deductions</td>
                <td style="border: 1px solid #ddd; padding: 8px; text-align: right;">${totalDeduction.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
              </tr>
            </table>
            <div style="text-align: right; font-size: 18px; font-weight: bold; margin-top: 20px;">
              Net Pay: ₹ ${netPay.toLocaleString('en-IN', {minimumFractionDigits: 2, maximumFractionDigits: 2})}
            </div>
            <div style="margin-top: 10px; font-size: 14px;">
              <p><b>Amount in Words:</b> ${netPayInWords()}</p>
            </div>
            <div style="margin-top: 50px; font-size: 12px; color: #666; display: flex; justify-content: space-between;">
              <p><i>This is a system-generated payslip.</i></p>
              <p><b>Authorized Signatory</b></p>
            </div>
          </div>
        </body>
      </html>
    `;
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
            const q = query(
                collection(firestore, 'stores', myStore.id, 'attendance'),
                where('employeeId', '==', selectedEmployeeId),
                where('workDate', '>=', format(dateRange.from, 'yyyy-MM-dd')),
                where('workDate', '<=', format(dateRange.to, 'yyyy-MM-dd')),
                orderBy('workDate', 'desc')
            );
            const querySnapshot = await getDocs(q);
            const records = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as AttendanceRecord));
            setAttendanceRecords(records);
        } catch (error) {
            console.error("Failed to fetch attendance:", error);
            toast({ variant: 'destructive', title: "Error", description: "Could not load attendance records." });
            setAttendanceRecords(null);
        } finally {
            setAttendanceLoading(false);
        }
    }, [myStore, selectedEmployeeId, dateRange, firestore, toast]);

    useEffect(() => {
        if (selectedEmployeeId) {
            fetchAttendance();
        }
    }, [selectedEmployeeId, dateRange, fetchAttendance]);


    const reportData = useMemo(() => {
        if (!attendanceRecords || !selectedEmployee || !dateRange?.from || !dateRange.to) return null;

        const presentOrApprovedRecords = attendanceRecords.filter(r => r.status === 'present' || r.status === 'approved' || r.status === 'partially_present');
        const partialDaysRecords = attendanceRecords.filter(r => r.status === 'partially_present');
        
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
            records: attendanceRecords, 
            presentDays: presentOrApprovedRecords.length,
            totalDays: totalDaysInPeriod,
            partialDays: partialDaysRecords.length,
            absentDays: totalDaysInPeriod - presentOrApprovedRecords.length,
        };
    }, [attendanceRecords, selectedEmployee, dateRange]);

    const handleGenerateSlip = async () => {
        if (!myStore || !selectedEmployee || !reportData || !dateRange?.from || !dateRange?.to || !firestore) {
            toast({ variant: 'destructive', title: 'Cannot Generate', description: 'Missing required data.' });
            return;
        }
        if (reportData.baseSalary <= 0) {
            toast({ variant: 'destructive', title: 'Cannot Generate', description: 'Calculated salary is zero.' });
            return;
        }
        
        startGeneration(async () => {
            const slipId = `${myStore.id}_${selectedEmployee.userId}_${format(dateRange.from!, 'yyyy-MM')}`;
            const slipRef = doc(firestore, `stores/${myStore.id}/salarySlips`, slipId);
            const slipData: Omit<SalarySlip, 'id'|'generatedAt'> = {
                employeeId: selectedEmployee.userId,
                storeId: myStore.id,
                periodStart: dateRange.from!.toISOString(),
                periodEnd: dateRange.to!.toISOString(),
                baseSalary: reportData.baseSalary,
                overtimeHours: 0,
                overtimePay: 0,
                deductions: 0,
                netPay: reportData.netPay,
            };

            try {
                // First, save the data to Firestore.
                await setDoc(slipRef, { ...slipData, id: slipId, generatedAt: serverTimestamp() }, { merge: true });

                // Construct the full object for HTML generation *on the client*
                 const fullSlipForDownload: SalarySlip = {
                    ...slipData,
                    id: slipId,
                    generatedAt: new Date() as any,
                };
                
                // Now generate HTML from local data
                const htmlContent = generatePayslipHtml(fullSlipForDownload, selectedEmployee, myStore, reportData);
                const blob = new Blob([htmlContent], { type: 'application/msword' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = `Salary_Slip_${selectedEmployee.employeeId}_${format(new Date(fullSlipForDownload.periodStart), 'MMM_yyyy')}.doc`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                toast({ title: 'Salary Slip Generated & Downloaded!', description: `A slip for ${selectedEmployee.role} for ${format(dateRange.from!, 'MMMM yyyy')} has been generated.` });

            } catch (error: any) {
                console.error("Failed to generate or download salary slip:", error);
                 const permissionError = new FirestorePermissionError({
                    path: slipRef.path,
                    operation: 'write',
                    requestResourceData: slipData,
                });
                errorEmitter.emit('permission-error', permissionError);
                toast({ variant: 'destructive', title: 'Error', description: error.message });
            }
        });
    };
    
    if (storeLoading) return <div className="container mx-auto py-12">Loading store information...</div>
    if (!myStore) return <div className="container mx-auto py-12">You must have a store to access this page.</div>

    const formatDateSafe = (date: any) => {
        if (!date) return 'N/A';
        const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        return format(jsDate, 'p');
    }

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
                        <>
                        <GeneratedSlipsList employee={selectedEmployee!} myStore={myStore} />
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
                                                    <TableCell>{format(new Date(rec.workDate), 'PPP')}</TableCell>
                                                    <TableCell>{formatDateSafe(rec.punchInTime)}</TableCell>
                                                    <TableCell>{formatDateSafe(rec.punchOutTime)}</TableCell>
                                                    <TableCell>{rec.workHours > 0 ? rec.workHours.toFixed(2) : '-'}</TableCell>
                                                    <TableCell className="text-right font-mono capitalize">{rec.status.replace('_', ' ')}</TableCell>
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

    