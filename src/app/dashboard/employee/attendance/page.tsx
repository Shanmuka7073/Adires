
'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { collection, query, where, addDoc, serverTimestamp, getDocs, orderBy, updateDoc, doc } from 'firebase/firestore';
import { useFirebase, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { format, differenceInHours, differenceInMinutes, startOfMonth, endOfMonth, isSameDay, isPast, isToday } from 'date-fns';
import type { AttendanceRecord, EmployeeProfile, Store } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Calendar as CalendarIcon, Check, Circle, CheckCircle, Info } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';


export default function EmployeeAttendancePage() {
  const { user, firestore, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, startProcessing] = useTransition();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  // 1. Fetch the employee's profile to get their storeId
  const employeeProfileRef = useMemoFirebase(() => (user ? doc(firestore, 'employeeProfiles', user.uid) : null), [user, firestore]);
  const { data: employeeProfile, isLoading: profileLoading } = useDoc<EmployeeProfile>(employeeProfileRef);

  const storeId = employeeProfile?.storeId;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 2. Fetch attendance records for this employee
  const attendanceQuery = useMemoFirebase(() => {
    if (!user || !storeId) return null;
    
    return query(
      collection(firestore, 'stores', storeId, 'attendance'),
      where('employeeId', '==', user.uid)
    );
  }, [user, storeId, firestore]);

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
            await addDoc(collection(firestore, `stores/${storeId}/attendance`), {
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
            setSelectedDate(undefined);
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
  
  const selectedRecord = useMemo(() => {
    if (!selectedDate || !records) return null;
    return records.find(r => isSameDay(new Date(r.workDate), selectedDate));
  }, [selectedDate, records]);

  const canRequestApproval = selectedDate && isPast(selectedDate) && !isToday(selectedDate) && !selectedRecord;

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold mb-2">Employee Attendance</CardTitle>
            <CardDescription>
                Punch in daily and track your monthly attendance. For missed days, click the date on the calendar to request approval.
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

              <div className="grid md:grid-cols-2 gap-8 items-start">
                 <div className="flex justify-center">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={setSelectedDate}
                        disabled={date => date > new Date()}
                        modifiers={{
                            present: date => records?.some(r => isSameDay(new Date(r.workDate), date) && r.status === 'present') || false,
                            approved: date => records?.some(r => isSameDay(new Date(r.workDate), date) && r.status === 'approved') || false,
                            pending: date => records?.some(r => isSameDay(new Date(r.workDate), date) && r.status === 'pending_approval') || false,
                            absent: date => records?.some(r => isSameDay(new Date(r.workDate), date) && r.status === 'absent') || false,
                            rejected: date => records?.some(r => isSameDay(new Date(r.workDate), date) && r.status === 'rejected') || false,
                        }}
                        modifiersClassNames={{
                            present: 'bg-green-100 text-green-800',
                            approved: 'bg-green-100 text-green-800',
                            pending: 'bg-yellow-100 text-yellow-800',
                            absent: 'bg-red-100 text-red-800',
                            rejected: 'bg-red-100 text-red-800',
                        }}
                        className="rounded-md border"
                    />
                 </div>
                 
                  <div className="p-4 rounded-lg bg-muted/50 h-full">
                    <h3 className="font-semibold text-lg mb-2">Details for {selectedDate ? format(selectedDate, "PPP") : "Today"}</h3>
                     {selectedRecord ? (
                        <div className="space-y-3">
                            <p><strong>Status:</strong> <Badge variant={selectedRecord.status === 'present' || selectedRecord.status === 'approved' ? 'default' : 'destructive'}>{selectedRecord.status.replace('_', ' ')}</Badge></p>
                            <p><strong>Punch In:</strong> {selectedRecord.punchInTime ? format((selectedRecord.punchInTime as any).toDate(), 'p') : '—'}</p>
                            <p><strong>Punch Out:</strong> {selectedRecord.punchOutTime ? format((selectedRecord.punchOutTime as any).toDate(), 'p') : '—'}</p>
                            <p><strong>Work Hours:</strong> {selectedRecord.workHours > 0 ? selectedRecord.workHours.toFixed(2) : '—'}</p>
                        </div>
                     ) : canRequestApproval ? (
                         <div className="space-y-3">
                            <Alert>
                               <Info className="h-4 w-4" />
                                <AlertTitle>Missed Punch-in?</AlertTitle>
                                <AlertDescription>You did not record attendance for this day.</AlertDescription>
                            </Alert>
                             <Button onClick={() => requestApproval(selectedDate!)} disabled={isProcessing} className="w-full">
                                Request Approval for this Day
                             </Button>
                         </div>
                     ) : (
                        <p className="text-sm text-muted-foreground mt-4">No record for this day.</p>
                     )}
                 </div>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
