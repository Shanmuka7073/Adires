
'use client';

import { useEffect, useState, useMemo, useTransition, useCallback, useRef } from 'react';
import { collection, query, where, addDoc, getDocs, orderBy, updateDoc, doc, Timestamp, arrayUnion, onSnapshot } from 'firebase/firestore';
import { useFirebase, useDoc, useMemoFirebase, errorEmitter } from '@/firebase';
import { format, isSameDay, startOfDay, differenceInMinutes } from 'date-fns';
import type { AttendanceRecord, EmployeeProfile, Store, ReasonEntry, User } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Calendar as CalendarIcon, CheckCircle, Info, MessageSquare, MapPin, LocateFixed, ShieldCheck, Mail, Briefcase, User as UserIcon } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { FirestorePermissionError } from '@/firebase/errors';
import { getAuth, onAuthStateChanged } from 'firebase/auth';

function AttendanceDetails({ record }: { record: AttendanceRecord }) {
    const [isRegularizationDialogOpen, setIsRegularizationDialogOpen] = useState(false);
    const canResubmit = record.status === 'rejected' && (record.rejectionCount || 0) < 3;
    const [isProcessing, startProcessing] = useTransition();
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [approvalReason, setApprovalReason] = useState("");


    const requestRegularization = async () => {
        if (!record || !approvalReason.trim() || !firestore) {
            toast({ variant: 'destructive', title: 'Reason Required' });
            return;
        }

        startProcessing(async () => {
            const recordRef = doc(firestore, `stores/${record.storeId}/attendance`, record.id);
            const newReasonEntry: ReasonEntry = {
                text: approvalReason.trim(),
                timestamp: new Date(),
                status: 'submitted',
            };
            try {
                await updateDoc(recordRef, {
                    status: 'pending_approval',
                    reasonHistory: arrayUnion(newReasonEntry),
                });
                toast({ title: 'Request Submitted', description: 'Your request has been sent for approval.' });
                setIsRegularizationDialogOpen(false);
                setApprovalReason("");
            } catch (e) {
                 toast({ variant: 'destructive', title: 'Request Failed' });
            }
        });
    }

    const toDateSafe = (d: any): Date => d instanceof Timestamp ? d.toDate() : new Date(d);

    return (
        <>
             <Dialog open={isRegularizationDialogOpen} onOpenChange={setIsRegularizationDialogOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Request Regularization</DialogTitle>
                        <DialogDescription>Please provide a reason for the partial hours on {record.workDate instanceof Timestamp ? format(record.workDate.toDate(), "PPP") : format(new Date(record.workDate), "PPP")}.</DialogDescription>
                    </DialogHeader>
                     <div className="py-4">
                        <Label htmlFor="reason">Reason</Label>
                        <Textarea id="reason" placeholder="e.g., Doctor's appointment..." value={approvalReason} onChange={(e) => setApprovalReason(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsRegularizationDialogOpen(false)}>Cancel</Button>
                        <Button onClick={requestRegularization} disabled={isProcessing || !approvalReason.trim()}>
                            {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>} Submit
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="space-y-3">
                <div className="flex items-center gap-2"><strong>Status:</strong> <Badge variant={record.status === 'present' || record.status === 'approved' ? 'default' : 'destructive'}>{record.status.replace(/_/g, ' ')}</Badge></div>
                <p><strong>Punch In:</strong> {record.punchInTime ? format(toDateSafe(record.punchInTime), 'p') : '—'}</p>
                <p><strong>Punch Out:</strong> {record.punchOutTime ? format(toDateSafe(record.punchOutTime), 'p') : '—'}</p>
                <p><strong>Work Hours:</strong> {record.workHours > 0 ? `${record.workHours.toFixed(2)} hours` : '—'}</p>
                
                {record.reasonHistory && record.reasonHistory.length > 0 && (
                    <div className="space-y-2 pt-2 border-t">
                        <h4 className="text-sm font-semibold flex items-center gap-1.5"><MessageSquare className="h-4 w-4"/> Reason History</h4>
                        {record.reasonHistory.map((entry, index) => (
                            <div key={index} className="text-xs p-2 bg-background/50 rounded-md">
                                <p className="italic">"{entry.text}"</p>
                                <div className="text-muted-foreground mt-1">
                                    {format(toDateSafe(entry.timestamp), 'Pp')} - <span className="capitalize font-medium">{entry.status}</span>
                                    {entry.status === 'rejected' && entry.rejectionReason && `: ${entry.rejectionReason}`}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
                
                {record.status === 'partially_present' && record.workHours >= 0 && (
                    <Alert className="bg-orange-100 border-orange-300 text-orange-900">
                        <AlertDescription>
                            You worked {record.workHours.toFixed(2)} hours. You can request regularization if this was due to an issue.
                        </AlertDescription>
                        <Button onClick={() => setIsRegularizationDialogOpen(true)} disabled={isProcessing} className="w-full mt-2 bg-orange-400 hover:bg-orange-500 text-orange-900">
                            Request Regularization
                        </Button>
                    </Alert>
                )}
                {canResubmit && (
                    <Alert className="bg-yellow-100 border-yellow-300 text-yellow-900">
                        <AlertTitle>Request Rejected</AlertTitle>
                        <AlertDescription>Your last request was rejected. You have {3 - (record.rejectionCount || 0)} attempts remaining.</AlertDescription>
                        <Button onClick={() => setIsRegularizationDialogOpen(true)} disabled={isProcessing} className="w-full mt-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900">
                            Re-submit Request
                        </Button>
                    </Alert>
                )}
            </div>
        </>
    );
}

function RequestApprovalUI({ onOpenDialog }: { onOpenDialog: () => void }) {
    return (
        <div className="space-y-3">
            <Alert>
                <Info className="h-4 w-4" />
                <AlertTitle>Missed Punch-in?</AlertTitle>
                <AlertDescription>You did not record attendance for this day.</AlertDescription>
            </Alert>
            <Button onClick={onOpenDialog} className="w-full">
                Request Approval for this Day
            </Button>
        </div>
    );
}


export default function EmployeeAttendancePage() {
  const { user, firestore, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, startProcessing] = useTransition();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const employeeProfileRef = useMemoFirebase(() => (user ? doc(firestore, 'employeeProfiles', user.uid) : null), [user, firestore]);
  const { data: employeeProfile, isLoading: profileLoading } = useDoc<EmployeeProfile>(employeeProfileRef);
  
  const storeRef = useMemoFirebase(() => (employeeProfile?.storeId ? doc(firestore, 'stores', employeeProfile.storeId) : null), [employeeProfile, firestore]);
  const { data: storeData } = useDoc<Store>(storeRef);

  const managerDocRef = useMemoFirebase(() => 
    (firestore && employeeProfile?.reportingTo) ? doc(firestore, 'users', employeeProfile.reportingTo) : null
  , [firestore, employeeProfile?.reportingTo]);
  const { data: managerData } = useDoc<User>(managerDocRef);

  const [authReady, setAuthReady] = useState(false);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(true);

  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState("");

  useEffect(() => {
    if (!firestore) return;
    const auth = getAuth(firestore.app);
    const unsub = onAuthStateChanged(auth, (u) => {
        if (u) {
            setAuthReady(true);
        }
    });
    return () => unsub();
  }, [firestore]);

  useEffect(() => {
    if (!authReady || !user?.uid || !firestore || !employeeProfile?.storeId) {
        if (!isUserLoading && !profileLoading) {
            setRecordsLoading(false);
        }
        return;
    };

    const storeId = employeeProfile.storeId;
    setRecordsLoading(true);

    const q = query(
      collection(firestore, `stores/${storeId}/attendance`),
      where('employeeId', '==', user.uid),
      orderBy('workDate', 'desc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const data = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data(),
        })) as AttendanceRecord[];
        setRecords(data);
        setRecordsLoading(false);
      },
      (error) => {
        console.error('ATTENDANCE FETCH FAILED (Employee)', { employeeId: user.uid, storeId, error: error });
        toast({
            variant: 'destructive',
            title: 'Permission Denied',
            description: 'Could not fetch attendance records.'
        })
        setRecordsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [authReady, user?.uid, firestore, employeeProfile?.storeId, toast, isUserLoading, profileLoading]);


  const toDateSafe = (d: any): Date => d instanceof Timestamp ? d.toDate() : new Date(d);

  const todaysRecord = useMemo(() => {
    if (!records) return null;
    return records.find(r => isSameDay(toDateSafe(r.workDate), new Date())) ?? null;
  }, [records]);
  
  const selectedRecord = useMemo(() => {
    if (!selectedDate || !records) return null;
    return records.find(r => isSameDay(toDateSafe(r.workDate), selectedDate)) ?? null;
  }, [records, selectedDate]);
  
  const recordToShow = useMemo(() => {
    if (recordsLoading) return null;
    if (!records) return null;

    if (selectedRecord) return selectedRecord;

    if (selectedDate && isSameDay(selectedDate, new Date())) {
        return todaysRecord ?? null;
    }

    return null;
  }, [recordsLoading, records, selectedRecord, selectedDate, todaysRecord]);


  const selectedDateIsPast = selectedDate && !isSameDay(selectedDate, new Date()) && selectedDate < startOfDay(new Date());
  const canRequestApproval = !recordsLoading && selectedDateIsPast && !selectedRecord;

  const punchIn = async () => {
    if (!user || !employeeProfile?.storeId || !firestore) return;
    
    if (todaysRecord) {
        toast({ variant: 'destructive', title: 'Already Punched In' });
        return;
    }

    startProcessing(async () => {
        // CAPTURE LOCATION
        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const { latitude, longitude } = position.coords;
                
                // PROXIMITY CHECK
                if (storeData && storeData.latitude && storeData.longitude) {
                    const R = 6371e3; // metres
                    const φ1 = latitude * Math.PI/180;
                    const φ2 = storeData.latitude * Math.PI/180;
                    const Δφ = (storeData.latitude - latitude) * Math.PI/180;
                    const Δλ = (storeData.longitude - longitude) * Math.PI/180;

                    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                            Math.cos(φ1) * Math.cos(φ2) *
                            Math.sin(Δλ/2) * Math.sin(Δλ/2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                    const distance = R * c;

                    if (distance > 500) {
                        toast({ variant: 'destructive', title: 'Out of Range', description: `You must be within 500m of the store. Currently ${Math.round(distance)}m away.` });
                        return;
                    }
                }

                // RECORD PUNCH IN
                const today = startOfDay(new Date());
                const newRecordData: Omit<AttendanceRecord, 'id'> = {
                    employeeId: user.uid, 
                    storeId: employeeProfile.storeId,
                    workDate: Timestamp.fromDate(today),
                    workDateStr: format(today, 'yyyy-MM-dd'),
                    punchInTime: Timestamp.now(), 
                    punchOutTime: null,
                    status: 'partially_present', 
                    workHours: 0,
                    rejectionCount: 0, 
                    reasonHistory: [],
                } as any;

                try {
                    await addDoc(collection(firestore, 'stores', employeeProfile.storeId, 'attendance'), newRecordData);
                    toast({ title: 'Punch In Successful!', description: 'Attendance marked based on location verification.' });
                } catch(e: any) {
                    const permissionError = new FirestorePermissionError({ path: `stores/${employeeProfile.storeId}/attendance`, operation: 'create', requestResourceData: newRecordData });
                    errorEmitter.emit('permission-error', permissionError);
                }
            },
            (err) => {
                toast({ variant: 'destructive', title: 'Location Error', description: "Could not verify your location. Please enable GPS to punch in." });
            }
        );
    });
  };

  const punchOut = async () => {
    if (!user || !employeeProfile?.storeId || !todaysRecord || !todaysRecord.punchInTime) return;
    
    if (todaysRecord.status !== 'partially_present') {
        toast({ title: 'Already Punched Out', description: `Your status is already '${todaysRecord.status}'.` });
        return;
    }

    startProcessing(async () => {
        // PROCEED WITH UPDATE
        const recordRef = doc(firestore, 'stores', employeeProfile.storeId, 'attendance', todaysRecord.id);
        const punchInTime = toDateSafe(todaysRecord.punchInTime);
        const punchOutTime = new Date();
        const minutesDiff = differenceInMinutes(punchOutTime, punchInTime);
        const workHours = parseFloat((minutesDiff / 60).toFixed(2));
        const newStatus = workHours >= 8 ? 'present' : 'partially_present';

        try {
            await updateDoc(recordRef, { punchOutTime: Timestamp.fromDate(punchOutTime), workHours, status: newStatus });
            toast({ title: 'Punched Out Successfully!', description: `Your shift has ended. Total hours: ${workHours.toFixed(2)}.` });
        } catch (e) {
            const permissionError = new FirestorePermissionError({ path: recordRef.path, operation: 'update', requestResourceData: { workHours, status: newStatus } });
            errorEmitter.emit('permission-error', permissionError);
        }
    });
  };
  
  const requestApproval = () => {
    if (!user || !employeeProfile?.storeId || !selectedDate || !approvalReason.trim() || !firestore) {
        toast({ variant: 'destructive', title: 'Reason Required', description: 'Please provide a reason.' });
        return;
    };
    
    const existing = records?.find(r => isSameDay(toDateSafe(r.workDate), selectedDate));
    if (existing) {
        toast({ variant: 'destructive', title: 'Request already exists', description: 'An attendance record already exists for this day.' });
        return;
    }

    startProcessing(async() => {
        try {
            const selectedDayStart = startOfDay(selectedDate);
            const newRequestData: Omit<AttendanceRecord, 'id'> = {
                employeeId: user.uid, storeId: employeeProfile.storeId,
                workDate: Timestamp.fromDate(selectedDayStart),
                workDateStr: format(selectedDate, 'yyyy-MM-dd'),
                punchInTime: null, punchOutTime: null,
                status: 'pending_approval', workHours: 0, rejectionCount: 0,
                reasonHistory: [{ text: approvalReason.trim(), timestamp: new Date(), status: 'submitted' }],
            };
            await addDoc(collection(firestore, `stores/${employeeProfile.storeId}/attendance`), newRequestData);
            toast({ title: 'Request Sent', description: 'Your manager has been notified.' });
            
            setIsRequestDialogOpen(false);
            setApprovalReason('');
        } catch(e: any) {
            console.error("Request approval error:", e);
            toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send the request.' });
        }
    });
  }

  const isLoading = isUserLoading || profileLoading;

  if (isLoading || recordsLoading) {
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
  
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-8">
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
          <DialogContent>
                <DialogHeader>
                    <DialogTitle>Request Approval for Missed Day</DialogTitle>
                    <DialogDescription>
                        Please provide a reason for the absence on {selectedDate ? format(selectedDate, "PPP") : ""}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea
                        id="reason"
                        placeholder="e.g., Doctor's appointment, family emergency..."
                        value={approvalReason}
                        onChange={(e) => setApprovalReason(e.target.value)}
                    />
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setIsRequestDialogOpen(false)}>Cancel</Button>
                    <Button onClick={requestApproval} disabled={isProcessing || !approvalReason.trim()}>
                        {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        Submit Request
                    </Button>
                </DialogFooter>
            </DialogContent>
      </Dialog>

      <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold font-headline">Employee Attendance</h1>
                <p className="text-muted-foreground mt-1">Punch in and out securely based on your store location.</p>
              </div>
              <Badge variant="outline" className="w-fit h-fit py-1 px-3 border-primary/30 bg-primary/5 text-primary">
                  {storeData?.name || 'Loading Store...'}
              </Badge>
          </div>

          <Card className="bg-muted/30 border-muted-foreground/10">
              <CardContent className="pt-6 grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
                  <div className="space-y-1">
                      <p className="text-muted-foreground font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                          <UserIcon className="h-3 w-3" /> Employee ID
                      </p>
                      <p className="font-mono font-bold text-primary text-base">{employeeProfile.employeeId}</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-muted-foreground font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                          <Briefcase className="h-3 w-3" /> Role
                      </p>
                      <p className="font-bold text-base capitalize">{employeeProfile.role}</p>
                  </div>
                  <div className="space-y-1 overflow-hidden">
                      <p className="text-muted-foreground font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                          <Mail className="h-3 w-3" /> Email
                      </p>
                      <p className="truncate font-bold text-base" title={employeeProfile.email}>{employeeProfile.email}</p>
                  </div>
                  <div className="space-y-1">
                      <p className="text-muted-foreground font-bold uppercase text-[9px] tracking-wider flex items-center gap-1">
                          <UserIcon className="h-3 w-3" /> Reporting To
                      </p>
                      <p className="font-bold text-base">{managerData ? `${managerData.firstName} ${managerData.lastName}` : 'Store Owner'}</p>
                  </div>
              </CardContent>
          </Card>
      </div>

      <Card>
          <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    onClick={punchIn}
                    disabled={!!todaysRecord || isProcessing}
                    size="lg"
                    className="h-16 text-lg bg-green-600 hover:bg-green-700"
                  >
                    {isProcessing && !todaysRecord ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LocateFixed className="mr-2 h-6 w-6" />}
                    Punch In (Location Verified)
                  </Button>
                   <Button
                    onClick={punchOut}
                    disabled={!todaysRecord || !!todaysRecord.punchOutTime || todaysRecord.status !== 'partially_present' || isProcessing}
                    size="lg"
                    className="h-16 text-lg"
                    variant="destructive"
                  >
                     {isProcessing && todaysRecord && !todaysRecord.punchOutTime ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LocateFixed className="mr-2 h-6 w-6" />}
                    Punch Out (Location Verified)
                  </Button>
              </div>

              {todaysRecord && (
                  <Alert className="bg-green-50 border-green-200">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <AlertTitle className="text-green-800">You are Punched In</AlertTitle>
                      <AlertDescription className="text-green-700">
                          Started at {todaysRecord.punchInTime ? format(toDateSafe(todaysRecord.punchInTime), 'p') : ''}
                      </AlertDescription>
                  </Alert>
              )}

              <div className="grid md:grid-cols-2 gap-8 items-start">
                 <div className="flex justify-center">
                    <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => { if (date) setSelectedDate(date)}}
                        disabled={(date) => date > new Date()}
                        modifiers={{
                          present: date => records?.some(r => isSameDay(toDateSafe(r.workDate), date) && r.status === 'present') || false,
                          partially_present: date => records?.some(r => isSameDay(toDateSafe(r.workDate), date) && r.status === 'partially_present') || false,
                          approved: date => records?.some(r => isSameDay(toDateSafe(r.workDate), date) && r.status === 'approved') || false,
                          pending: date => records?.some(r => isSameDay(toDateSafe(r.workDate), date) && r.status === 'pending_approval') || false,
                          rejected: date => records?.some(r => isSameDay(toDateSafe(r.workDate), date) && r.status === 'rejected') || false,
                        }}
                        modifiersClassNames={{
                            present: 'day-present',
                            partially_present: 'bg-orange-100 text-orange-800',
                            pending: 'bg-yellow-200 text-yellow-900',
                            approved: 'bg-green-100 text-green-800',
                            rejected: 'bg-red-100 text-red-800',
                        }}
                        className="rounded-md border shadow-sm"
                    />
                 </div>
                 
                  <div className="p-4 rounded-lg bg-muted/50 h-full border">
                    <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                        <CalendarIcon className="h-5 w-5 text-muted-foreground" />
                        {format(selectedDate ?? new Date(), "PPP")}
                    </h3>
                    {recordsLoading ? (
                        <Skeleton className="h-40 w-full" />
                    ) : recordToShow ? (
                        <AttendanceDetails record={recordToShow} />
                    ) : canRequestApproval ? (
                        <RequestApprovalUI onOpenDialog={() => setIsRequestDialogOpen(true)} />
                    ) : (
                        <div className="text-center py-8">
                            <Info className="h-10 w-10 text-muted-foreground mx-auto mb-2 opacity-20" />
                            <p className="text-sm text-muted-foreground">
                                No record found for this day.
                            </p>
                        </div>
                    )}
                 </div>
              </div>
          </CardContent>
          <CardFooter className="border-t bg-muted/20 p-4">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1"><Badge className="h-2 w-2 p-0 rounded-full bg-green-500" /> Full Day</div>
                  <div className="flex items-center gap-1"><Badge className="h-2 w-2 p-0 rounded-full bg-orange-400" /> Partial</div>
                  <div className="flex items-center gap-1"><Badge className="h-2 w-2 p-0 rounded-full bg-yellow-400" /> Pending</div>
                  <div className="flex items-center gap-1"><Badge className="h-2 w-2 p-0 rounded-full bg-red-400" /> Rejected</div>
              </div>
          </CardFooter>
      </Card>
    </div>
  );
}
