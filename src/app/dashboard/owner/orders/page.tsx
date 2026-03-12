'use client';

import { Order, Store, OrderItem } from '@/lib/types';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { format, isSameDay } from 'date-fns';
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
  ExternalLink,
  Receipt,
  Eye,
  History,
  Clock,
  PlusCircle,
  Calendar as CalendarIcon,
  ChevronDown
} from 'lucide-react';
import Link from 'next/link';
import {
  collection, query, where, orderBy, doc, writeBatch, updateDoc, serverTimestamp, Timestamp
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { markSessionAsPaid } from '@/app/actions';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

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

/**
 * Detailed Dialog to show items for a specific order or session
 */
function ViewOrderDetailsDialog({ 
    items, 
    title, 
    isOpen, 
    onClose, 
    total 
}: { 
    items: OrderItem[]; 
    title: string; 
    isOpen: boolean; 
    onClose: () => void; 
    total: number;
}) {
    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-w-md rounded-3xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-primary" />
                        {title}
                    </DialogTitle>
                    <DialogDescription>Full item breakdown and billing summary.</DialogDescription>
                </DialogHeader>
                <div className="py-4">
                    <ScrollArea className="max-h-[50vh] pr-4">
                        <div className="space-y-3">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center p-3 bg-muted/30 rounded-xl">
                                    <div className="min-w-0 pr-4">
                                        <p className="font-bold text-sm truncate">{item.productName}</p>
                                        <p className="text-[10px] uppercase font-black opacity-40">Qty: {item.quantity} × ₹{item.price.toFixed(0)}</p>
                                    </div>
                                    <span className="font-black text-sm">₹{(item.price * item.quantity).toFixed(0)}</span>
                                </div>
                            ))}
                        </div>
                    </ScrollArea>
                    <div className="mt-6 pt-4 border-t border-dashed space-y-2">
                        <div className="flex justify-between items-baseline">
                            <span className="text-xs font-bold opacity-40 uppercase tracking-widest">Grand Total</span>
                            <span className="text-2xl font-black text-primary">₹{total.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={onClose} className="w-full rounded-xl h-12 font-bold">Close Details</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function EmptyTableCard({ tableNumber }: { tableNumber: string }) {
    return (
        <Card className="border-dashed bg-muted/20 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all cursor-default h-full flex flex-col justify-center items-center py-12 rounded-[2rem]">
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
    <Card className={cn(
        "rounded-[2rem] transition-all overflow-hidden h-full flex flex-col",
        session.status === 'Billed' ? 'border-primary ring-2 ring-primary bg-primary/5' : 'shadow-md border-0 bg-white'
    )}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
            <div>
                 <CardTitle className="text-xl text-primary font-black">Table {session.tableNumber || 'N/A'}</CardTitle>
                 <CardDescription className="text-[10px] font-mono opacity-40">Session: {session.id.slice(-6)}</CardDescription>
            </div>
             <Badge variant={meta?.variant || 'secondary'} className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">
                {session.status}
             </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        <div>
          <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest opacity-40">Active Bill</h4>
          <div className="max-h-32 overflow-y-auto space-y-1 pr-2 custom-scrollbar">
            {session.orders.flatMap(o => o.items).map((item, index) => (
              <div key={index} className="flex justify-between items-center text-[11px] p-2 bg-black/5 rounded-lg">
                <span className="font-bold truncate pr-2">{item.productName} <span className="opacity-40">x{item.quantity}</span></span>
                <span className="font-black shrink-0">₹{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4 border-t border-black/5 flex flex-col gap-3 bg-black/5">
            <div className="flex justify-between items-baseline w-full">
                <span className="opacity-40 text-[9px] font-black uppercase tracking-widest">Grand Total</span>
                <span className="text-xl font-black text-primary">₹{session.totalAmount.toFixed(2)}</span>
            </div>
            
            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button 
                        className={cn(
                            "w-full h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all",
                            session.status === 'Billed' ? 'bg-green-600 hover:bg-green-700' : 'bg-primary'
                        )}
                        disabled={isUpdating || isCompleting || session.status === 'Completed'}
                    >
                        {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                        {session.status === 'Billed' ? 'Receive Payment' : 'Confirm & Prep'}
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2.5rem]">
                    <AlertDialogHeader>
                        <AlertDialogTitle>Finalize Session?</AlertDialogTitle>
                        <AlertDialogDescription>
                            Confirm that payment has been received for Table {session.tableNumber} to clear the floor map.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleConfirmPayment} className="rounded-xl bg-green-600">Confirm Payment</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
      </CardFooter>
    </Card>
  )
}

function DeliveryOrderCard({ order, store, onStatusChange, isUpdating }: { order: Order; store?: Store; onStatusChange: (id: string, status: Order['status']) => void; isUpdating: boolean }) {
    const meta = STATUS_META[order.status] || STATUS_META.Pending;

    const handleOpenMap = () => {
        if (!order.deliveryLat || !order.deliveryLng) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.deliveryAddress)}`, '_blank');
            return;
        }
        let url = `https://www.google.com/maps/dir/?api=1&destination=${order.deliveryLat},${order.deliveryLng}`;
        if (store?.latitude && store?.longitude) url += `&origin=${store.latitude},${store.longitude}`;
        window.open(url, '_blank');
    };

    return (
        <Card className="border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-white flex flex-col h-full">
            <CardHeader className="pb-3 bg-blue-50/50 border-b border-blue-100/50">
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-blue-600" />
                            <CardTitle className="text-base font-black uppercase tracking-tight text-blue-950">Delivery #{order.id.slice(-6)}</CardTitle>
                        </div>
                        <CardDescription className="text-[10px] font-bold opacity-40">{format((order.orderDate as Timestamp).toDate(), 'p, PPP')}</CardDescription>
                    </div>
                    <Badge variant={meta.variant} className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">{order.status}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5 flex-1">
                <div 
                    className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100 space-y-3 text-xs cursor-pointer hover:bg-blue-100/50 transition-all active:scale-[0.98]"
                    onClick={handleOpenMap}
                >
                    <div className="flex items-start gap-3">
                        <Users className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <span className="font-black text-blue-900 truncate">{order.customerName}</span>
                    </div>
                    {order.phone && (
                        <div className="flex items-start gap-3">
                            <Phone className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                            <span className="font-black text-blue-900">{order.phone}</span>
                        </div>
                    )}
                    <div className="flex items-start gap-3">
                        <MapPin className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="font-bold text-blue-800 break-words leading-tight">{order.deliveryAddress}</p>
                            <span className="text-[8px] text-blue-600 font-black uppercase mt-1 flex items-center gap-1 opacity-40">
                                <ExternalLink className="h-2.5 w-2.5" /> Tap for Directions
                            </span>
                        </div>
                    </div>
                </div>

                <div className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-widest opacity-30">Order Summary</h4>
                    <div className="max-h-24 overflow-y-auto space-y-1 custom-scrollbar pr-2">
                        {order.items.map((item, idx) => (
                            <div key={idx} className="flex justify-between text-[11px] font-bold py-1 border-b border-black/5 last:border-0">
                                <span className="truncate pr-4">{item.productName} <span className="opacity-40">x{item.quantity}</span></span>
                                <span className="font-black">₹{(item.price * item.quantity).toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-black/5 pt-4 bg-black/5">
                <div className="flex justify-between items-baseline w-full mb-1">
                    <span className="text-[9px] uppercase font-black opacity-30 tracking-widest">Total Bill</span>
                    <span className="text-xl font-black text-primary">₹{order.totalAmount.toFixed(2)}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-2 w-full">
                    {order.status === 'Pending' ? (
                        <Button onClick={() => onStatusChange(order.id, 'Processing')} disabled={isUpdating} className="col-span-2 h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-[10px] uppercase tracking-widest shadow-lg">
                            Accept & Start Prep
                        </Button>
                    ) : order.status === 'Processing' ? (
                        <Button onClick={() => onStatusChange(order.id, 'Out for Delivery')} disabled={isUpdating} className="col-span-2 h-12 rounded-xl bg-orange-600 hover:bg-orange-700 font-black text-[10px] uppercase tracking-widest shadow-lg">
                            Mark Out for Delivery
                        </Button>
                    ) : (
                        <Button onClick={() => onStatusChange(order.id, 'Delivered')} disabled={isUpdating} className="col-span-2 h-12 rounded-xl bg-green-600 hover:bg-green-700 font-black text-[10px] uppercase tracking-widest shadow-lg">
                            Confirm Delivered
                        </Button>
                    )}
                </div>
            </CardFooter>
        </Card>
    );
}

export default function StoreOrdersPage() {
  const { firestore, user } = useFirebase();
  const [isUpdating, startUpdateTransition] = useTransition();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<{ items: OrderItem[], title: string, total: number } | null>(null);

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

  const { sessions, homeDeliveries, completedDeliveries, completedTableSessions } = useMemo(() => {
    const tableSessions: Record<string, Session> = {};
    const directDeliveries: Order[] = [];
    const doneDeliveries: Order[] = [];
    const doneTableSessions: Session[] = [];

    if (!orders) return { sessions: tableSessions, homeDeliveries: directDeliveries, completedDeliveries: doneDeliveries, completedTableSessions: doneTableSessions };

    orders.forEach(order => {
        if (order.status === 'Draft') return;

        const orderDate = (order.orderDate as Timestamp).toDate();
        const isSelectedDay = selectedDate ? isSameDay(orderDate, selectedDate) : true;

        if (order.tableNumber && order.sessionId) {
            const sid = order.sessionId;
            if (['Completed', 'Delivered'].includes(order.status)) {
                if (!isSelectedDay) return;
                // Find or create a history session grouping
                let hSid = doneTableSessions.find(s => s.id === sid);
                if (!hSid) {
                    hSid = { id: sid, tableNumber: order.tableNumber, orders: [], totalAmount: 0, status: 'Completed', lastActivity: orderDate };
                    doneTableSessions.push(hSid);
                }
                hSid.orders.push(order);
                hSid.totalAmount += order.totalAmount;
            } else {
                // Active session
                if (!tableSessions[sid]) {
                    tableSessions[sid] = { id: sid, tableNumber: order.tableNumber, orders: [], totalAmount: 0, status: 'Pending', lastActivity: new Date(0) };
                }
                tableSessions[sid].orders.push(order);
                tableSessions[sid].totalAmount += order.totalAmount;
                if (orderDate > tableSessions[sid].lastActivity) {
                    tableSessions[sid].lastActivity = orderDate;
                    tableSessions[sid].status = order.status;
                }
            }
        } else {
            if (['Delivered', 'Completed'].includes(order.status)) {
                if (!isSelectedDay) return;
                doneDeliveries.push(order);
            } else {
                directDeliveries.push(order);
            }
        }
    });

    return { sessions: tableSessions, homeDeliveries: directDeliveries, completedDeliveries: doneDeliveries, completedTableSessions: doneTableSessions };
  }, [orders, selectedDate]);

  const handleOrderUpdate = (orderId: string, newStatus: Order['status']) => {
      if (!firestore) return;
      startUpdateTransition(async () => {
          try {
              const orderRef = doc(firestore, 'orders', orderId);
              await updateDoc(orderRef, { status: newStatus, updatedAt: serverTimestamp() });
              toast({ title: "Order Updated", description: `Changed to ${newStatus}.` });
          } catch (e) {
              toast({ variant: 'destructive', title: "Update Failed" });
          }
      });
  }

  const activeSessionsByTable = useMemo(() => {
      const map: Record<string, Session> = {};
      Object.values(sessions).forEach(s => {
          if (s.tableNumber) map[s.tableNumber] = s;
      });
      return map;
  }, [sessions]);
  
  const isLoading = storeLoading || ordersLoading;

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 max-w-7xl">
        {selectedHistoryItems && (
            <ViewOrderDetailsDialog 
                isOpen={!!selectedHistoryItems} 
                onClose={() => setSelectedHistoryItems(null)} 
                title={selectedHistoryItems.title}
                items={selectedHistoryItems.items}
                total={selectedHistoryItems.total}
            />
        )}

        <div className="mb-12 flex flex-col md:flex-row justify-between md:items-end gap-6 border-b pb-10 border-black/5">
            <div>
                <h1 className="text-6xl font-black font-headline tracking-tighter">Kitchen POS</h1>
                <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">STORE: {myStore?.name || '...'}</p>
            </div>
            <div className="flex gap-3">
                <Button asChild variant="outline" className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest border-2 hover:bg-black/5 transition-all">
                    <Link href="/dashboard/owner/sales-report">
                        <BarChart3 className="mr-2 h-4 w-4" /> Reports & Profit
                    </Link>
                </Button>
                <Button asChild className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase tracking-widest bg-primary shadow-xl shadow-primary/20 hover:scale-105 active:scale-95 transition-all">
                    <Link href="/dashboard/owner/menu-manager">
                        <PlusCircle className="mr-2 h-4 w-4" /> Manage Menu
                    </Link>
                </Button>
            </div>
        </div>

        <div className="space-y-24">
            {/* --- ACTIVE HOME DELIVERIES --- */}
            <section>
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-blue-600 p-3 rounded-[1.2rem] shadow-2xl shadow-blue-200">
                        <Truck className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black font-headline tracking-tight text-blue-950 uppercase">Home Delivery</h2>
                        <p className="text-[10px] font-bold text-blue-600/60 uppercase tracking-widest">Live prepping & tracking</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {homeDeliveries.length > 0 ? (
                        homeDeliveries.map(order => (
                            <DeliveryOrderCard key={order.id} order={order} store={myStore} onStatusChange={handleOrderUpdate} isUpdating={isUpdating} />
                        ))
                    ) : (
                        <Card className="col-span-full border-dashed border-2 bg-blue-50/20 border-blue-200/50 py-20 flex flex-col items-center justify-center rounded-[3rem]">
                            <Package className="h-16 w-16 mb-4 opacity-5 text-blue-600" />
                            <p className="font-black text-[10px] uppercase tracking-[0.3em] opacity-30 text-blue-900">No active delivery orders</p>
                        </Card>
                    )}
                </div>
            </section>

            {/* --- ACTIVE TABLE FLOOR MAP --- */}
            <section>
                <div className="flex items-center gap-4 mb-8">
                    <div className="bg-green-600 p-3 rounded-[1.2rem] shadow-2xl shadow-green-200">
                        <Users className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <h2 className="text-3xl font-black font-headline tracking-tight text-green-950 uppercase">Table Service</h2>
                        <p className="text-[10px] font-bold text-green-600/60 uppercase tracking-widest">Active floor map & sessions</p>
                    </div>
                </div>
                 {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
                        <Skeleton className="h-64 w-full rounded-[2.5rem]" /><Skeleton className="h-64 w-full rounded-[2.5rem]" />
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
                    <Card className="bg-muted/5 border-dashed border-2 rounded-[3rem] py-20 flex flex-col items-center justify-center">
                        <Users className="h-16 w-16 mb-4 opacity-5" />
                        <p className="font-black text-[10px] uppercase tracking-[0.3em] opacity-30 mb-6">No tables configured</p>
                        <Button asChild variant="secondary" className="h-12 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest"><Link href="/dashboard/owner/my-store">Set Floor Plan</Link></Button>
                     </Card>
                )}
            </section>

             {/* --- RECENT COMPLETED SECTION --- */}
             <section className="pt-16 border-t-2 border-black/5">
                <div className="flex flex-col items-center gap-6 mb-12">
                    <div className="flex items-center gap-3">
                        <History className="h-5 w-5 opacity-20" />
                        <h2 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Transaction History</h2>
                    </div>
                    
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button variant="outline" className="h-14 px-8 rounded-[1.2rem] border-2 flex items-center gap-4 group transition-all hover:bg-primary/5 hover:border-primary/30">
                                <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                                    <CalendarIcon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="text-left">
                                    <p className="text-[9px] font-black uppercase tracking-widest opacity-40">Viewing History For</p>
                                    <p className="text-lg font-black tracking-tight">{selectedDate ? format(selectedDate, "MMMM dd, yyyy") : "All Time"}</p>
                                </div>
                                <ChevronDown className="h-4 w-4 opacity-20 ml-4" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0 rounded-3xl overflow-hidden shadow-2xl border-0" align="center">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={setSelectedDate}
                                initialFocus
                                disabled={(date) => date > new Date()}
                            />
                        </PopoverContent>
                    </Popover>
                </div>

                <div className="space-y-12">
                    {/* Sub-heading: Home Delivery History */}
                    {completedDeliveries.length > 0 ? (
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest mb-6 px-2 text-blue-600/60 border-l-4 border-blue-600 pl-4">Completed Home Deliveries</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {completedDeliveries.slice(0, 12).map(order => (
                                    <Card 
                                        key={order.id} 
                                        className="bg-white border-0 shadow-sm rounded-2xl cursor-pointer transition-all hover:shadow-lg active:scale-95 group"
                                        onClick={() => setSelectedHistoryItems({ items: order.items, title: `Delivery #${order.id.slice(-6)}`, total: order.totalAmount })}
                                    >
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <div className="min-w-0 pr-4">
                                                <p className="font-black text-[11px] truncate leading-tight mb-0.5 group-hover:text-primary transition-colors">{order.customerName}</p>
                                                <p className="text-[9px] font-bold opacity-40 uppercase tracking-tighter flex items-center gap-1">
                                                    <Clock className="h-2 w-2" /> {format((order.orderDate as Timestamp).toDate(), 'p')}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <Badge variant="outline" className="text-[8px] font-black uppercase border-blue-500/20 text-blue-600 bg-blue-50 px-1.5 py-0 mb-1 rounded-sm">Delivered</Badge>
                                                <p className="font-black text-xs text-primary tracking-tighter">₹{order.totalAmount.toFixed(0)}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : selectedDate && (
                        <div className="text-center py-6 opacity-30">
                            <p className="text-[9px] font-black uppercase tracking-widest">No home deliveries on this date</p>
                        </div>
                    )}

                    {/* Sub-heading: Table History */}
                    {completedTableSessions.length > 0 ? (
                        <div>
                            <h3 className="text-xs font-black uppercase tracking-widest mb-6 px-2 text-green-600/60 border-l-4 border-green-600 pl-4">Completed Table Sessions</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {completedTableSessions.slice(0, 12).map(session => (
                                    <Card 
                                        key={session.id} 
                                        className="bg-white border-0 shadow-sm rounded-2xl cursor-pointer transition-all hover:shadow-lg active:scale-95 group"
                                        onClick={() => setSelectedHistoryItems({ items: session.orders.flatMap(o => o.items), title: `Table ${session.tableNumber} Bill`, total: session.totalAmount })}
                                    >
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <div className="min-w-0 pr-4">
                                                <p className="font-black text-[11px] truncate leading-tight mb-0.5 group-hover:text-primary transition-colors">Table {session.tableNumber}</p>
                                                <p className="text-[9px] font-bold opacity-40 uppercase tracking-tighter flex items-center gap-1">
                                                    <Clock className="h-2 w-2" /> {format(session.lastActivity, 'p')}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <Badge variant="outline" className="text-[8px] font-black uppercase border-blue-500/20 text-green-600 bg-green-50 px-1.5 py-0 mb-1 rounded-sm">Paid</Badge>
                                                <p className="font-black text-xs text-primary tracking-tighter">₹{session.totalAmount.toFixed(0)}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    ) : selectedDate && (
                        <div className="text-center py-6 opacity-30">
                            <p className="text-[9px] font-black uppercase tracking-widest">No table sessions on this date</p>
                        </div>
                    )}

                    {completedDeliveries.length === 0 && completedTableSessions.length === 0 && !selectedDate && (
                        <div className="text-center py-10 opacity-20 grayscale">
                            <History className="h-12 w-12 mx-auto mb-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest">No recent transactions</p>
                        </div>
                    )}
                </div>
            </section>
        </div>
    </div>
  );
}
