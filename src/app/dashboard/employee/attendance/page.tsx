
'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import { doc, collection, query, where, orderBy, addDoc, updateDoc, serverTimestamp, getDocs, limit } from 'firebase/firestore';
import { getStorage, ref, uploadString, getDownloadURL } from 'firebase/storage';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { AttendanceRecord, EmployeeProfile } from '@/lib/types';
import { Loader2, Camera, CameraOff, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

export default function AttendancePage() {
  const { user, firestore } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, startProcessing] = useTransition();

  const [isCameraOn, setIsCameraOn] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [activePunchIn, setActivePunchIn] = useState<AttendanceRecord | null>(null);
  const [hasCameraPermission, setHasCameraPermission] = useState(true);

  // Fetch employee profile
  const employeeProfileRef = useMemoFirebase(() => (user ? doc(firestore, 'employeeProfiles', user.uid) : null), [user, firestore]);
  const { data: employeeProfile, isLoading: profileLoading } = useDoc<EmployeeProfile>(employeeProfileRef);

  // Fetch today's attendance records to find an active punch-in
  const attendanceQuery = useMemoFirebase(() => {
    if (!user) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return query(
      collection(firestore, `stores/${employeeProfile?.storeId}/attendance`),
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

  // Camera logic
  useEffect(() => {
    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        streamRef.current = stream;
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this feature.',
        });
      }
    };
    
    if (isCameraOn) {
        getCameraPermission();
    } else {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    }

    return () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
        }
    };
  }, [isCameraOn, toast]);

  const handlePunchIn = async () => {
    if (!videoRef.current || !canvasRef.current || !user || !employeeProfile) {
        toast({ variant: 'destructive', title: 'Error', description: 'Required resources are not ready.'});
        return;
    };

    startProcessing(async () => {
        // Capture photo
        const video = videoRef.current;
        const canvas = canvasRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext('2d')?.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
        const photoDataUrl = canvas.toDataURL('image/jpeg');

        // Upload photo
        const storage = getStorage();
        const filePath = `punch-in-photos/${user.uid}/${Date.now()}.jpg`;
        const storageRef = ref(storage, filePath);
        
        try {
            const snapshot = await uploadString(storageRef, photoDataUrl, 'data_url');
            const downloadURL = await getDownloadURL(snapshot.ref);

            // Create Firestore record
            await addDoc(collection(firestore, `stores/${employeeProfile.storeId}/attendance`), {
                employeeId: user.uid,
                storeId: employeeProfile.storeId,
                workDate: format(new Date(), 'yyyy-MM-dd'),
                punchInTime: serverTimestamp(),
                punchOutTime: null,
                punchInPhotoUrl: downloadURL,
                workHours: 0,
            });

            toast({ title: 'Punched In!', description: 'Your shift has started.' });
            setIsCameraOn(false);
        } catch (error) {
            console.error('Punch-in failed:', error);
            toast({ variant: 'destructive', title: 'Punch-in Failed', description: 'Could not save your attendance record.' });
        }
    });
  };

  const handlePunchOut = async () => {
    if (!activePunchIn || !user) return;
    
    startProcessing(async () => {
        try {
            const punchInTime = (activePunchIn.punchInTime as any).toDate();
            const punchOutTime = new Date();
            const workHours = (punchOutTime.getTime() - punchInTime.getTime()) / (1000 * 60 * 60);

            await updateDoc(doc(firestore, `stores/${employeeProfile?.storeId}/attendance`, activePunchIn.id), {
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
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">Employee Attendance</CardTitle>
          <CardDescription>
            {activePunchIn 
                ? `You punched in at ${format((activePunchIn.punchInTime as any).toDate(), 'p')}`
                : 'Use your camera to punch in for your shift.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            {!activePunchIn && (
                 <div className="w-full aspect-video bg-black rounded-md overflow-hidden flex items-center justify-center">
                    {isCameraOn ? (
                        <video ref={videoRef} className="w-full h-full object-cover" autoPlay muted playsInline/>
                    ) : (
                        <div className="text-center text-muted-foreground p-4">
                            <CameraOff className="h-12 w-12 mx-auto" />
                            <p className="mt-2">Camera is off</p>
                        </div>
                    )}
                 </div>
            )}
           
          {activePunchIn ? (
            <Button onClick={handlePunchOut} disabled={isProcessing} className="w-full" size="lg" variant="destructive">
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Punch Out
            </Button>
          ) : isCameraOn ? (
            <Button onClick={handlePunchIn} disabled={isProcessing || !hasCameraPermission} className="w-full" size="lg">
              {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Punch In Now
            </Button>
          ) : (
            <Button onClick={() => setIsCameraOn(true)} disabled={isProcessing} className="w-full" size="lg">
              <Camera className="mr-2 h-4 w-4" />
              Start Camera
            </Button>
          )}

          {!hasCameraPermission && (
             <Alert variant="destructive">
                <AlertTitle>Camera Access Required</AlertTitle>
                <AlertDescription>Please allow camera access in your browser settings to use this feature.</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
