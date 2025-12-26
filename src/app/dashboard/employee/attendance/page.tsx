
'use client';

import { useEffect, useState, useMemo, useTransition, useCallback } from 'react';
import { collection, query, where, addDoc, serverTimestamp, getDocs, orderBy, updateDoc, doc, Timestamp, collectionGroup, arrayUnion } from 'firebase/firestore';
import { useFirebase, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { format, differenceInMinutes, startOfMonth, endOfMonth, isSameDay, isPast, isToday } from 'date-fns';
import type { AttendanceRecord, EmployeeProfile, Store, ReasonEntry } from '@/lib/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, Calendar as CalendarIcon, Check, Circle, CheckCircle, Info, MessageSquare } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';


export default function EmployeeAttendancePage() {
  const { user, firestore, isUserLoading } = useFirebase();
  const { toast } = useToast();
  const [isProcessing, startProcessing] = useTransition();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const employeeProfileRef = useMemoFirebase(() => (user ? doc(firestore, 'employeeProfiles', user.uid) : undefined), [user, firestore]);
  const { data: employeeProfile, isLoading: profileLoading } = useDoc<EmployeeProfile>(employeeProfileRef);
  
  const storeId = employeeProfile?.storeId;
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const attendanceQuery = useMemoFirebase(() => {
    if (!user?.uid || !firestore) return undefined;
    return query(
      collectionGroup(firestore, `attendance`),
      where('employeeId', '==', user.uid),
      orderBy('workDate', 'desc')
    );
  }, [user?.uid, firestore]);

  const { data: records, setData: setRecords, isLoading: recordsLoading } = useCollection<AttendanceRecord>(attendanceQuery);
  const [isRequestDialogOpen, setIsRequestDialogOpen] = useState(false);
  const [approvalReason, setApprovalReason] = useState("");
  const [isRegularization, setIsRegularization] = useState(false);


  const todaysRecord = useMemo(() => {
    return records?.find(record => record.workDate === todayStr);
  }, [records, todayStr]);

  const selectedRecord = useMemo(() => {
    if (!selectedDate || !records) return null;
    return records.find(r => isSameDay(new Date(r.workDate), selectedDate));
  }, [selectedDate, records]);

  const canRequestApproval = selectedDate && isPast(selectedDate) && !isToday(selectedDate) && !selectedRecord;
  const canResubmit = selectedRecord && selectedRecord.status === 'rejected' && (selectedRecord.rejectionCount || 0) < 3;


  const punchIn = async () => {
    if (!user || !storeId || !firestore) return;

    startProcessing(async () => {
        const newRecordData: Omit<AttendanceRecord, 'id'> = {
            employeeId: user.uid,
            storeId,
            workDate: todayStr,
            punchInTime: Timestamp.now(),
            punchOutTime: null,
            status: 'partially_present',
            workHours: 0,
            rejectionCount: 0,
            reasonHistory: []
        };
        try {
            const docRef = await addDoc(collection(firestore, 'stores', storeId, 'attendance'), newRecordData);
            const newRecordForState: AttendanceRecord = {
                id: docRef.id,
                ...newRecordData,
                punchInTime: new Date()
            };
            setRecords(prevRecords => [newRecordForState, ...(prevRecords || [])]);
            toast({ title: 'Punched In!', description: 'Your shift has started.' });
        } catch(e: any) {
            const permissionError = new FirestorePermissionError({ path: `stores/${storeId}/attendance`, operation: 'create', requestResourceData: newRecordData });
            errorEmitter.emit('permission-error', permissionError);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not punch in.' });
        }
    });
  };

  const punchOut = async () => {
    if (!user || !storeId || !todaysRecord || !todaysRecord.punchInTime) return;

    startProcessing(async () => {
      const recordRef = doc(firestore, 'stores', storeId, 'attendance', todaysRecord.id);
      
      const punchInTime = (todaysRecord.punchInTime as any).toDate ? (todaysRecord.punchInTime as any).toDate() : new Date(todaysRecord.punchInTime as any);
      const punchOutTime = new Date();
      const minutesDiff = differenceInMinutes(punchOutTime, punchInTime);
      const workHours = parseFloat((minutesDiff / 60).toFixed(2));
      
      const newStatus = workHours >= 8 ? 'present' : 'partially_present';

      const updateData = { 
          punchOutTime: Timestamp.fromDate(punchOutTime), 
          workHours,
          status: newStatus
      };
      
      try {
        await updateDoc(recordRef, updateData);
        setRecords(prevRecords => prevRecords?.map(rec => rec.id === todaysRecord.id ? { ...rec, punchOutTime, workHours, status: newStatus } : rec) || null);
        toast({ title: 'Punched Out!', description: `Your shift has ended. Total hours: ${workHours.toFixed(2)}.` });
      } catch (e) {
        const permissionError = new FirestorePermissionError({ path: recordRef.path, operation: 'update', requestResourceData: { workHours, status: newStatus } });
        errorEmitter.emit('permission-error', permissionError);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not punch out.' });
      }
    });
  };
  
  const requestApproval = () => {
    if (!user || !storeId || !selectedDate || !approvalReason.trim() || !firestore) {
        toast({ variant: 'destructive', title: 'Reason Required', description: 'Please provide a reason.' });
        return;
    };
    
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    
    startProcessing(async() => {
        try {
            const newReasonEntry: ReasonEntry = {
                text: approvalReason.trim(),
                timestamp: serverTimestamp(),
                status: 'submitted',
            };

            if ((isRegularization || canResubmit) && selectedRecord) {
                 const recordRef = doc(firestore, `stores/${storeId}/attendance`, selectedRecord.id);
                 
                 // FIX: Construct the full update payload as required by security rules
                 const existing = records?.find(r => r.id === selectedRecord.id);
                 if (!existing) {
                    throw new Error("Could not find the record to update locally.");
                 }

                 const updatedHistory = [...(existing.reasonHistory || []), newReasonEntry];

                 await updateDoc(recordRef, {
                    status: 'pending_approval',
                    rejectionCount: existing.rejectionCount, // Keep the rejectionCount the same
                    reasonHistory: updatedHistory,
                 });

                 // Manually update local state to avoid waiting for listener
                setRecords(prev => prev?.map(r => r.id === selectedRecord.id ? { ...r, status: 'pending_approval', reasonHistory: updatedHistory } : r) || null);
                
                toast({ title: 'Request Submitted', description: 'Your request has been sent to your manager for approval.' });

            } else { // New request for a missed day
                const newRequestData: Omit<AttendanceRecord, 'id'> = {
                    employeeId: user.uid, storeId, workDate: dateStr,
                    punchInTime: null, punchOutTime: null,
                    status: 'pending_approval', workHours: 0,
                    rejectionCount: 0,
                    reasonHistory: [newReasonEntry],
                };
                const docRef = await addDoc(collection(firestore, `stores/${storeId}/attendance`), newRequestData);
                setRecords(prev => [...(prev || []), { id: docRef.id, ...newRequestData }]);
                toast({ title: 'Request Sent', description: 'Your manager has been notified.' });
            }
            setIsRequestDialogOpen(false);
            setApprovalReason('');
        } catch(e) {
            toast({ variant: 'destructive', title: 'Request Failed', description: 'Could not send the request. Please check security rules.' });
            console.error("Request approval error:", e);
        }
    });
  }

  const openRequestDialog = (regularize: boolean) => {
    setIsRegularization(regularize);
    setIsRequestDialogOpen(true);
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
  
  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Dialog open={isRequestDialogOpen} onOpenChange={setIsRequestDialogOpen}>
          <DialogContent>
                <DialogHeader>
                    <DialogTitle>{isRegularization ? 'Request Regularization' : 'Request Approval for Missed Day'}</DialogTitle>
                    <DialogDescription>
                        Please provide a reason for the {isRegularization ? `partial hours on ${selectedDate ? format(selectedDate, "PPP") : ""}` : `absence on ${selectedDate ? format(selectedDate, "PPP") : ""}`}.
                    </DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <Label htmlFor="reason">Reason</Label>
                    <Textarea
                        id="reason"
                        placeholder="e.g., Doctor's appointment, family emergency, worked half day..."
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

      <Card>
          <CardHeader>
            <CardTitle className="text-2xl font-bold mb-2">Employee Attendance</CardTitle>
            <CardDescription>
                Punch in daily and track your monthly attendance. For missed or partial days, click the date on the calendar to request approval.
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
                            partially_present: date => records?.some(r => isSameDay(new Date(r.workDate), date) && r.status === 'partially_present') || false,
                            approved: date => records?.some(r => isSameDay(new Date(r.workDate), date) && r.status === 'approved') || false,
                            pending: date => records?.some(r => isSameDay(new Date(r.workDate), date) && r.status === 'pending_approval') || false,
                            rejected: date => records?.some(r => isSameDay(new Date(r.workDate), date) && r.status === 'rejected') || false,
                        }}
                        modifiersClassNames={{
                            present: 'day-present',
                            partially_present: 'bg-orange-100 text-orange-800',
                            pending: 'bg-yellow-200 text-yellow-900',
                            approved: 'bg-green-100 text-green-800',
                            rejected: 'bg-red-100 text-red-800',
                        }}
                        className="rounded-md border"
                    />
                 </div>
                 
                  <div className="p-4 rounded-lg bg-muted/50 h-full">
                    <h3 className="font-semibold text-lg mb-2">Details for {selectedDate ? format(selectedDate, "PPP") : "Today"}</h3>
                     {selectedRecord ? (
                        <div className="space-y-3">
                            <p><strong>Status:</strong> <Badge variant={selectedRecord.status === 'present' || selectedRecord.status === 'approved' ? 'default' : 'destructive'}>{selectedRecord.status.replace(/_/g, ' ')}</Badge></p>
                            <p><strong>Punch In:</strong> {selectedRecord.punchInTime ? format((selectedRecord.punchInTime as any).toDate ? (selectedRecord.punchInTime as any).toDate() : new Date(selectedRecord.punchInTime as any), 'p') : '—'}</p>
                            <p><strong>Punch Out:</strong> {selectedRecord.punchOutTime ? format((selectedRecord.punchOutTime as any).toDate ? (selectedRecord.punchOutTime as any).toDate() : new Date(selectedRecord.punchOutTime as any), 'p') : '—'}</p>
                            <p><strong>Work Hours:</strong> {selectedRecord.workHours > 0 ? `${selectedRecord.workHours.toFixed(2)} hours` : '—'}</p>
                            
                             {selectedRecord.reasonHistory && selectedRecord.reasonHistory.length > 0 && (
                                 <div className="space-y-2 pt-2 border-t">
                                     <h4 className="text-sm font-semibold flex items-center gap-1.5"><MessageSquare className="h-4 w-4"/> Reason History</h4>
                                     {selectedRecord.reasonHistory.map((entry, index) => (
                                         <div key={index} className="text-xs p-2 bg-background/50 rounded-md">
                                             <p className="italic">"{entry.text}"</p>
                                             <p className="text-muted-foreground mt-1">
                                                 {format((entry.timestamp as any)?.toDate() || new Date(), 'Pp')} - <span className="capitalize font-medium">{entry.status}</span>
                                                 {entry.status === 'rejected' && entry.rejectionReason && `: ${entry.rejectionReason}`}
                                             </p>
                                         </div>
                                     ))}
                                 </div>
                             )}
                             
                             {selectedRecord.status === 'partially_present' && selectedRecord.workHours > 0 && (
                                <Alert className="bg-orange-100 border-orange-300 text-orange-900">
                                    <AlertDescription>
                                        You worked {selectedRecord.workHours.toFixed(2)} hours, which is less than a full shift. You can request regularization if this was due to an issue.
                                    </AlertDescription>
                                     <Button onClick={() => openRequestDialog(true)} disabled={isProcessing} className="w-full mt-2 bg-orange-400 hover:bg-orange-500 text-orange-900">
                                        Request Regularization
                                    </Button>
                                </Alert>
                             )}
                              {canResubmit && (
                                <Alert className="bg-yellow-100 border-yellow-300 text-yellow-900">
                                    <AlertTitle>Request Rejected</AlertTitle>
                                    <AlertDescription>
                                        Your last request was rejected. You have {3 - (selectedRecord.rejectionCount || 0)} attempts remaining.
                                    </AlertDescription>
                                     <Button onClick={() => openRequestDialog(true)} disabled={isProcessing} className="w-full mt-2 bg-yellow-400 hover:bg-yellow-500 text-yellow-900">
                                        Re-submit Request
                                    </Button>
                                </Alert>
                            )}
                        </div>
                     ) : canRequestApproval ? (
                         <div className="space-y-3">
                            <Alert>
                               <Info className="h-4 w-4" />
                                <AlertTitle>Missed Punch-in?</AlertTitle>
                                <AlertDescription>You did not record attendance for this day.</AlertDescription>
                            </Alert>
                             <Button onClick={() => openRequestDialog(false)} disabled={isProcessing} className="w-full">
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
