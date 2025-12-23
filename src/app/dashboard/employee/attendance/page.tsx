
'use client';

import { useState, useEffect, useTransition, useMemo } from 'react';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, addDoc, updateDoc, serverTimestamp, limit, startOfMonth, endOfMonth, getDocs } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { AttendanceRecord, EmployeeProfile } from '@/lib/types';
import { Loader2, CheckCircle, Fingerprint, Calendar as CalendarIcon, HelpCircle, XCircle, Clock } from 'lucide-react';
import { format, isSameDay, startOfToday, eachDayOfInterval } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { startAuthentication } from '@simplewebauthn/browser';
import { cn } from '@/lib/utils';

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
    let status: 'present' | 'absent' | 'pending' | 'approved' = 'absent';
    let label = 'Absent';
    let icon = <XCircle className="h-4 w-4" />;

    if (record) {
        if (record.status === 'pending_approval') {
            status = 'pending';
            label = 'Pending';
            icon = <Clock className="h-4 w-4" />;
        } else {
            status = 'present';
            label = 'Present';
            icon = <CheckCircle className="h-4 w-4" />;
        }
    }
    
    const dayOfMonth = format(day, 'd');

    return (
        <div className={cn(
            "relative p-2 rounded-lg text-center border-2",
            isToday && "ring-2 ring-primary ring-offset-2",
            status === 'present' && "bg-green-100 border-green-200",
            status === 'pending' && "bg-yellow-100 border-yellow-200",
            status === 'absent' && "bg-red-100 border-red-200"
        )}>
            <div className="font-bold text-lg">{dayOfMonth}</div>
            <div className={cn("text-xs font-semibold flex items-center justify-center gap-1", 
                status === 'present' && "text-green-700",
                status === 'pending' && "text-yellow-700",
                status === 'absent' && "text-red-700"
            )}>
                {icon} {label}
            </div>
            {status === 'absent' && (
                <Button size="xs" variant="outline" className="mt-2 h-6 px-2 text-xs" onClick={() => onMissedPunch(day)}>
                    Request
                </Button>
            )}
        </div>
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

  useEffect(() => {
    if (user && employeeProfile?.storeId) {
        const fetchRecords = async () => {
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
            
            const activeRecord = records.find(rec => isSameDay(new Date(rec.workDate), today) && rec.punchOutTime === null && rec.status === 'present');
            setActivePunchIn(activeRecord || null);
        };
        fetchRecords();
    }
  }, [user, employeeProfile, firestore]);

  const handleMissedPunchRequest = async (date: Date) => {
    if (!user || !employeeProfile) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    if (monthlyRecords.some(r => r.workDate === dateStr)) {
        toast({ variant: 'destructive', title: 'Record already exists for this day.' });
        return;
    }
    
    startProcessing(async () => {
      try {
        await addDoc(collection(firestore, `stores/${employeeProfile.storeId}/attendance`), {
            employeeId: user.uid,
            storeId: employeeProfile.storeId,
            workDate: dateStr,
            punchInTime: null,
            punchOutTime: null,
            workHours: 8, // Assume a full day for approved absence
            status: 'pending_approval'
        });
        toast({ title: 'Request Sent', description: 'Your request for a missed punch-in has been sent to the owner.' });
        // Refetch records
        const newRecord = { id: 'temp', employeeId: user.uid, storeId: employeeProfile.storeId, workDate: dateStr, status: 'pending_approval', punchInTime: null, punchOutTime: null, workHours: 8 };
        setMonthlyRecords(prev => [...prev, newRecord]);

      } catch (error: any) {
        toast({ variant: 'destructive', title: 'Request Failed', description: error.message });
      }
    });
  }

  const handlePunchIn = async () => {
    if (!user || !employeeProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'Employee profile not loaded.'});
        return;
    };

    startProcessing(async () => {
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

        const newRecordData = {
            employeeId: user.uid,
            storeId: employeeProfile.storeId,
            workDate: format(new Date(), 'yyyy-MM-dd'),
            punchInTime: serverTimestamp(),
            punchOutTime: null,
            workHours: 0,
            status: 'present' as 'present'
        };
        const newDoc = await addDoc(collection(firestore, `stores/${employeeProfile.storeId}/attendance`), newRecordData);
        setActivePunchIn({ ...newRecordData, id: newDoc.id, punchInTime: new Date() });
        setMonthlyRecords(prev => [...prev.filter(r => r.workDate !== newRecordData.workDate), { ...newRecordData, id: newDoc.id, punchInTime: new Date() }]);
        
        toast({ title: 'Punched In!', description: 'Your shift has started.' });

      } catch (error: any) {
        console.error('Punch-in failed:', error);
        toast({ variant: 'destructive', title: 'Punch-in Failed', description: error.message || 'Could not save your attendance record.' });
      }
    });
  };

  const handlePunchOut = async () => {
    if (!activePunchIn || !user || !employeeProfile) return;
    
    startProcessing(async () => {
        try {
            const punchInTime = (activePunchIn.punchInTime as any).toDate();
            const punchOutTime = new Date();
            const workHours = (punchOutTime.getTime() - punchInTime.getTime()) / (1000 * 60 * 60);

            await updateDoc(doc(firestore, `stores/${employeeProfile.storeId}/attendance`, activePunchIn.id), {
                punchOutTime: serverTimestamp(),
                workHours: parseFloat(workHours.toFixed(2))
            });
            
            toast({ title: 'Punched Out!', description: 'Your shift has ended.' });
            const updatedRecord = { ...activePunchIn, punchOutTime: punchOutTime, workHours: parseFloat(workHours.toFixed(2)) };
            setMonthlyRecords(prev => prev.map(r => r.id === activePunchIn.id ? updatedRecord : r));
            setActivePunchIn(null);
        } catch (error) {
            console.error('Punch-out failed:', error);
            toast({ variant: 'destructive', title: 'Punch-out Failed', description: 'Could not update your attendance record.' });
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
            <CardDescription>A complete log of your attendance for {format(today, 'MMMM yyyy')}.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid grid-cols-7 gap-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="font-bold text-center text-muted-foreground text-sm">{day}</div>
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
