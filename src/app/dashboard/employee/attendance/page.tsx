
'use client';

import { useState, useEffect, useTransition, useMemo, useCallback } from 'react';
import { useFirebase, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { doc, collection, query, where, orderBy, addDoc, updateDoc, serverTimestamp, limit, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { AttendanceRecord, EmployeeProfile } from '@/lib/types';
import { Loader2, CheckCircle, Fingerprint, Calendar as CalendarIcon, HelpCircle, XCircle, Clock } from 'lucide-react';
import { format, isSameDay, startOfToday, eachDayOfInterval, startOfMonth, endOfMonth, isBefore } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { startAuthentication } from '@simplewebauthn/browser';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';


async function safeJson(resp: Response) {
    try {
        const text = await resp.text();
        return text ? JSON.parse(text) : {};
    } catch {
        return {};
    }
}

function CalendarDay({ day, record, onMissedPunch }: { day: Date, record?: AttendanceRecord, onMissedPunch: (date: Date) => void }) {
    const isToday = isSameDay(day, startOfToday());
    const isFuture = isBefore(startOfToday(), day);

    if (isFuture) {
      return <div className="p-2 text-center text-muted-foreground/50">{format(day, 'd')}</div>;
    }

    let status: 'present' | 'absent' | 'pending' | 'approved' | 'rejected' = 'absent';
    let label = 'Absent';
    let icon = <XCircle className="h-4 w-4" />;
    
    if (record) {
        if (record.status === 'pending_approval') {
            status = 'pending';
            label = 'Pending';
            icon = <Clock className="h-4 w-4" />;
        } else if (record.status === 'approved' || record.status === 'present') {
            status = 'present';
            label = 'Present';
            icon = <CheckCircle className="h-4 w-4" />;
        } else if (record.status === 'rejected') {
             status = 'rejected';
             label = 'Rejected';
             icon = <XCircle className="h-4 w-4" />;
        }
    }

    return (
        <button
            onClick={() => status === 'absent' && onMissedPunch(day)}
            disabled={status !== 'absent'}
            className={cn(
                "relative p-2 rounded-lg text-center border-2 transition-all",
                isToday && "ring-2 ring-primary ring-offset-2",
                (status === 'present' || status === 'approved') && "bg-green-100 border-green-200",
                status === 'pending' && "bg-yellow-100 border-yellow-200",
                (status === 'absent' || status === 'rejected') && "bg-red-100 border-red-200",
                status === 'absent' && "cursor-pointer hover:bg-red-200 hover:border-red-300"
            )}
        >
            <div className="font-bold text-lg">{format(day, 'd')}</div>
            <div className={cn("text-xs font-semibold flex items-center justify-center gap-1", 
                (status === 'present' || status === 'approved') && "text-green-700",
                status === 'pending' && "text-yellow-700",
                (status === 'absent' || status === 'rejected') && "text-red-700"
            )}>
                {icon} {label}
            </div>
             {status === 'absent' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-bold opacity-0 hover:opacity-100 transition-opacity">
                    Request
                </div>
            )}
        </button>
    );
}


export default function AttendancePage() {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, startProcessing] = useTransition();
  const [activePunchIn, setActivePunchIn] = useState<AttendanceRecord | null>(null);
  const [monthlyRecords, setMonthlyRecords] = useState<AttendanceRecord[]>([]);

  const employeeProfileRef = useMemoFirebase(() => (user ? doc(firestore, 'employeeProfiles', user.uid) : null), [user, firestore]);
  const { data: employeeProfile, isLoading: profileLoading } = useDoc<EmployeeProfile>(employeeProfileRef);
  
  const today = startOfToday();
  const daysInMonth = eachDayOfInterval({
    start: startOfMonth(today),
    end: endOfMonth(today),
  });

  const fetchRecords = useCallback(async () => {
    if (user && employeeProfile?.storeId) {
        const start = startOfMonth(today);
        const end = endOfMonth(today);

        const attendanceCollection = collection(firestore, `stores/${employeeProfile.storeId}/attendance`);
        const q = query(
            attendanceCollection,
            where('employeeId', '==', user.uid),
            where('workDate', '>=', format(start, 'yyyy-MM-dd')),
            where('workDate', '<=', format(end, 'yyyy-MM-dd'))
        );

        const snapshot = await getDocs(q);
        const records = snapshot.docs.map(d => ({ id: d.id, ...d.data() })) as AttendanceRecord[];
        setMonthlyRecords(records);
        
        const activeRecord = records.find(rec => isSameDay(new Date(rec.workDate), today) && !rec.punchOutTime && rec.status === 'present');
        setActivePunchIn(activeRecord || null);
    }
  }, [user, employeeProfile, firestore, today]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);
  
  const handleBiometricVerification = async (): Promise<boolean> => {
      if (!user?.email) {
          toast({ variant: 'destructive', title: 'Error', description: 'User email not found.' });
          return false;
      }
      try {
        const respOptions = await fetch('/api/auth/webauthn/generate-authentication-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email }),
        });
        const options = await safeJson(respOptions);
        if (!respOptions.ok) throw new Error(options.error || 'Could not get authentication options.');

        const assertion = await startAuthentication(options);

        const verificationResp = await fetch('/api/auth/webauthn/verify-authentication', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...assertion, email: user.email }),
        });
        const verificationJSON = await verificationResp.json();
        if (!verificationJSON.verified) throw new Error(verificationJSON.error || 'Biometric verification failed.');

        return true;
      } catch (error: any) {
          console.error('Biometric verification failed:', error);
          toast({ variant: 'destructive', title: 'Verification Failed', description: error.message || 'Could not verify your identity.' });
          return false;
      }
  };


  const handleMissedPunchRequest = async (date: Date) => {
    if (!user || !employeeProfile) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    if (monthlyRecords.some(r => r.workDate === dateStr)) {
        toast({ variant: 'destructive', title: 'Record already exists for this day.' });
        return;
    }
    
    startProcessing(async () => {
      if (!(await handleBiometricVerification())) {
        return;
      }

      const attendanceCollection = collection(firestore, `stores/${employeeProfile.storeId}/attendance`);
      const newRecord = {
          employeeId: user.uid,
          storeId: employeeProfile.storeId,
          workDate: dateStr,
          punchInTime: null,
          punchOutTime: null,
          workHours: 8, // Assume a full day for approved absence
          status: 'pending_approval' as const
      };

      try {
        await addDoc(attendanceCollection, newRecord);
        toast({ title: 'Request Sent', description: 'Your request for a missed punch-in has been sent to the owner.' });
        fetchRecords();
      } catch (error) {
        const permissionError = new FirestorePermissionError({
          path: attendanceCollection.path,
          operation: 'create',
          requestResourceData: newRecord
        });
        errorEmitter.emit('permission-error', permissionError);
      }
    });
  }

  const handlePunchIn = async () => {
    if (!user || !employeeProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'Employee profile not loaded.'});
        return;
    };

    startProcessing(async () => {
      if (!(await handleBiometricVerification())) {
        return;
      }

      const attendanceCollection = collection(firestore, `stores/${employeeProfile.storeId}/attendance`);
      const newRecordData = {
          employeeId: user.uid,
          storeId: employeeProfile.storeId,
          workDate: format(new Date(), 'yyyy-MM-dd'),
          punchInTime: serverTimestamp(),
          punchOutTime: null,
          workHours: 0,
          status: 'present' as 'present'
      };
      
      try {
        const newDocRef = await addDoc(attendanceCollection, newRecordData);
        const newRecordForState = { ...newRecordData, id: newDocRef.id, punchInTime: new Date() };
        setActivePunchIn(newRecordForState);
        setMonthlyRecords(prev => [...prev.filter(r => r.workDate !== newRecordData.workDate), newRecordForState]);
        toast({ title: 'Punched In!', description: 'Your shift has started.' });
      } catch (error) {
          const permissionError = new FirestorePermissionError({
            path: attendanceCollection.path,
            operation: 'create',
            requestResourceData: newRecordData,
          });
          errorEmitter.emit('permission-error', permissionError);
      }
    });
  };

  const handlePunchOut = async () => {
    if (!activePunchIn || !user || !employeeProfile) return;
    
    startProcessing(async () => {
      if (!(await handleBiometricVerification())) {
        return;
      }
      
      const punchInTime = (activePunchIn.punchInTime as any).toDate();
      const punchOutTime = new Date();
      const workHours = (punchOutTime.getTime() - punchInTime.getTime()) / (1000 * 60 * 60);
      const recordRef = doc(firestore, `stores/${employeeProfile.storeId}/attendance`, activePunchIn.id);
      const updateData = {
          punchOutTime: serverTimestamp(),
          workHours: parseFloat(workHours.toFixed(2))
      };

      try {
        await updateDoc(recordRef, updateData);
        
        toast({ title: 'Punched Out!', description: 'Your shift has ended.' });
        const updatedRecord = { ...activePunchIn, punchOutTime: punchOutTime, workHours: parseFloat(workHours.toFixed(2)) };
        setMonthlyRecords(prev => prev.map(r => r.id === activePunchIn.id ? updatedRecord : r));
        setActivePunchIn(null);
      } catch (error) {
          const permissionError = new FirestorePermissionError({
            path: recordRef.path,
            operation: 'update',
            requestResourceData: updateData,
          });
          errorEmitter.emit('permission-error', permissionError);
      }
    });
  };
  
  if (profileLoading) {
      return <div className="container mx-auto py-12"><Loader2 className="h-8 w-8 animate-spin mx-auto" /></div>
  }
  
  if (!employeeProfile) {
      return (
          <div className="container mx-auto py-12 px-4 md:px-6">
              <Alert>
                  <AlertTitle>No Employee Profile Found</AlertTitle>
                  <AlertDescription>
                      Your account is not linked to a store employee profile. Please contact your store owner to add you.
                  </AlertDescription>
                   <Button asChild className="mt-4"><Link href="/dashboard">Go to Dashboard</Link></Button>
              </Alert>
          </div>
      )
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <Card className="max-w-md mx-auto mb-8">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">Employee Attendance</CardTitle>
          <CardDescription>
            {activePunchIn 
                ? `You punched in at ${format((activePunchIn.punchInTime as any).toDate(), 'p')}`
                : 'Use biometrics to punch in for your shift.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {activePunchIn ? (
            <Button onClick={handlePunchOut} disabled={isProcessing} className="w-full" size="lg" variant="destructive">
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Punch Out
            </Button>
          ) : (
            <Button onClick={handlePunchIn} disabled={isProcessing} className="w-full" size="lg">
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Fingerprint className="mr-2 h-4 w-4" />}
              Punch In with Biometrics
            </Button>
          )}

           <Alert>
                <Fingerprint className="h-4 w-4" />
                <AlertTitle>How it works</AlertTitle>
                <AlertDescription>
                    This feature uses WebAuthn to verify your identity. Your biometric data never leaves your device.
                </AlertDescription>
            </Alert>
        </CardContent>
      </Card>
      
      <Card className="max-w-4xl mx-auto">
        <CardHeader>
            <CardTitle className="flex items-center gap-2"><CalendarIcon className="h-5 w-5" /> This Month's Attendance</CardTitle>
            <CardDescription>A complete log of your attendance for {format(today, 'MMMM yyyy')}. Click on an "Absent" day to request approval.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid grid-cols-7 gap-1 md:gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="font-bold text-center text-muted-foreground text-xs md:text-sm">{day}</div>
                ))}
                {daysInMonth.map(day => {
                    const record = monthlyRecords.find(r => isSameDay(new Date(r.workDate), day));
                    return <CalendarDay key={day.toString()} day={day} record={record} onMissedPunch={handleMissedPunchRequest} />
                })}
             </div>
        </CardContent>
      </Card>
    </div>
  );
}
