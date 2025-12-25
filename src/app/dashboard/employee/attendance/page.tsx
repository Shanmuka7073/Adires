
'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { collection, query, where, addDoc, serverTimestamp, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useDoc, errorEmitter, FirestorePermissionError } from '@/firebase';
import { format, differenceInHours, differenceInMinutes, startOfMonth, endOfMonth, isSameDay } from 'date-fns';
import type { AttendanceRecord, EmployeeProfile, Store } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Calendar as CalendarIcon, Check, Circle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export default function EmployeeAttendancePage() {
  const { user, firestore, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, startProcessing] = useTransition();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  // 1. Fetch the employee's profile to get their storeId
  const employeeProfileRef = useMemoFirebase(() => (user ? doc(firestore, 'employeeProfiles', user.uid) : null), [user, firestore]);
  const { data: employeeProfile, isLoading: profileLoading } = useDoc<EmployeeProfile>(employeeProfileRef);

  const storeId = employeeProfile?.storeId;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 2. Fetch attendance records for this employee for the current month
  const attendanceQuery = useMemoFirebase(() => {
    if (!user || !storeId) return null;
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    
    return query(
      collection(firestore, 'stores', storeId, 'attendance'),
      where('employeeId', '==', user.uid),
      where('workDate', '>=', format(start, 'yyyy-MM-dd')),
      where('workDate', '<=', format(end, 'yyyy-MM-dd'))
    );
  }, [user, storeId, firestore, currentMonth]);

  const { data: records, isLoading: recordsLoading, refetch } = useCollection<AttendanceRecord>(attendanceQuery);

  const todaysRecord = useMemo(() => {
    return records?.find(record => record.workDate === todayStr);
  }, [records, todayStr]);

  const punchIn = async () => {
    if (!user || !storeId) return;

    startProcessing(async () => {
        try {
            await addDoc(collection(firestore, 'stores', storeId, 'attendance'), {
                employeeId: user.uid,
                storeId,
                workDate: todayStr,
                punchInTime: serverTimestamp(),
                punchOutTime: null,
                status: 'present',
                workHours: 0,
            });
            if (refetch) refetch();
            toast({ title: 'Punched In!', description: 'Your shift has started.' });
        } catch(e: any) {
            const permissionError = new FirestorePermissionError({ path: `stores/${storeId}/attendance`, operation: 'create', requestResourceData: { employeeId: user.uid } });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not punch in.' });
        }
    });
  };

  const punchOut = async () => {
    if (!user || !storeId || !todaysRecord || !todaysRecord.punchInTime) return;

    startProcessing(async () => {
      const recordRef = doc(firestore, 'stores', storeId, 'attendance', todaysRecord.id);
      
      const punchInTime = (todaysRecord.punchInTime as any).toDate ? (todaysRecord.punchInTime as any).toDate() : new Date(todaysRecord.punchInTime);
      const punchOutTime = new Date();
      const hours = differenceInHours(punchOutTime, punchInTime);
      const minutes = (differenceInMinutes(punchOutTime, punchInTime) % 60) / 60;
      const workHours = parseFloat((hours + minutes).toFixed(2));
      
      try {
        await updateDoc(recordRef, {
            punchOutTime: serverTimestamp(),
            workHours: workHours
        });
        if (refetch) refetch();
        toast({ title: 'Punched Out!', description: 'Your shift has ended.' });
      } catch (e) {
        const permissionError = new FirestorePermissionError({ path: recordRef.path, operation: 'update', requestResourceData: { workHours } });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not punch out.' });
      }
    });
  };

  const requestApproval = (date: Date) => {
    if (!user || !storeId) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    
    startProcessing(async() => {
        try {
            await addDoc(collection(firestore, 'stores', storeId, 'attendance'), {
                employeeId: user.uid,
                storeId,
                workDate: dateStr,
                punchInTime: null,
                punchOutTime: null,
                status: 'pending_approval',
                workHours: 0,
            });
            if (refetch) refetch();
            toast({ title: 'Request Sent', description: 'Your manager has been notified to approve your attendance for ' + dateStr });
        } catch(e) {
            toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send the approval request.' });
        }
    });
  }

  const isLoading = isUserLoading || profileLoading;

  if (isLoading) {
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-64 w-full" />
        </div>
    );
  }
  
  if (!employeeProfile) {
    return (
        <div className="p-6 max-w-4xl mx-auto">
            <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Profile Not Found</AlertTitle>
                <AlertDescription>Your user account is not configured as an employee. Please contact your store owner.</AlertDescription>
            </Alert>
        </div>
    );
  }

  const DayWithStatus = ({ date }: { date: Date }) => {
    const record = records?.find(r => isSameDay(new Date(r.workDate), date));
    const status = record?.status;

    let statusIndicator = null;
    let tooltipContent = format(date, "PPP");
    
    if (status === 'present' || status === 'approved') {
      statusIndicator = <Circle className="h-2 w-2 text-green-500 fill-green-500" />;
      tooltipContent = `Present. In: ${record?.punchInTime ? format((record.punchInTime as any).toDate(), 'p') : 'N/A'}, Out: ${record?.punchOutTime ? format((record.punchOutTime as any).toDate(), 'p') : 'N/A'}`;
    } else if (status === 'pending_approval') {
      statusIndicator = <Circle className="h-2 w-2 text-yellow-500 fill-yellow-500" />;
      tooltipContent = "Pending Approval";
    } else if (status === 'rejected' || status === 'absent') {
      statusIndicator = <Circle className="h-2 w-2 text-red-500 fill-red-500" />;
       tooltipContent = "Absent";
    }

    // Missed punch-in for past days
    const isPast = date < new Date() && !isSameDay(date, new Date());
    const showRequestButton = isPast && !record;

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="relative">
                {statusIndicator && <div className="absolute top-1 right-1">{statusIndicator}</div>}
                 {showRequestButton ? (
                    <Button variant="ghost" size="sm" className="h-auto w-full text-xs text-blue-600" onClick={() => requestApproval(date)}>
                        Request
                    </Button>
                ) : (
                    format(date, 'd')
                )}
            </div>
          </TooltipTrigger>
          <TooltipContent><p>{tooltipContent}</p></TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };
  
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold mb-2">Employee Attendance</CardTitle>
            <CardDescription>
                Punch in daily and track your monthly attendance. For missed days, click "Request" on the calendar date.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={punchIn}
                    disabled={!!todaysRecord || isProcessing}
                    size="lg"
                    className="bg-green-600 hover:bg-green-700"
                  >
                    {isProcessing && !todaysRecord ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Punch In for {todayStr}
                  </Button>
                   <Button
                    onClick={punchOut}
                    disabled={!todaysRecord || !!todaysRecord.punchOutTime || isProcessing}
                    size="lg"
                    variant="destructive"
                  >
                     {isProcessing && todaysRecord && !todaysRecord.punchOutTime ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Punch Out
                  </Button>
              </div>

              <div className="flex justify-center">
                  <Calendar
                    mode="single"
                    month={currentMonth}
                    onMonthChange={setCurrentMonth}
                    components={{
                        Day: ({ date }) => <DayWithStatus date={date} />,
                    }}
                    className="rounded-md border"
                    />
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4">This Month's Records</h2>
                 {recordsLoading ? (
                    <div className="space-y-2">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Punch In</TableHead>
                                <TableHead>Punch Out</TableHead>
                                <TableHead>Work Hours</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {records && records.length > 0 ? records.map(record => (
                                <TableRow key={record.id}>
                                    <TableCell className="font-medium">{record.workDate}</TableCell>
                                    <TableCell>
                                        {record.punchInTime ? format((record.punchInTime as any).toDate ? (record.punchInTime as any).toDate() : new Date(record.punchInTime), 'p') : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {record.punchOutTime ? format((record.punchOutTime as any).toDate ? (record.punchOutTime as any).toDate() : new Date(record.punchOutTime), 'p') : '—'}
                                    </TableCell>
                                    <TableCell>
                                        {record.workHours > 0 ? record.workHours.toFixed(2) : '—'}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={(record.status === 'present' || record.status === 'approved') ? 'default' : record.status === 'pending_approval' ? 'secondary' : 'destructive'}>
                                            {record.status.replace('_', ' ')}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                                        No attendance records found for this month.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                )}
              </div>
          </CardContent>
      </Card>
    </div>
  );
}

