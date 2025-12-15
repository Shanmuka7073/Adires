

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
  BarChart3
} from 'lucide-react';

import {
  collection, query, where, orderBy, doc, writeBatch
} from 'firebase/firestore';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useMemo, useState, useTransition, useRef } from 'react';
import { format } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import Link from 'next/link';
import { markSessionAsPaid } from '@/app/actions';


const STATUS_META: Record<string, any> = {
  Pending: { icon: AlertTriangle, variant: 'secondary' },
  Processing: { icon: CookingPot, variant: 'secondary' },
  'Out for Delivery': { icon: Truck, variant: 'outline' },
  Billed: { icon: Check, variant: 'default' },
  Completed: { icon: CheckCircle, variant: 'default' },
  Delivered: { icon: CheckCircle, variant: 'default' },
  Cancelled: { icon: AlertTriangle, variant: 'destructive' },
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

  return (
    <Card className={session.status === 'Billed' ? 'border-primary ring-2 ring-primary' : ''}>
      <CardHeader>
        <div className="flex justify-between items-center">
            <div>
                 <CardTitle>Table {session.tableNumber || 'N/A'}</CardTitle>
                 <CardDescription>Session ID: {session.id.slice(0, 8)}</CardDescription>
            </div>
             <Badge variant={STATUS_META[session.status]?.variant || 'secondary'} className="text-lg">
                {session.status}
             </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-semibold mb-2">Items Ordered:</h4>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {session.orders.flatMap(o => o.items).map((item, index) => (
              <div key={index} className="flex justify-between items-center text-sm p-2 bg-muted/50 rounded-md">
                <span>{item.productName} <span className="text-muted-foreground">x{item.quantity}</span></span>
                <span className="font-medium">₹{(item.price * item.quantity).toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-4 space-y-4">
            <div className="flex justify-between font-bold text-xl">
                <span>Total Bill</span>
                <span>₹{session.totalAmount.toFixed(2)}</span>
            </div>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button 
                        className={session.status === 'Billed' ? 'w-full bg-green-600 hover:bg-green-700' : 'w-full'}
                        variant={session.status === 'Billed' ? 'default' : 'outline'}
                        disabled={isUpdating || isCompleting || session.status === 'Completed'}
                    >
                        <Check className="mr-2 h-4 w-4" /> Confirm Payment & Close
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Payment Received?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will mark the session as completed and cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmPayment}>Yes, Payment Received</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {session.status === 'Pending' && (
                <p className="text-xs text-center text-muted-foreground">Waiting for customer to close bill.</p>
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

  const { data: myStores } = useCollection<Store>(storeQuery);
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

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

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
                status: 'Pending', // Default status
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

  const activeSessions = Object.values(sessions).filter(s => s.status !== 'Completed' && s.status !== 'Cancelled');
  const completedSessions = Object.values(sessions).filter(s => s.status === 'Completed' || s.status === 'Cancelled');


  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
        <div className="mb-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
                <h1 className="text-4xl font-bold font-headline">Live Table Orders</h1>
                <p className="text-muted-foreground">Manage incoming orders from your restaurant tables.</p>
            </div>
            <Button asChild variant="outline">
                <Link href="/dashboard/owner/sales-report">
                    <BarChart3 className="mr-2 h-4 w-4" />
                    View Sales Report
                </Link>
            </Button>
        </div>

        <div className="space-y-8">
            <div>
                <h2 className="text-2xl font-semibold mb-4">Active & Billed Tables</h2>
                 {isLoading ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <Skeleton className="h-64 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </div>
                ) : activeSessions.length > 0 ? (
                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {activeSessions.sort((a,b) => b.lastActivity.getTime() - a.lastActivity.getTime()).map(session => (
                            <SessionCard key={session.id} session={session} onStatusChange={handleSessionStatusChange} isUpdating={isUpdating} />
                        ))}
                    </div>
                ) : (
                    <Card>
                        <CardHeader>
                            <CardTitle>No Active Orders</CardTitle>
                            <CardDescription>When customers order using a QR code, their live bills will appear here.</CardDescription>
                        </CardHeader>
                     </Card>
                )}
            </div>

             <div>
                <h2 className="text-2xl font-semibold mb-4 text-muted-foreground">Completed Sessions</h2>
                 {isLoading ? (
                    <Skeleton className="h-24 w-full" />
                ) : completedSessions.length > 0 ? (
                    <div className="space-y-4">
                        {completedSessions.sort((a,b) => b.lastActivity.getTime() - a.lastActivity.getTime()).map(session => (
                             <Card key={session.id} className="bg-muted/50">
                                <CardHeader>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <CardTitle className="text-base">Table {session.tableNumber || 'N/A'}</CardTitle>
                                             <p className="text-xs text-muted-foreground">
                                                {format(session.lastActivity, 'PPP p')}
                                             </p>
                                        </div>
                                        <div className="text-right">
                                             <Badge variant="default">Completed</Badge>
                                             <p className="font-bold text-lg">₹{session.totalAmount.toFixed(2)}</p>
                                        </div>
                                    </div>
                                </CardHeader>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <p className="text-muted-foreground text-center">No completed sessions yet.</p>
                )}
            </div>
        </div>
    </div>
  );
}
