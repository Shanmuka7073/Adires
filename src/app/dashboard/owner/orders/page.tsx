
'use client';

import { Order, Store, OrderItem } from '@/lib/types';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Users,
  MapPin,
  Phone,
  Video,
  Receipt,
  History,
  PlusCircle,
  Calendar as CalendarIcon,
  ChevronDown,
  Download,
  Trash2,
  Coffee,
  RefreshCw,
  FileEdit
} from 'lucide-react';
import Link from 'next/link';
import {
  collection, query, where, orderBy, doc, updateDoc, serverTimestamp, Timestamp, getDocs, limit
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useEffect, useMemo, useRef, useState, useTransition, useCallback } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from '@/components/ui/dialog';
import { markSessionAsPaid } from '@/app/actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useAppStore } from '@/lib/store';

const STATUS_META: Record<string, any> = {
  Draft: { icon: FileEdit, variant: 'outline', color: 'text-gray-400', label: 'Ordering...' },
  Pending: { icon: AlertTriangle, variant: 'secondary', color: 'text-amber-600', label: 'New' },
  Processing: { icon: CookingPot, variant: 'secondary', color: 'text-blue-600', label: 'Kitchen' },
  'Out for Delivery': { icon: Truck, variant: 'outline', color: 'text-purple-600', label: 'Delivery' },
  Billed: { icon: Check, variant: 'default', color: 'text-green-600', label: 'Ready' },
  Completed: { icon: CheckCircle, variant: 'default', color: 'text-gray-600', label: 'Paid' },
  Delivered: { icon: CheckCircle, variant: 'default', color: 'text-gray-600', label: 'Done' },
  Cancelled: { icon: AlertTriangle, variant: 'destructive', color: 'text-red-600', label: 'Void' },
};

interface Session {
  id: string;
  tableNumber: string | null;
  orders: Order[];
  totalAmount: number;
  status: Order['status'];
  lastActivity: Date;
}

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
        <Card className="border-dashed border-2 bg-muted/5 opacity-40 hover:opacity-100 hover:bg-muted/10 transition-all cursor-default h-full flex flex-col justify-center items-center py-12 rounded-[2rem]">
            <Users className="h-8 w-8 text-muted-foreground mb-2" />
            <h3 className="font-bold text-lg">Table {tableNumber}</h3>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Available</p>
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

  const meta = STATUS_META[session.status] || STATUS_META.Pending;

  return (
    <Card className={cn(
        "rounded-[2rem] transition-all overflow-hidden h-full flex flex-col border-0 shadow-xl",
        session.status === 'Billed' ? 'ring-4 ring-green-500 bg-green-50' : (session.status === 'Draft' ? 'opacity-80 bg-slate-50 border-2 border-dashed' : 'bg-white')
    )}>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
            <div>
                 <CardTitle className="text-xl text-primary font-black">Table {session.tableNumber || 'N/A'}</CardTitle>
                 <CardDescription className="text-[10px] font-mono opacity-40">Session: {session.id.slice(-6)}</CardDescription>
            </div>
             <Badge variant={meta?.variant || 'secondary'} className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">
                {meta.label}
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
            <Button 
                className={cn(
                    "w-full h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg transition-all",
                    session.status === 'Billed' ? 'bg-green-600 hover:bg-green-700' : 'bg-primary'
                )}
                onClick={handleConfirmPayment}
                disabled={isUpdating || isCompleting || session.status === 'Draft'}
            >
                {isCompleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                {session.status === 'Billed' ? 'Receive Payment' : session.status === 'Draft' ? 'Customer Ordering...' : 'Confirm & Prep'}
            </Button>
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
                        <CardDescription className="text-[10px] font-bold opacity-40">
                            {order.orderDate instanceof Timestamp 
                                ? format(order.orderDate.toDate(), 'p, PPP') 
                                : order.orderDate instanceof Date 
                                    ? format(order.orderDate, 'p, PPP') 
                                    : 'Recently Placed'}
                        </CardDescription>
                    </div>
                    <Badge variant={meta.variant} className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase tracking-widest">{meta.label}</Badge>
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5 flex-1 text-xs">
                <div 
                    className="bg-blue-50/30 p-4 rounded-2xl border border-blue-100 space-y-2 cursor-pointer hover:bg-blue-100/50 transition-all active:scale-[0.98]"
                    onClick={handleOpenMap}
                >
                    <p className="font-black text-blue-900">{order.customerName}</p>
                    {order.phone && <p className="font-black text-blue-900 flex items-center gap-2"><Phone className="h-3 w-3" /> {order.phone}</p>}
                    <p className="font-bold text-blue-800 leading-tight flex items-start gap-2"><MapPin className="h-3 w-3 shrink-0 mt-0.5" /> {order.deliveryAddress}</p>
                </div>
                <div className="space-y-1">
                    {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between text-[11px] font-bold">
                            <span className="truncate pr-4">{item.productName} x{item.quantity}</span>
                            <span>₹{(item.price * item.quantity).toFixed(0)}</span>
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-black/5 pt-4 bg-black/5">
                <div className="flex justify-between items-baseline w-full mb-1">
                    <span className="text-[9px] uppercase font-black opacity-30">Total Bill</span>
                    <span className="text-xl font-black text-primary">₹{order.totalAmount.toFixed(2)}</span>
                </div>
                <button 
                    onClick={() => onStatusChange(order.id, order.status === 'Pending' ? 'Processing' : order.status === 'Processing' ? 'Out for Delivery' : 'Delivered')} 
                    disabled={isUpdating} 
                    className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-[10px] uppercase tracking-widest shadow-lg text-white"
                >
                    {order.status === 'Pending' ? 'Start Prep' : order.status === 'Processing' ? 'Mark Out for Delivery' : 'Confirm Delivery'}
                </button>
            </CardFooter>
        </Card>
    );
}

export default function StoreOrdersPage() {
  const { firestore, user } = useFirebase();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isHistoryLoading, startHistoryTransition] = useTransition();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [historyOrders, setHistoryHistoryOrders] = useState<Order[] | null>(null);
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<{ items: OrderItem[], title: string, total: number } | null>(null);

  const { userStore: myStore, loading: storeLoading } = useAppStore();

  /**
   * HIGH-PERFORMANCE OPERATION QUERY
   * We filter by 'isActive' == true at the DATABASE level.
   * This is the production-grade fix for the "300 reads" issue.
   * It ensures the Kitchen only fetches open orders, not the thousands
   * of closed ones from history.
   */
  const activeOrdersQuery = useMemoFirebase(() =>
    firestore && myStore
      ? query(
          collection(firestore, 'orders'),
          where('storeId', '==', myStore.id),
          where('isActive', '==', true), // THE PERFORMANCE FIX
          orderBy('orderDate', 'desc'),
          limit(50) 
        )
      : null,
  [firestore, myStore]);

  const { data: activeOrders, isLoading: ordersLoading, refetch } = useCollection<Order>(activeOrdersQuery);

  const fetchHistory = useCallback(() => {
    if (!firestore || !myStore || !selectedDate) return;
    
    startHistoryTransition(async () => {
        const start = new Date(selectedDate);
        start.setHours(0,0,0,0);
        const end = new Date(selectedDate);
        end.setHours(23,59,59,999);

        const hQuery = query(
            collection(firestore, 'orders'),
            where('storeId', '==', myStore.id),
            where('orderDate', '>=', Timestamp.fromDate(start)),
            where('orderDate', '<=', Timestamp.fromDate(end)),
            orderBy('orderDate', 'desc'),
            limit(100)
        );

        try {
            const snap = await getDocs(hQuery);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
            const filtered = data.filter(o => !o.isActive);
            setHistoryHistoryOrders(filtered);
            toast({ title: "History Loaded", description: `Found ${filtered.length} records.`});
        } catch (e) {
            console.error("History fetch error:", e);
            toast({ variant: 'destructive', title: "Load Failed", description: "Could not retrieve historical data."});
        }
    });
  }, [firestore, myStore, selectedDate, toast]);

  const { sessions, homeDeliveries, otherSessions } = useMemo(() => {
    const tableSessions: Record<string, Session> = {};
    const directDeliveries: Order[] = [];
    const others: Session[] = [];

    if (!activeOrders) return { sessions: tableSessions, homeDeliveries: directDeliveries, otherSessions: others };

    const normalizeTable = (t: string) => t.toLowerCase().replace('table ', '').trim();
    const myTableSet = new Set(myStore?.tables?.map(normalizeTable) || []);

    activeOrders.forEach(order => {
        const orderDate = order.orderDate instanceof Timestamp 
            ? order.orderDate.toDate() 
            : order.orderDate instanceof Date 
                ? order.orderDate 
                : new Date();

        if (order.tableNumber && order.sessionId) {
            const sid = order.sessionId;
            if (!tableSessions[sid]) {
                tableSessions[sid] = { 
                    id: sid, 
                    tableNumber: order.tableNumber, 
                    orders: [], 
                    totalAmount: 0, 
                    status: 'Pending', 
                    lastActivity: new Date(0) 
                };
            }
            tableSessions[sid].orders.push(order);
            tableSessions[sid].totalAmount += order.totalAmount;
            if (orderDate > tableSessions[sid].lastActivity) {
                tableSessions[sid].lastActivity = orderDate;
                tableSessions[sid].status = order.status;
            }
        } else {
            directDeliveries.push(order);
        }
    });

    const finalSessions: Record<string, Session> = {};
    Object.values(tableSessions).forEach(s => {
        const norm = normalizeTable(s.tableNumber || '');
        if (norm && myTableSet.has(norm)) {
            finalSessions[norm] = s;
        } else {
            others.push(s);
        }
    });

    return { sessions: finalSessions, homeDeliveries: directDeliveries, otherSessions: others };
  }, [activeOrders, myStore?.tables]);

  const handleOrderUpdate = (orderId: string, newStatus: Order['status']) => {
      if (!firestore) return;
      startUpdateTransition(async () => {
          try {
              const orderRef = doc(firestore, 'orders', orderId);
              await updateDoc(orderRef, { status: newStatus, updatedAt: serverTimestamp() });
              toast({ title: "Order Updated", description: `Changed to ${newStatus}.` });
          } catch (e) { toast({ variant: 'destructive', title: "Update Failed" }); }
      });
  }

  const activeSessionsByTable = useMemo(() => {
      const map: Record<string, Session> = {};
      Object.values(sessions).forEach(s => { 
          if (s.tableNumber) {
              const norm = s.tableNumber.toLowerCase().replace('table ', '').trim();
              map[norm] = s;
          }
      });
      return map;
  }, [sessions]);
  
  if (storeLoading || ordersLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 opacity-20" /></div>;

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
                <h1 className="text-6xl font-black font-headline tracking-tighter">Operation Center</h1>
                <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">STORE: {myStore?.name || '...'}</p>
            </div>
            <div className="flex gap-3">
                <Button onClick={() => refetch?.()} variant="outline" className="h-12 px-4 rounded-2xl font-black text-[10px] uppercase border-2"><RefreshCw className="h-4 w-4" /></Button>
                <Button asChild variant="outline" className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase border-2"><Link href="/dashboard/owner/sales-report">Reports & Profit</Link></Button>
                <Button asChild className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase bg-primary text-white"><Link href="/dashboard/owner/menu-manager"><PlusCircle className="mr-2 h-4 w-4" /> Manage Menu</Link></Button>
            </div>
        </div>

        <div className="space-y-24">
            <section>
                <h2 className="text-2xl font-black font-headline tracking-tight uppercase mb-8 border-l-8 border-blue-600 pl-4 text-blue-600">Home Delivery</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {homeDeliveries.map(order => (
                        <DeliveryOrderCard key={order.id} order={order} store={myStore || undefined} onStatusChange={handleOrderUpdate} isUpdating={isUpdating} />
                    ))}
                    {homeDeliveries.length === 0 && <p className="text-muted-foreground opacity-40 text-xs font-black uppercase tracking-widest">No active deliveries</p>}
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-black font-headline tracking-tight uppercase mb-8 border-l-8 border-green-600 pl-4 text-green-600">Table Service</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {myStore?.tables?.map(tableId => {
                        const norm = tableId.toLowerCase().replace('table ', '').trim();
                        const activeSession = activeSessionsByTable[norm];
                        return activeSession ? (
                            <SessionCard key={activeSession.id} session={activeSession} isUpdating={isUpdating} />
                        ) : (
                            <EmptyTableCard key={tableId} tableNumber={tableId} />
                        )
                    })}
                </div>
            </section>

            {otherSessions.length > 0 && (
                <section>
                    <h2 className="text-2xl font-black font-headline tracking-tight uppercase mb-8 border-l-8 border-amber-600 pl-4 text-amber-600">Other Active Tables</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                        {otherSessions.map(session => (
                            <SessionCard key={session.id} session={session} isUpdating={isUpdating} />
                        ))}
                    </div>
                </section>
            )}

             <section className="pt-16 border-t-2 border-black/5">
                <div className="flex flex-col items-center gap-6 mb-12">
                    <div className="flex items-center gap-3">
                        <History className="h-5 w-5 opacity-20" />
                        <h2 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Transaction History</h2>
                    </div>
                    
                    <div className="flex gap-4">
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" className="h-12 px-6 rounded-xl border-2 flex items-center gap-2 group">
                                    <CalendarIcon className="h-4 w-4 text-primary" />
                                    <span className="font-black text-[10px] uppercase tracking-widest">{selectedDate ? format(selectedDate, "MMM dd, yyyy") : "Pick Date"}</span>
                                    <ChevronDown className="h-3 w-3 opacity-20" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0 rounded-3xl" align="center">
                                <Calendar mode="single" selected={selectedDate} onSelect={(d) => { setSelectedDate(d); setHistoryHistoryOrders(null); }} disabled={(date) => date > new Date()} />
                            </PopoverContent>
                        </Popover>

                        {!historyOrders ? (
                            <Button onClick={fetchHistory} disabled={isHistoryLoading || !selectedDate} className="h-12 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg bg-primary text-white">
                                {isHistoryLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Download className="mr-2 h-4 w-4" />}
                                Load History
                            </Button>
                        ) : (
                            <Button onClick={() => setHistoryHistoryOrders(null)} variant="ghost" className="h-12 px-6 font-black text-[10px] uppercase">Close History</Button>
                        )}
                    </div>
                </div>

                {historyOrders && (
                    <div className="space-y-12">
                        <div>
                            <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 opacity-40">Finalized Orders for {format(selectedDate!, 'PP')}</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                {historyOrders.map(order => (
                                    <Card 
                                        key={order.id} 
                                        className="bg-white border-0 shadow-sm rounded-2xl cursor-pointer transition-all hover:shadow-lg active:scale-95 group"
                                        onClick={() => setSelectedHistoryItems({ items: order.items, title: `Order #${order.id.slice(-6)}`, total: order.totalAmount })}
                                    >
                                        <CardContent className="p-4 flex justify-between items-center">
                                            <div className="min-w-0 pr-4">
                                                <p className="font-black text-[11px] truncate leading-tight group-hover:text-primary transition-colors">{order.customerName || `Table ${order.tableNumber}`}</p>
                                                <p className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">
                                                    {order.orderDate instanceof Timestamp 
                                                        ? format(order.orderDate.toDate(), 'p') 
                                                        : order.orderDate instanceof Date 
                                                            ? format(order.orderDate, 'p') 
                                                            : '—'}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <Badge variant="outline" className="text-[8px] font-black uppercase border-black/10 px-1.5 py-0 mb-1 rounded-sm">{order.status}</Badge>
                                                <p className="font-black text-xs text-primary">₹{order.totalAmount.toFixed(0)}</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {historyOrders.length === 0 && <p className="text-center col-span-full py-10 opacity-30 text-[10px] font-black uppercase tracking-widest">No completed orders found for this date</p>}
                            </div>
                        </div>
                    </div>
                )}
            </section>
        </div>
    </div>
  );
}
