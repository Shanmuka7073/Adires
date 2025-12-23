
'use client';

import { useState, useMemo, useTransition } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, addDoc, serverTimestamp } from 'firebase/firestore';
import type { Store, EmployeeProfile, AttendanceRecord, SalarySlip } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarIcon, Loader2, FileText } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { DateRange } from 'react-day-picker';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

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
            where('punchInTime', '>=', dateRange.from),
            where('punchInTime', '<=', dateRange.to),
            orderBy('punchInTime', 'desc')
        );
    }, [myStore, selectedEmployeeId, dateRange]);
    const { data: attendanceRecords, isLoading: attendanceLoading } = useCollection<AttendanceRecord>(attendanceQuery);

    const selectedEmployee = useMemo(() => employees?.find(e => e.userId === selectedEmployeeId), [employees, selectedEmployeeId]);

    const reportData = useMemo(() => {
        if (!attendanceRecords || !selectedEmployee) return null;

        const totalHours = attendanceRecords.reduce((acc, record) => acc + (record.workHours || 0), 0);
        let baseSalary = 0;
        if (selectedEmployee.salaryType === 'monthly') {
            baseSalary = selectedEmployee.salaryRate;
        } else {
            baseSalary = totalHours * selectedEmployee.salaryRate;
        }

        // Overtime/deductions logic can be added here in the future
        const netPay = baseSalary;

        return { totalHours, baseSalary, netPay };
    }, [attendanceRecords, selectedEmployee]);

    const handleGenerateSlip = async () => {
        if (!myStore || !selectedEmployee || !reportData || !dateRange?.from || !dateRange?.to) {
            toast({ variant: 'destructive', title: 'Missing Information', description: 'Please select an employee and a date range with records.' });
            return;
        }

        startGeneration(async () => {
            const slipData: Omit<SalarySlip, 'id'> = {
                employeeId: selectedEmployee.userId,
                storeId: myStore.id,
                periodStart: format(dateRange.from!, 'yyyy-MM-dd'),
                periodEnd: format(dateRange.to!, 'yyyy-MM-dd'),
                baseSalary: reportData.baseSalary,
                overtimeHours: 0,
                overtimePay: 0,
                deductions: 0,
                netPay: reportData.netPay,
                generatedAt: serverTimestamp(),
            };

            try {
                await addDoc(collection(firestore, `stores/${myStore.id}/salarySlips`), slipData);
                toast({ title: 'Salary Slip Generated!', description: `A salary slip for ${selectedEmployee.role} has been saved.` });
            } catch (error) {
                console.error("Failed to generate salary slip:", error);
                toast({ variant: 'destructive', title: 'Generation Failed', description: 'Could not save the salary slip.' });
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
                                {attendanceLoading ? <p>Loading attendance...</p> : !attendanceRecords || attendanceRecords.length === 0 ? (
                                    <p className="text-muted-foreground">No attendance records found for this period.</p>
                                ) : (
                                    <Table>
                                        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Punch In</TableHead><TableHead>Punch Out</TableHead><TableHead className="text-right">Work Hours</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {attendanceRecords.map(rec => (
                                                <TableRow key={rec.id}>
                                                    <TableCell>{format((rec.workDate as any).toDate(), 'PPP')}</TableCell>
                                                    <TableCell>{format((rec.punchInTime as any).toDate(), 'p')}</TableCell>
                                                    <TableCell>{rec.punchOutTime ? format((rec.punchOutTime as any).toDate(), 'p') : 'N/A'}</TableCell>
                                                    <TableCell className="text-right font-mono">{rec.workHours?.toFixed(2) || 'N/A'}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {reportData && (
                        <Card className="bg-primary/5 border-primary/20">
                            <CardHeader><CardTitle>Salary Calculation</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                                <div className="flex justify-between"><span>Total Hours Worked:</span><span className="font-bold">{reportData.totalHours.toFixed(2)}</span></div>
                                <div className="flex justify-between"><span>Base Salary:</span><span className="font-bold">₹{reportData.baseSalary.toFixed(2)}</span></div>
                                <div className="flex justify-between text-lg font-bold text-primary border-t pt-2"><span>Net Payable:</span><span>₹{reportData.netPay.toFixed(2)}</span></div>
                            </CardContent>
                            <CardFooter>
                                <Button onClick={handleGenerateSlip} disabled={isGenerating} className="w-full">
                                    {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    Generate & Save Salary Slip
                                </Button>
                            </CardFooter>
                        </Card>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
