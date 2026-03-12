
'use client';

import { Order, Store } from '@/lib/types';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
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
  Phone,
  ArrowRight,
  Video,
  ExternalLink
} from 'lucide-react';
import Link from 'next/link';
import {
  collection, query, where, orderBy, doc, writeBatch, updateDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { markSessionAsPaid } from '@/app/actions';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';


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


function SessionCard({ session, isUpdating }: { session: Session; isUpdating: boolean }) {
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
                 <CardTitle className="text-xl text-primary font-bold">Table {session.tableNumber || 'N/A'}</CardTitle>
                 <CardDescription className="text-[10px] font-mono">Session: {session.id.slice(-6)}</CardDescription>
            </div>
             <Badge variant={meta?.variant || 'secondary'} className="px-2 py-0.5">
                {session.status}
             </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest">Order Details</h4>
          <div className="max-h-32 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
            {session.orders.flatMap(o => o.items).map((item, index) => (
              <div key={index} className="flex justify-between items-center text-[11px] p-2 bg-muted/50 rounded-lg">
                <span className="font-bold">{item.productName} <span className="opacity-50">x{item.quantity}</span></span>
                <span className="font-black">₹{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="border-t pt-4 space-y-4">
            <div className="flex justify-between font-black text-lg">
                <span className="opacity-60 text-sm uppercase tracking-tighter">Total Bill</span>
                <span className="text-primary">₹{session.totalAmount.toFixed(2)}</span>
            </div>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button 
                        className={session.status === 'Billed' ? 'w-full h-12 bg-green-600 hover:bg-green-700 rounded-xl shadow-lg' : 'w-full rounded-xl'}
                        variant={session.status === 'Billed' ? 'default' : 'outline'}
                        disabled={isUpdating || isCompleting || session.status === 'Completed'}
                    >
                        {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                        {session.status === 'Billed' ? 'Receive Payment' : 'Confirm Order'}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2rem]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Finalize Session?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will confirm that payment has been received for Table {session.tableNumber} and close the session.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmPayment} className="rounded-xl bg-green-600">Yes, Confirm Payment</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
            {session.status === 'Billed' && (
                <div className="flex items-center justify-center gap-2 text-[10px] font-black uppercase text-green-600 animate-pulse">
                    <AlertTriangle className="h-3 w-3" /> Ready to Pay
                </div>
            )}
        </div>
      </CardContent>
    </Card>
  )
}

function DeliveryOrderCard({ order, store, onStatusChange, isUpdating }: { order: Order; store?: Store; onStatusChange: (id: string, status: Order['status']) => void; isUpdating: boolean }) {
    const meta = STATUS_META[order.status] || STATUS_META.Pending;

    const handleOpenMap = () => {
        if (!order.deliveryLat || !order.deliveryLng) {
            const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`;
            window.open(url, '_blank');
            return;
        }
        let url = `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLat},${order.deliveryLng}`;
        if (store?.latitude && store?.longitude) {
            url += `&origin=${store.latitude},${store.longitude}`;
        }
        window.open(url, '_blank');
    };

    return (
        <Card className="border-l-4 border-l-blue-500 shadow-xl overflow-hidden rounded-2xl transition-all hover:scale-[1.02]">
            <CardHeader className="pb-3 bg-muted/20">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-blue-600" />
                            <CardTitle className="text-base font-black uppercase tracking-tight">Delivery #{order.id.slice(-6)}</CardTitle>
                        </div>
                        <CardDescription className="text-[10px] font-bold opacity-60">{format((order.orderDate as Timestamp).toDate(), 'p, PPP')}</CardDescription>
                    </div>
                    <Badge variant={meta.variant} className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">{order.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                <div 
                    className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 space-y-3 text-xs cursor-pointer hover:bg-blue-100/50 transition-colors group"
                    onClick={handleOpenMap}
                    title="Click to open directions in Google Maps"
                >
                    <div className="flex items-start gap-3">
                        <Users className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span className="font-black text-blue-900">{order.customerName}</span>
                    </div>
                    <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="flex flex-col min-w-0">
                            <span className="font-bold text-blue-800 leading-relaxed break-words">{order.deliveryAddress}</span>
                            <span className="text-[9px] text-blue-600 font-black uppercase mt-1 flex items-center gap-1 opacity-60 group-hover:opacity-100">
                                <ExternalLink className="h-2.5 w-2.5" /> Tap to open maps
                            </span>
                        </div>
                    </div>
                    <div className="flex items-start gap-3">
                        <Phone className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span className="font-black text-blue-900 tracking-tighter">{order.phone}</span>
                    </div>
                </div>

                <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest opacity-40">Order Items</h4>
                    <div className="max-h-24 overflow-y-auto space-y-1 custom-scrollbar">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[11px] font-bold p-1">
                                <span>{item.productName} <span className="opacity-40">x{item.quantity}</span></span>
                                <span className="font-black">₹{(item.price * item.quantity).toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between font-black border-t border-black/5 pt-2 mt-2">
                        <span className="text-[10px] uppercase opacity-40">Grand Total</span>
                        <span className="text-base text-primary">₹{order.totalAmount.toFixed(2)}</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-black/5 pt-4 bg-muted/10">
                <div className="w-full space-y-1.5">
                    <Label className="text-[9px] uppercase font-black tracking-widest opacity-40 px-1">Quick Status Update</Label>
                    <Select 
                        value={order.status} 
                        onValueChange={(val) => onStatusChange(order.id, val as Order['status'])}
                        disabled={isUpdating || ['Delivered', 'Completed'].includes(order.status)}
                    >
                        <SelectTrigger className="w-full h-11 rounded-xl font-bold bg-white border-2">
                            <SelectValue placeholder="Update status..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="Pending">New Order</SelectItem>
                            <SelectItem value="Processing">In Kitchen</SelectItem>
                            <SelectItem value="Out for Delivery">Sent for Delivery</SelectItem>
                            <SelectItem value="Delivered">Delivered</SelectItem>
                            <SelectItem value="Cancelled">Cancelled</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                
                <div className="grid grid-cols-2 gap-2 w-full">
                    {order.status === 'Pending' && (
                        <Button onClick={() => onStatusChange(order.id, 'Processing')} disabled={isUpdating} className="w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-[10px] uppercase tracking-widest">
                            Accept & Start
                        </Button>
                    )}
                    {order.status === 'Processing' && (
                        <Button onClick={() => onStatusChange(order.id, 'Out for Delivery')} disabled={isUpdating} className="w-full h-11 rounded-xl bg-orange-600 hover:bg-orange-700 font-black text-[10px] uppercase tracking-widest">
                            Mark Out
                        </Button>
                    )}
                    {order.status === 'Out for Delivery' && (
                        <Button onClick={() => onStatusChange(order.id, 'Delivered')} disabled={isUpdating} className="w-full h-11 rounded-xl bg-green-600 hover:bg-green-700 font-black text-[10px] uppercase tracking-widest">
                            Confirm Delivered
                        </Button>
                    )}
                    <Button variant="outline" className="w-full h-11 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest" asChild>
                        <Link href={`/menu/${order.storeId}?orderId=${order.id}`}>
                            <Video className="mr-2 h-3.5 w-3.5" /> Track
                        </Link>
                    </Button>
                </div>
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

  const { sessions, homeDeliveries, allCompletedOrders } = useMemo(() => {
    const tableSessions: Record<string, Session> = {};
    const directDeliveries: Order[] = [];
    const completed: Order[] = [];

    if (!orders) return { sessions: tableSessions, homeDeliveries: directDeliveries, allCompletedOrders: completed };

    orders.forEach(order => {
        if (order.status === 'Draft') return;

        // Collect all completed or delivered orders for the summary section
        if (['Completed', 'Delivered'].includes(order.status)) {
            completed.push(order);
        }

        if (order.tableNumber && order.sessionId) {
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
        } else if (!order.tableNumber) {
            directDeliveries.push(order);
        }
    });

    return { sessions: tableSessions, homeDeliveries: directDeliveries, allCompletedOrders: completed };
  }, [orders]);
  
  useEffect(() => {
    Object.values(sessions).forEach(session => {
        if(session.status === 'Billed' && !billedSessionIds.current.has(session.id)) {
            playNotificationSound();
            toast({
                title: 'Table Payment Requested',
                description: `Table ${session.tableNumber} is ready to pay. Check the floor map.`,
                duration: 10000,
            });
            billedSessionIds.current.add(session.id);
        } else if (session.status !== 'Billed') {
             billedSessionIds.current.delete(session.id);
        }
    });

    homeDeliveries.forEach(order => {
        if (order.status === 'Pending' && !pendingOrderIds.current.has(order.id)) {
            playNotificationSound();
            toast({
                title: 'New Delivery Order!',
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

  const handleOrderUpdate = (orderId: string, newStatus: Order['status']) => {
      if (!firestore) return;
      startUpdateTransition(async () => {
          try {
              const orderRef = doc(firestore, 'orders', orderId);
              await updateDoc(orderRef, { status: newStatus, updatedAt: serverTimestamp() });
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
    <div className="container mx-auto py-8 px-4 md:px-6 max-w-7xl">
        <div className="mb-10 flex flex-col md:flex-row justify-between md:items-end gap-6 border-b pb-8 border-black/5">
            <div>
                <h1 className="text-5xl font-black font-headline tracking-tighter">Live Operations</h1>
                <p className="text-muted-foreground font-bold mt-2 uppercase text-[10px] tracking-widest">Managing: {myStore?.name || 'Loading Store...'}</p>
            </div>
            <div className="flex gap-3">
                <Button asChild variant="outline" className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2">
                    <Link href="/dashboard/owner/sales-report">
                        <BarChart3 className="mr-2 h-4 w-4" /> Reports
                    </Link>
                </Button>
                <Button asChild className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-primary shadow-lg">
                    <Link href="/dashboard/owner/menu-manager">
                        <ArrowRight className="mr-2 h-4 w-4" /> Menu Manager
                    </Link>
                </Button>
            </div>
        </div>

        <div className="space-y-20">
            {/* --- HOME DELIVERIES SECTION --- */}
            <section className="bg-blue-50/30 p-8 rounded-[3rem] border border-blue-100/50 shadow-inner">
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <div className="bg-blue-600 p-3 rounded-2xl shadow-blue-200 shadow-xl">
                            <Truck className="h-6 w-6 text-white" />
                        </div>
                        <h2 className="text-3xl font-black font-headline tracking-tight text-blue-900">Delivery Orders</h2>
                    </div>
                    <Badge className="bg-blue-600 text-white font-black px-3 py-1 rounded-full">{homeDeliveries.filter(o => !['Delivered', 'Completed', 'Cancelled'].includes(o.status)).length} Active</Badge>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {homeDeliveries.filter(o => !['Delivered', 'Completed', 'Cancelled'].includes(o.status)).length > 0 ? (
                        homeDeliveries
                            .filter(o => !['Delivered', 'Completed', 'Cancelled'].includes(o.status))
                            .map(order => (
                                <DeliveryOrderCard 
                                    key={order.id} 
                                    order={order} 
                                    store={myStore}
                                    onStatusChange={handleOrderUpdate} 
                                    isUpdating={isUpdating} 
                                />
                            ))
                    ) : (
                        <Card className="col-span-full border-dashed bg-white/50 border-blue-200/50 py-16 flex flex-col items-center justify-center text-muted-foreground rounded-3xl">
                            <Package className="h-12 w-12 mb-3 opacity-10 text-blue-600" />
                            <p className="font-bold text-xs uppercase tracking-widest opacity-40">No pending deliveries</p>
                        </Card>
                    )}
                </div>
            </section>

            {/* --- TABLE FLOOR MAP SECTION --- */}
            <section>
                <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="bg-green-600 p-3 rounded-2xl shadow-green-200 shadow-xl">
                            <Users className="h-6 w-6 text-white" />
                        </div>
                        <h2 className="text-3xl font-black font-headline tracking-tight">Table Floor Map</h2>
                    </div>
                    <div className="flex flex-wrap gap-4 text-[9px] font-black uppercase tracking-[0.15em] opacity-60">
                        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full"><div className="h-2 w-2 rounded-full bg-green-500 shadow-sm shadow-green-200" /> Available</div>
                        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full"><div className="h-2 w-2 rounded-full bg-blue-500 shadow-sm shadow-blue-200" /> In Service</div>
                        <div className="flex items-center gap-2 bg-muted/50 px-3 py-1.5 rounded-full"><div className="h-2 w-2 rounded-full bg-orange-500 shadow-sm shadow-orange-200" /> Billing</div>
                    </div>
                </div>
                 {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        <Skeleton className="h-64 w-full rounded-[2rem]" /><Skeleton className="h-64 w-full rounded-[2rem]" /><Skeleton className="h-64 w-full rounded-[2rem]" /><Skeleton className="h-64 w-full rounded-[2rem]" />
                    </div>
                ) : myStore?.tables && myStore.tables.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {myStore.tables.map(tableNumber => {
                            const activeSession = activeSessionsByTable[tableNumber];
                            return activeSession ? (
                                <SessionCard key={activeSession.id} session={activeSession} isUpdating={isUpdating} />
                            ) : (
                                <EmptyTableCard key={tableNumber} tableNumber={tableNumber} />
                            )
                        })}
                    </div>
                ) : (
                    <Card className="bg-muted/10 border-dashed border-2 rounded-[3rem] py-16">
                        <CardHeader className="text-center">
                            <CardTitle className="text-2xl font-black">No Tables Configured</CardTitle>
                            <CardDescription className="max-w-xs mx-auto text-xs font-bold leading-relaxed mt-2 uppercase tracking-tight">Setup your floor plan in store settings to start accepting table orders.</CardDescription>
                        </CardHeader>
                        <CardFooter className="justify-center">
                            <Button asChild variant="secondary" className="h-12 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest"><Link href="/dashboard/owner/my-store">Go to Store Settings</Link></Button>
                        </CardFooter>
                     </Card>
                )}
            </section>

             {/* --- RECENT COMPLETED ORDERS (Unified) --- */}
             {allCompletedOrders.length > 0 && (
                <section className="pt-12 border-t border-black/5">
                    <h2 className="text-[10px] font-black uppercase tracking-[0.4em] mb-8 opacity-30 text-center">Recent Completed Orders</h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {allCompletedOrders
                            .slice(0, 12)
                            .map(order => (
                                <Card key={order.id} className="bg-white border-0 shadow-sm rounded-2xl group transition-all hover:shadow-md hover:scale-[1.02]">
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <div className="min-w-0 pr-4">
                                            <p className="font-black text-[11px] truncate leading-tight mb-0.5">
                                                {order.tableNumber ? `Table ${order.tableNumber}` : order.customerName}
                                            </p>
                                            <p className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">
                                                {format((order.orderDate as Timestamp).toDate(), 'p')}
                                            </p>
                                        </div>
                                        <div className="text-right shrink-0">
                                            <Badge variant="outline" className="text-[8px] font-black uppercase border-green-500/20 text-green-600 bg-green-50 px-1.5 py-0 mb-1 rounded-sm">
                                                {order.status === 'Delivered' ? 'Delivered' : 'Paid'}
                                            </Badge>
                                            <p className="font-black text-xs text-primary tracking-tighter">₹{order.totalAmount.toFixed(0)}</p>
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
