
'use client';

import { Order, Store } from '@/lib/types';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  CookingPot,
  Truck,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Check,
  Package,
  BarChart3,
  Users
} from 'lucide-react';

import {
  collection, query, where, orderBy, doc, writeBatch
} from 'firebase/firestore';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import Link from 'next/link';
import { markSessionAsPaid } from '@/app/actions';
import type { Timestamp } from 'firebase/firestore';


const STATUS_META: Record<string, any> = {
  Pending: { icon: AlertTriangle, variant: 'secondary', color: 'text-amber-600' },
  Processing: { icon: CookingPot, variant: 'secondary', color: 'text-blue-600' },
  'Out for Delivery': { icon: Truck, variant: 'outline', color: 'text-purple-600' },
  Billed: { icon: Check, variant: 'default', color: 'text-green-600' },
  Completed: { icon: CheckCircle, variant: 'default', color: 'text-gray-600' },
  Delivered: { icon: CheckCircle, variant: 'default', color: 'text-gray-600' },
  Cancelled: { icon: AlertTriangle, variant: 'destructive', color: 'text-red-600' },
};


interface Session {
  id: string;
  tableNumber: string | null;
  orders: Order[];
  totalAmount: number;
  status: Order['status'];
  lastActivity: Date;
}

function playNotificationSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.type = 'triangle';
    oscillator.frequency.setValueAtTime(1000, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.5);
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (error) {
    console.error("Could not play notification sound:", error);
  }
}

function EmptyTableCard({ tableNumber }: { tableNumber: string }) {
    return (
        <Card className="border-dashed bg-muted/20 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-default h-full flex flex-col justify-center items-center py-12">
            <Users className="h-8 w-8 text-muted-foreground mb-2" />
            <h3 className="font-bold text-lg">Table {tableNumber}</h3>
            <p className="text-xs text-muted-foreground">Available</p>
        </Card>
    )
}


function SessionCard({ session, onStatusChange, isUpdating }: { session: Session; onStatusChange: (sessionId: string, newStatus: Order['status']) => void; isUpdating: boolean }) {
  const { toast } = useToast();
  const [isCompleting, startCompletion] = useTransition();

  const handleConfirmPayment = () => {
    startCompletion(async () => {
        const result = await markSessionAsPaid(session.id);
        if (result.success) {
            toast({ title: 'Payment Confirmed', description: `Order for table ${session.tableNumber} is now complete.`});
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
        }
    });
  };

  const meta = STATUS_META[session.status];

  return (
    <Card className={session.status === 'Billed' ? 'border-primary ring-2 ring-primary h-full' : 'h-full shadow-md'}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
            <div>
                 <CardTitle className="text-xl">Table {session.tableNumber || 'N/A'}</CardTitle>
                 <CardDescription className="text-[10px] font-mono">ID: {session.id.slice(0, 8)}</CardDescription>
            </div>
             <Badge variant={meta?.variant || 'secondary'} className="px-2 py-0.5">
                {session.status}
             </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 tracking-wider">Current Order</h4>
          <div className="max-h-32 overflow-y-auto space-y-1.5 pr-2">
            {session.orders.flatMap(o => o.items).map((item, index) => (
              <div key={index} className="flex justify-between items-center text-xs p-2 bg-muted/50 rounded-md">
                <span className="font-medium">{item.productName} <span className="text-muted-foreground font-normal">x{item.quantity}</span></span>
                <span className="font-mono">₹{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-4 space-y-4">
            <div className="flex justify-between font-bold text-lg">
                <span>Total Bill</span>
                <span>₹{session.totalAmount.toFixed(2)}</span>
            </div>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button 
                        className={session.status === 'Billed' ? 'w-full bg-green-600 hover:bg-green-700' : 'w-full'}
                        variant={session.status === 'Billed' ? 'default' : 'outline'}
                        disabled={isUpdating || isCompleting || session.status === 'Completed'}
                        size="sm"
                    >
                        {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                        {session.status === 'Billed' ? 'Receive Payment' : 'Confirm Payment'}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Payment Received?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will finalize the bill for table {session.tableNumber} and mark the session as completed.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmPayment}>Yes, Payment Received</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {session.status === 'Pending' && (
                <p className="text-[10px] text-center text-muted-foreground italic">Waiting for customer to finalize their order...</p>
            )}
        </div>
      </CardContent>
    </Card>
  )
}

export default function StoreOrdersPage() {
  const { firestore, user } = useFirebase();
  const [isUpdating, startUpdateTransition] = useTransition();
  const { toast } = useToast();
  const billedSessionIds = useRef<Set<string>>(new Set());

  const storeQuery = useMemoFirebase(() =>
    firestore && user
      ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid))
      : null,
  [firestore, user]);

  const { data: myStores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
  const myStore = myStores?.[0];

  const ordersQuery = useMemoFirebase(() =>
    firestore && myStore
      ? query(
          collection(firestore, 'orders'),
          where('storeId', '==', myStore.id),
          orderBy('orderDate', 'desc')
        )
      : null,
  [firestore, myStore]);

  const { data: orders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

  const sessions = useMemo((): Record<string, Session> => {
    if (!orders) return {};
    return orders.reduce((acc, order) => {
        const sessionId = order.sessionId;
        if (!sessionId) return acc;

        if (!acc[sessionId]) {
            acc[sessionId] = {
                id: sessionId,
                tableNumber: order.tableNumber || 'N/A',
                orders: [],
                totalAmount: 0,
                status: 'Pending',
                lastActivity: new Date(0),
            };
        }
        
        acc[sessionId].orders.push(order);
        acc[sessionId].totalAmount += order.totalAmount;
        
        const orderDate = new Date((order.orderDate as Timestamp).seconds * 1000);
        if (orderDate > acc[sessionId].lastActivity) {
            acc[sessionId].lastActivity = orderDate;
            acc[sessionId].status = order.status;
        }

        return acc;
    }, {} as Record<string, Session>);
  }, [orders]);
  
  useEffect(() => {
    Object.values(sessions).forEach(session => {
        if(session.status === 'Billed' && !billedSessionIds.current.has(session.id)) {
            playNotificationSound();
            toast({
                title: 'Payment Request',
                description: `Table ${session.tableNumber || session.id.slice(0, 4)} has closed their bill and is ready to pay.`,
                duration: 10000,
            });
            billedSessionIds.current.add(session.id);
        } else if (session.status !== 'Billed') {
             billedSessionIds.current.delete(session.id);
        }
    });
  }, [sessions, toast]);

  const handleSessionStatusChange = (sessionId: string, newStatus: Order['status']) => {
    if (!firestore) return;
    const session = sessions[sessionId];
    if (!session) return;
    
    startUpdateTransition(async () => {
        const batch = writeBatch(firestore);
        session.orders.forEach(order => {
            const orderRef = doc(firestore, 'orders', order.id);
            batch.update(orderRef, { status: newStatus });
        });
        await batch.commit();
        toast({ title: 'Session Updated', description: `Session for table ${session.tableNumber} marked as ${newStatus}.`});
    });
  };

  const activeSessionsByTable = useMemo(() => {
      const map: Record<string, Session> = {};
      Object.values(sessions).forEach(s => {
          if (s.status !== 'Completed' && s.status !== 'Cancelled' && s.tableNumber) {
              map[s.tableNumber] = s;
          }
      });
      return map;
  }, [sessions]);
  
  const completedSessions = useMemo(() => {
    const groupedByDate: Record<string, Record<string, Session[]>> = {};
    const filtered = Object.values(sessions).filter(s => s.status === 'Completed' || s.status === 'Cancelled');
    
    filtered.forEach(session => {
        const dateKey = format(session.lastActivity, 'MMMM do, yyyy');
        if (!groupedByDate[dateKey]) {
            groupedByDate[dateKey] = {};
        }
        const tableKey = session.tableNumber || 'Unknown Table';
        if (!groupedByDate[dateKey][tableKey]) {
            groupedByDate[dateKey][tableKey] = [];
        }
        groupedByDate[dateKey][tableKey].push(session);
    });

    for (const date in groupedByDate) {
        for (const table in groupedByDate[date]) {
            groupedByDate[date][table].sort((a,b) => b.lastActivity.getTime() - a.lastActivity.getTime());
        }
    }
    return groupedByDate;
  }, [sessions]);

  const isLoading = storeLoading || ordersLoading;

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
        <div className="mb-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
                <h1 className="text-4xl font-bold font-headline">Live Table Orders</h1>
                <p className="text-muted-foreground">Monitor and manage your restaurant's tables in real-time.</p>
            </div>
            <Button asChild variant="outline">
                <Link href="/dashboard/owner/sales-report">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Sales Report
                </Link>
            </Button>
        </div>

        <div className="space-y-12">
            <div>
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-semibold">Table Floor Map</h2>
                    <div className="flex gap-4 text-xs">
                        <div className="flex items-center gap-1.5"><Badge className="h-2 w-2 p-0 rounded-full bg-green-500" /> Available</div>
                        <div className="flex items-center gap-1.5"><Badge className="h-2 w-2 p-0 rounded-full bg-blue-500" /> Booked</div>
                        <div className="flex items-center gap-1.5"><Badge className="h-2 w-2 p-0 rounded-full bg-orange-500" /> Billed</div>
                    </div>
                </div>
                 {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        <Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" /><Skeleton className="h-48 w-full" />
                    </div>
                ) : myStore?.tables && myStore.tables.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                        {myStore.tables.map(tableNumber => {
                            const activeSession = activeSessionsByTable[tableNumber];
                            return activeSession ? (
                                <SessionCard key={activeSession.id} session={activeSession} onStatusChange={handleSessionStatusChange} isUpdating={isUpdating} />
                            ) : (
                                <EmptyTableCard key={tableNumber} tableNumber={tableNumber} />
                            )
                        })}
                    </div>
                ) : (
                    <Card className="bg-muted/30 border-dashed">
                        <CardHeader>
                            <CardTitle>No Tables Configured</CardTitle>
                            <CardDescription>Go to "My Store" settings to add your restaurant tables and generate QR codes.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline"><Link href="/dashboard/owner/my-store">Go to Store Settings</Link></Button>
                        </CardContent>
                     </Card>
                )}
            </div>

             <div>
                <h2 className="text-2xl font-semibold mb-4 text-muted-foreground">Order History</h2>
                 {isLoading ? (
                    <Skeleton className="h-24 w-full" />
                ) : Object.keys(completedSessions).length > 0 ? (
                    <Accordion type="multiple" className="w-full space-y-4">
                      {Object.entries(completedSessions).sort(([a],[b]) => new Date(b).getTime() - new Date(a).getTime()).map(([date, tables]) => (
                        <AccordionItem value={date} key={date}>
                          <AccordionTrigger className="text-lg font-semibold border px-4 py-3 rounded-lg hover:bg-muted/50 hover:no-underline [&[data-state=open]]:rounded-b-none">
                            {date}
                          </AccordionTrigger>
                          <AccordionContent className="border border-t-0 rounded-b-lg p-2 space-y-2">
                             <Accordion type="multiple" className="w-full space-y-2">
                                {Object.entries(tables).map(([tableNumber, tableSessions]) => (
                                    <AccordionItem value={`${date}-${tableNumber}`} key={tableNumber}>
                                        <AccordionTrigger className="text-base font-semibold border px-3 py-2 rounded-md bg-background hover:bg-background/80 hover:no-underline [&[data-state=open]]:rounded-b-none">
                                            Table {tableNumber}
                                        </AccordionTrigger>
                                        <AccordionContent className="p-2 space-y-2">
                                            {tableSessions.map(session => (
                                                 <Card key={session.id} className="bg-muted/30">
                                                    <CardContent className="p-3">
                                                        <div className="flex justify-between items-center">
                                                            <p className="text-xs text-muted-foreground">
                                                                {format(session.lastActivity, 'p')}
                                                            </p>
                                                            <div className="text-right">
                                                                <Badge variant="default">Completed</Badge>
                                                                <p className="font-bold text-lg">₹{session.totalAmount.toFixed(2)}</p>
                                                            </div>
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                ) : (
                    <p className="text-muted-foreground text-center py-8 bg-muted/10 rounded-lg border border-dashed">No completed orders yet.</p>
                )}
            </div>
        </div>
    </div>
  );
}
