
'use client';

import { useState, useEffect, useTransition } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, addDoc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { AttendanceRecord, EmployeeProfile } from '@/lib/types';
import { Loader2, CheckCircle, Fingerprint } from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';
import { startAuthentication } from '@simplewebauthn/browser';

async function safeJson(resp: Response) {
    try {
        const text = await resp.text();
        return text ? JSON.parse(text) : {};
    } catch {
        return {};
    }
}

export default function AttendancePage() {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, startProcessing] = useTransition();

  const [activePunchIn, setActivePunchIn] = useState<AttendanceRecord | null>(null);

  // Fetch employee profile
  const employeeProfileRef = useMemoFirebase(() => (user ? doc(firestore, 'employeeProfiles', user.uid) : null), [user, firestore]);
  const { data: employeeProfile, isLoading: profileLoading } = useDoc<EmployeeProfile>(employeeProfileRef);

  // Fetch today's attendance records to find an active punch-in
  const attendanceQuery = useMemoFirebase(() => {
    if (!user || !employeeProfile?.storeId) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return query(
      collection(firestore, `stores/${employeeProfile.storeId}/attendance`),
      where('employeeId', '==', user.uid),
      where('workDate', '==', format(today, 'yyyy-MM-dd')),
      where('punchOutTime', '==', null),
      orderBy('punchInTime', 'desc'),
      limit(1)
    );
  }, [user, firestore, employeeProfile]);
  const { data: recentRecords, isLoading: recordsLoading } = useCollection<AttendanceRecord>(attendanceQuery);
  
  useEffect(() => {
    if (recentRecords && recentRecords.length > 0) {
      setActivePunchIn(recentRecords[0]);
    } else {
      setActivePunchIn(null);
    }
  }, [recentRecords]);

  const handlePunchIn = async () => {
    if (!user || !employeeProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'Employee profile not loaded.'});
        return;
    };

    startProcessing(async () => {
      try {
        // 1. Get WebAuthn options from the server for the current user
        const respOptions = await fetch('/api/auth/webauthn/generate-authentication-options', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email }),
        });
        const options = await safeJson(respOptions);
        if (!respOptions.ok) throw new Error(options.error || 'Could not get authentication options.');

        // 2. Prompt user for biometric authentication
        const assertion = await startAuthentication(options);

        // 3. Verify the authentication with the server
         const verificationResp = await fetch('/api/auth/webauthn/verify-authentication', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...assertion, email: user.email }),
        });
        const verificationJSON = await verificationResp.json();
        if (!verificationJSON.verified) throw new Error(verificationJSON.error || 'Biometric verification failed.');

        // 4. If verification is successful, create the punch-in record
        await addDoc(collection(firestore, `stores/${employeeProfile.storeId}/attendance`), {
            employeeId: user.uid,
            storeId: employeeProfile.storeId,
            workDate: format(new Date(), 'yyyy-MM-dd'),
            punchInTime: serverTimestamp(),
            punchOutTime: null,
            workHours: 0,
        });

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
            setActivePunchIn(null);
        } catch (error) {
            console.error('Punch-out failed:', error);
            toast({ variant: 'destructive', title: 'Punch-out Failed', description: 'Could not update your attendance record.' });
        }
    });
  };
  
  if (profileLoading || recordsLoading) {
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
      <Card className="max-w-md mx-auto">
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
                    This feature uses the WebAuthn standard, the same secure technology used for passwordless login. Your biometric data never leaves your device.
                </AlertDescription>
            </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
