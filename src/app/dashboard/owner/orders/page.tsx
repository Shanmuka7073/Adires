
'use client';

import { Order, Store } from '@/lib/types';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter
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
  Users,
  MapPin,
  Phone
} from 'lucide-react';

import {
  collection, query, where, orderBy, doc, writeBatch
} from 'firebase/firestore';

import { useFirebase, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
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

function DeliveryOrderCard({ order, onStatusChange, isUpdating }: { order: Order; onStatusChange: (id: string, status: Order['status']) => void; isUpdating: boolean }) {
    const meta = STATUS_META[order.status] || STATUS_META.Pending;
    const Icon = meta.icon;

    return (
        <Card className="border-l-4 border-l-blue-500 shadow-md">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                    <div>
                        <CardTitle className="text-lg">Delivery Order</CardTitle>
                        <CardDescription className="text-xs">{format((order.orderDate as Timestamp).toDate(), 'p, PPP')}</CardDescription>
                    </div>
                    <Badge variant={meta.variant}>{order.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="bg-muted/30 p-3 rounded-lg space-y-2 text-sm">
                    <div className="flex items-start gap-2">
                        <Users className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="font-bold">{order.customerName}</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span>{order.deliveryAddress}</span>
                    </div>
                    <div className="flex items-start gap-2">
                        <Phone className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="font-mono">{order.phone}</span>
                    </div>
                </div>

                <div className="space-y-1">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-xs">
                            <span>{item.productName} x{item.quantity}</span>
                            <span className="font-mono">₹{(item.price * item.quantity).toFixed(0)}</span>
                        </div>
                    ))}
                    <div className="flex justify-between font-bold border-t pt-2 mt-2">
                        <span>Total</span>
                        <span>₹{order.totalAmount.toFixed(2)}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex gap-2 border-t pt-4">
                {order.status === 'Pending' && (
                    <Button onClick={() => onStatusChange(order.id, 'Processing')} disabled={isUpdating} size="sm" className="flex-1">
                        Accept & Process
                    </Button>
                )}
                {order.status === 'Processing' && (
                    <Button onClick={() => onStatusChange(order.id, 'Out for Delivery')} disabled={isUpdating} size="sm" className="flex-1">
                        Ready for Delivery
                    </Button>
                )}
                {order.status === 'Out for Delivery' && (
                    <p className="text-xs text-center w-full text-muted-foreground italic flex items-center justify-center gap-1">
                        <Truck className="h-3 w-3" /> Waiting for delivery partner...
                    </p>
                )}
                {['Delivered', 'Completed'].includes(order.status) && (
                    <p className="text-xs text-center w-full text-green-600 font-bold flex items-center justify-center gap-1">
                        <CheckCircle className="h-3 w-3" /> Order Fulfilled
                    </p>
                )}
            </CardFooter>
        </Card>
    );
}

export default function StoreOrdersPage() {
  const { firestore, user } = useFirebase();
  const [isUpdating, startUpdateTransition] = useTransition();
  const { toast } = useToast();
  const billedSessionIds = useRef<Set<string>>(new Set());
  const pendingOrderIds = useRef<Set<string>>(new Set());

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

  const { sessions, homeDeliveries } = useMemo(() => {
    const tableSessions: Record<string, Session> = {};
    const directDeliveries: Order[] = [];

    if (!orders) return { sessions: tableSessions, homeDeliveries: directDeliveries };

    orders.forEach(order => {
        if (order.tableNumber && order.sessionId) {
            // It's a table order
            const sessionId = order.sessionId;
            if (!tableSessions[sessionId]) {
                tableSessions[sessionId] = {
                    id: sessionId,
                    tableNumber: order.tableNumber,
                    orders: [],
                    totalAmount: 0,
                    status: 'Pending',
                    lastActivity: new Date(0),
                };
            }
            tableSessions[sessionId].orders.push(order);
            tableSessions[sessionId].totalAmount += order.totalAmount;
            const orderDate = (order.orderDate as Timestamp).toDate();
            if (orderDate > tableSessions[sessionId].lastActivity) {
                tableSessions[sessionId].lastActivity = orderDate;
                tableSessions[sessionId].status = order.status;
            }
        } else {
            // It's a home order (no table number)
            directDeliveries.push(order);
        }
    });

    return { sessions: tableSessions, homeDeliveries: directDeliveries };
  }, [orders]);
  
  useEffect(() => {
    // 1. Monitor Table Sessions for "Ready to Pay"
    Object.values(sessions).forEach(session => {
        if(session.status === 'Billed' && !billedSessionIds.current.has(session.id)) {
            playNotificationSound();
            toast({
                title: 'Payment Request',
                description: `Table ${session.tableNumber} is ready to pay.`,
                duration: 10000,
            });
            billedSessionIds.current.add(session.id);
        } else if (session.status !== 'Billed') {
             billedSessionIds.current.delete(session.id);
        }
    });

    // 2. Monitor Home Deliveries for "New Incoming"
    homeDeliveries.forEach(order => {
        if (order.status === 'Pending' && !pendingOrderIds.current.has(order.id)) {
            playNotificationSound();
            toast({
                title: 'New Home Order!',
                description: `Incoming delivery for ${order.customerName}.`,
                variant: 'default',
                duration: 15000,
            });
            pendingOrderIds.current.add(order.id);
        } else if (order.status !== 'Pending') {
            pendingOrderIds.current.delete(order.id);
        }
    });
  }, [sessions, homeDeliveries, toast]);

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
        toast({ title: 'Session Updated', description: `Table ${session.tableNumber} marked as ${newStatus}.`});
    });
  };

  const handleOrderUpdate = (orderId: string, newStatus: Order['status']) => {
      if (!firestore) return;
      startUpdateTransition(async () => {
          try {
              const orderRef = doc(firestore, 'orders', orderId);
              await updateDoc(orderRef, { status: newStatus });
              toast({ title: "Order Updated", description: `Order status changed to ${newStatus}.` });
          } catch (e) {
              console.error(e);
              toast({ variant: 'destructive', title: "Update Failed" });
          }
      });
  }

  const activeSessionsByTable = useMemo(() => {
      const map: Record<string, Session> = {};
      Object.values(sessions).forEach(s => {
          if (s.status !== 'Completed' && s.status !== 'Cancelled' && s.tableNumber) {
              map[s.tableNumber] = s;
          }
      });
      return map;
  }, [sessions]);
  
  const isLoading = storeLoading || ordersLoading;

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
        <div className="mb-8 flex flex-col md:flex-row justify-between md:items-center gap-4">
            <div>
                <h1 className="text-4xl font-bold font-headline">Live Orders Dashboard</h1>
                <p className="text-muted-foreground">Monitor table sessions and home deliveries in real-time.</p>
            </div>
            <div className="flex gap-2">
                <Button asChild variant="outline">
                    <Link href="/dashboard/owner/sales-report">
                        <BarChart3 className="mr-2 h-4 w-4" />
                        Sales Reports
                    </Link>
                </Button>
            </div>
        </div>

        <div className="space-y-16">
            {/* --- HOME DELIVERIES SECTION --- */}
            {homeDeliveries.some(o => o.status !== 'Completed' && o.status !== 'Delivered') && (
                <section>
                    <div className="flex items-center gap-2 mb-6">
                        <div className="bg-blue-500 p-2 rounded-lg">
                            <Truck className="h-6 w-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold font-headline">Pending Home Deliveries</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {homeDeliveries
                            .filter(o => o.status !== 'Completed' && o.status !== 'Delivered')
                            .map(order => (
                                <DeliveryOrderCard 
                                    key={order.id} 
                                    order={order} 
                                    onStatusChange={handleOrderUpdate} 
                                    isUpdating={isUpdating} 
                                />
                            ))
                        }
                    </div>
                </section>
            )}

            {/* --- TABLE FLOOR MAP SECTION --- */}
            <section>
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <div className="bg-green-500 p-2 rounded-lg">
                            <Users className="h-6 w-6 text-white" />
                        </div>
                        <h2 className="text-2xl font-bold font-headline">Table Floor Map</h2>
                    </div>
                    <div className="flex gap-4 text-[10px] md:text-xs uppercase font-bold tracking-wider">
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
                            <CardDescription>Go to "My Store" settings to add your restaurant tables.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Button asChild variant="outline"><Link href="/dashboard/owner/my-store">Go to Store Settings</Link></Button>
                        </CardContent>
                     </Card>
                )}
            </section>

             {/* --- COMPLETED DELIVERIES --- */}
             {homeDeliveries.some(o => o.status === 'Completed' || o.status === 'Delivered') && (
                <section>
                    <h2 className="text-xl font-semibold mb-4 text-muted-foreground">Recent Completed Deliveries</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {homeDeliveries
                            .filter(o => o.status === 'Completed' || o.status === 'Delivered')
                            .slice(0, 6)
                            .map(order => (
                                <Card key={order.id} className="bg-muted/20 border-0">
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <div>
                                            <p className="font-bold text-sm">{order.customerName}</p>
                                            <p className="text-[10px] text-muted-foreground">{format((order.orderDate as Timestamp).toDate(), 'p')}</p>
                                        </div>
                                        <div className="text-right">
                                            <Badge variant="default" className="text-[10px]">Delivered</Badge>
                                            <p className="font-black text-sm">₹{order.totalAmount.toFixed(0)}</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        }
                    </div>
                </section>
             )}
        </div>
    </div>
  );
}
