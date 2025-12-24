
'use client';

import { useEffect, useState, useMemo, useTransition } from 'react';
import { collection, query, where, addDoc, serverTimestamp, getDocs, orderBy, updateDoc, doc, limit } from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { format } from 'date-fns';
import type { AttendanceRecord, EmployeeProfile, Store } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

export default function EmployeeAttendancePage() {
  const { user, firestore, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, startProcessing] = useTransition();

  // 1. Fetch the employee's profile to get their storeId
  const employeeProfileRef = useMemoFirebase(() => (user ? doc(firestore, 'employeeProfiles', user.uid) : null), [user, firestore]);
  const { data: employeeProfile, isLoading: profileLoading } = useDoc<EmployeeProfile>(employeeProfileRef);

  const storeId = employeeProfile?.storeId;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // 2. Fetch attendance records for this employee using a secure query
  const attendanceQuery = useMemoFirebase(() => {
    if (!user || !storeId) return null;
    return query(
      collection(firestore, 'stores', storeId, 'attendance'),
      where('employeeId', '==', user.uid),
      orderBy('workDate', 'desc')
    );
  }, [user, storeId, firestore]);

  const { data: records, isLoading: recordsLoading, refetch: refetchAttendance } = useCollection<AttendanceRecord>(attendanceQuery);

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
                workHours: 0
            });
            toast({ title: 'Punched In!', description: 'Your shift has started.' });
            refetchAttendance(); // Manually trigger a refetch
        } catch(e) {
            console.error("Punch in failed: ", e);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not punch in.' });
        }
    });
  };

  const punchOut = async () => {
    if (!user || !storeId || !todaysRecord) return;

    startProcessing(async () => {
      const recordRef = doc(firestore, 'stores', storeId, 'attendance', todaysRecord.id);
      try {
        await updateDoc(recordRef, {
            punchOutTime: serverTimestamp()
        });
        toast({ title: 'Punched Out!', description: 'Your shift has ended.' });
        refetchAttendance(); // Manually trigger a refetch
      } catch (e) {
        console.error("Punch out failed: ", e);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not punch out.' });
      }
    });
  };

  const isLoading = isUserLoading || profileLoading || recordsLoading;

  if (isLoading) {
    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <Skeleton className="h-10 w-1/3" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-48 w-full" />
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold mb-2">Employee Attendance</CardTitle>
            <CardDescription>
                Punch in daily and track your monthly attendance.
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
                     {isProcessing && todaysRecord ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    Punch Out
                  </Button>
              </div>

              <div>
                <h2 className="text-lg font-semibold mb-4">This Month's Records</h2>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Punch In</TableHead>
                            <TableHead>Punch Out</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {records && records.length > 0 ? records.map(record => (
                            <TableRow key={record.id}>
                                <TableCell className="font-medium">{record.workDate}</TableCell>
                                <TableCell>
                                    {record.punchInTime ? format(record.punchInTime.toDate(), 'p') : '—'}
                                </TableCell>
                                <TableCell>
                                    {record.punchOutTime ? format(record.punchOutTime.toDate(), 'p') : '—'}
                                </TableCell>
                                <TableCell className="text-right">
                                     <Badge variant={record.status === 'present' || record.status === 'approved' ? 'default' : 'destructive'}>
                                        {record.status.replace('_', ' ')}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground">
                                    No attendance records found for this month.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
              </div>
          </CardContent>
      </Card>
    </div>
  );
}
