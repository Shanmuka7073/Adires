
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
  Receipt,
  History,
  PlusCircle,
  Calendar as CalendarIcon,
  ChevronDown,
  Download,
  Trash2,
  RefreshCw,
  FileEdit,
  Clock,
  BellRing,
  Printer,
  Monitor,
  ChefHat
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
import { markSessionAsPaid, confirmOrderSession, dismissTableService } from '@/app/actions';
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
  needsService?: boolean;
  serviceType?: string;
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

function handlePrintReceipt(session: Session, store: Store) {
    const win = window.open('', '_blank');
    if (!win) return;

    const date = format(new Date(), 'dd/MM/yyyy HH:mm');
    const itemsHtml = session.orders.flatMap(o => o.items).map(it => `
        <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 4px;">
            <span>${it.productName} x ${it.quantity}</span>
            <span>${(it.price * it.quantity).toFixed(2)}</span>
        </div>
    `).join('');

    win.document.write(`
        <html>
            <head>
                <title>Receipt - Table ${session.tableNumber}</title>
                <style>
                    body { font-family: 'Courier New', Courier, monospace; width: 300px; margin: 0; padding: 20px; color: #000; }
                    .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                    .footer { text-align: center; border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; font-size: 12px; }
                    .total { display: flex; justify-content: space-between; font-weight: bold; font-size: 18px; margin-top: 10px; border-top: 1px solid #000; padding-top: 10px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2 style="margin: 0; text-transform: uppercase;">${store.name}</h2>
                    <p style="font-size: 12px; margin: 5px 0;">${store.address}</p>
                    <p style="font-size: 14px; font-weight: bold;">TABLE: ${session.tableNumber}</p>
                    <p style="font-size: 10px; opacity: 0.6;">${date}</p>
                </div>
                <div class="items">${itemsHtml}</div>
                <div class="total">
                    <span>TOTAL</span>
                    <span>₹${session.totalAmount.toFixed(2)}</span>
                </div>
                <div class="footer">
                    <p>Thank you for visiting!</p>
                    <p>Powered by LocalBasket</p>
                </div>
                <script>window.onload = () => { window.print(); window.close(); }</script>
            </body>
        </html>
    `);
}

function SessionCard({ session, isUpdating, onDismissService, isKitchenMode, onStatusUpdate, store }: { session: Session; isUpdating: boolean; onDismissService: (id: string) => void; isKitchenMode: boolean; onStatusUpdate: (id: string, s: any) => void; store: Store }) {
  const { toast } = useToast();
  const [isProcessing, startAction] = useTransition();

  const handleAction = () => {
    startAction(async () => {
        let result;
        if (session.status === 'Billed') {
            result = await markSessionAsPaid(session.id);
        } else {
            result = await confirmOrderSession(session.id);
        }

        if (result.success) {
            toast({ title: session.status === 'Billed' ? 'Payment Confirmed' : 'Kitchen Notified' });
        } else {
            toast({ variant: 'destructive', title: 'Update Failed', description: result.error });
        }
    });
  };

  const meta = STATUS_META[session.status] || STATUS_META.Pending;

  if (isKitchenMode && !['Pending', 'Processing'].includes(session.status)) return null;

  return (
    <Card className={cn(
        "rounded-[2rem] transition-all overflow-hidden h-full flex flex-col border-0 shadow-xl relative",
        session.status === 'Billed' ? 'ring-4 ring-green-500 bg-green-50' : (session.status === 'Draft' ? 'opacity-80 bg-slate-50 border-2 border-dashed' : 'bg-white'),
        session.needsService && 'ring-4 ring-red-500 animate-pulse'
    )}>
      {session.needsService && (
          <div className="absolute top-0 left-0 w-full h-10 bg-red-600 flex items-center justify-between px-4 z-10 shadow-lg">
              <div className="flex items-center gap-2">
                  <BellRing className="h-4 w-4 text-white animate-bounce" />
                  <span className="text-[11px] font-black uppercase text-white">{session.serviceType || 'Service'}</span>
              </div>
              <Button size="sm" variant="outline" className="h-7 rounded-lg bg-white/20 border-white/40 text-white font-bold text-[9px] uppercase px-2" onClick={() => onDismissService(session.orders.find(o => o.needsService)?.id || session.orders[0].id)}>Resolved</Button>
          </div>
      )}
      <CardHeader className={cn("pb-2", session.needsService && "pt-10")}>
        <div className="flex justify-between items-start">
            <div>
                 <CardTitle className={cn("text-xl font-black", isKitchenMode ? "text-3xl" : "text-primary")}>Table {session.tableNumber || 'N/A'}</CardTitle>
                 <CardDescription className="text-[10px] font-mono opacity-40">Session: {session.id.split('-').pop()}</CardDescription>
            </div>
             {!isKitchenMode && <Badge variant={meta?.variant || 'secondary'} className="px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-widest">{meta.label}</Badge>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 flex-1">
        <div>
          <h4 className="text-[10px] font-black uppercase text-muted-foreground mb-2 tracking-widest opacity-40">{isKitchenMode ? 'Order List' : 'Active Bill'}</h4>
          <div className="space-y-1.5">
            {session.orders.flatMap(o => o.items).map((item, index) => (
              <div key={index} className={cn("flex justify-between items-center rounded-lg", isKitchenMode ? "p-3 bg-black text-white text-base" : "p-2 bg-black/5 text-[11px]")}>
                <span className="font-bold truncate pr-2">{item.productName} <span className={cn(isKitchenMode ? "text-primary text-xl" : "opacity-40")}>x{item.quantity}</span></span>
                {!isKitchenMode && <span className="font-black shrink-0">₹{(item.price * item.quantity).toFixed(0)}</span>}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="pt-4 border-t border-black/5 flex flex-col gap-3 bg-black/5">
            {!isKitchenMode && (
                <div className="flex justify-between items-baseline w-full">
                    <span className="opacity-40 text-[9px] font-black uppercase tracking-widest">Grand Total</span>
                    <span className="text-xl font-black text-primary">₹{session.totalAmount.toFixed(2)}</span>
                </div>
            )}
            <div className="flex gap-2 w-full">
                {session.status === 'Billed' && !isKitchenMode && (
                    <Button variant="outline" size="icon" className="h-12 w-12 rounded-xl border-2" onClick={() => handlePrintReceipt(session, store)}>
                        <Printer className="h-5 w-5" />
                    </Button>
                )}
                <Button 
                    className={cn(
                        "flex-1 h-12 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg",
                        isKitchenMode ? "h-16 text-sm" : ""
                    )}
                    onClick={handleAction}
                    disabled={isUpdating || isProcessing || session.status === 'Draft'}
                >
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Check className="mr-2 h-4 w-4" />}
                    {session.status === 'Billed' ? 'Receive Payment' : session.status === 'Draft' ? 'Ordering...' : isKitchenMode ? 'Mark Ready' : 'Confirm & Prep'}
                </Button>
            </div>
      </CardFooter>
    </Card>
  )
}

function DeliveryOrderCard({ order, store, onStatusChange, isUpdating, onDismissService, isKitchenMode }: { order: Order; store?: Store; onStatusChange: (id: string, status: Order['status']) => void; isUpdating: boolean; onDismissService: (id: string) => void; isKitchenMode: boolean }) {
    if (isKitchenMode && !['Pending', 'Processing'].includes(order.status)) return null;
    const meta = STATUS_META[order.status] || STATUS_META.Pending;

    return (
        <Card className={cn(
            "border-0 shadow-2xl overflow-hidden rounded-[2.5rem] bg-white flex flex-col h-full relative",
            order.needsService && 'ring-4 ring-red-500 animate-pulse'
        )}>
            <CardHeader className={cn("pb-3 bg-blue-50/50 border-b border-blue-100/50", order.needsService && "pt-10")}>
                <div className="flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <Package className="h-4 w-4 text-blue-600" />
                            <CardTitle className="text-base font-black uppercase text-blue-950">Delivery #{order.id.slice(-6)}</CardTitle>
                        </div>
                        <CardDescription className="text-[10px] font-bold opacity-40">{order.customerName}</CardDescription>
                    </div>
                    {!isKitchenMode && <Badge variant={meta.variant} className="rounded-md px-2 py-0.5 text-[9px] font-black uppercase">{meta.label}</Badge>}
                </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-5 flex-1 text-xs">
                <div className="space-y-1.5">
                    {order.items.map((item, idx) => (
                        <div key={idx} className={cn("flex justify-between font-bold rounded-lg", isKitchenMode ? "p-3 bg-slate-900 text-white text-base" : "text-[11px]")}>
                            <span className="truncate pr-4">{item.productName} <span className={isKitchenMode ? "text-primary text-xl" : ""}>x{item.quantity}</span></span>
                            {!isKitchenMode && <span>₹{(item.price * item.quantity).toFixed(0)}</span>}
                        </div>
                    ))}
                </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 border-t border-black/5 pt-4 bg-black/5">
                {!isKitchenMode && (
                    <div className="flex justify-between items-baseline w-full mb-1">
                        <span className="text-[9px] uppercase font-black opacity-30">Total Bill</span>
                        <span className="text-xl font-black text-primary">₹{order.totalAmount.toFixed(2)}</span>
                    </div>
                )}
                <button 
                    onClick={() => onStatusChange(order.id, order.status === 'Pending' ? 'Processing' : order.status === 'Processing' ? 'Out for Delivery' : 'Delivered')} 
                    disabled={isUpdating} 
                    className={cn("w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 font-black text-[10px] uppercase text-white shadow-lg", isKitchenMode ? "h-16 text-sm" : "")}
                >
                    {order.status === 'Pending' ? 'Start Prep' : order.status === 'Processing' ? 'Mark Ready' : 'Finalize'}
                </button>
            </CardFooter>
        </Card>
    );
}

export default function StoreOrdersPage() {
  const { firestore } = useFirebase();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [isHistoryLoading, startHistoryTransition] = useTransition();
  const [isKitchenMode, setIsKitchenMode] = useState(false);
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [historyOrders, setHistoryHistoryOrders] = useState<Order[] | null>(null);
  const [selectedHistoryItems, setSelectedHistoryItems] = useState<{ items: OrderItem[], title: string, total: number } | null>(null);

  const { userStore: myStore, loading: storeLoading } = useAppStore();

  const activeOrdersQuery = useMemoFirebase(() =>
    firestore && myStore
      ? query(
          collection(firestore, 'orders'),
          where('storeId', '==', myStore.id),
          where('isActive', '==', true),
          orderBy('orderDate', 'desc'),
          limit(50) 
        )
      : null,
  [firestore, myStore]);

  const { data: activeOrders, isLoading: ordersLoading, refetch } = useCollection<Order>(activeOrdersQuery);

  const prevOrderCountRef = useRef(0);
  useEffect(() => {
      if (activeOrders && activeOrders.length > prevOrderCountRef.current) {
          if (prevOrderCountRef.current > 0) {
              const audio = new Audio('https://storage.googleapis.com/localbasket-audio/order-chime.mp3');
              audio.play().catch(() => {});
          }
      }
      prevOrderCountRef.current = activeOrders?.length || 0;
  }, [activeOrders]);

  const fetchHistory = useCallback(() => {
    if (!firestore || !myStore || !selectedDate) return;
    startHistoryTransition(async () => {
        const start = new Date(selectedDate); start.setHours(0,0,0,0);
        const end = new Date(selectedDate); end.setHours(23,59,59,999);
        const hQuery = query(collection(firestore, 'orders'), where('storeId', '==', myStore.id), where('orderDate', '>=', Timestamp.fromDate(start)), where('orderDate', '<=', Timestamp.fromDate(end)), orderBy('orderDate', 'desc'), limit(100));
        try {
            const snap = await getDocs(hQuery);
            const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
            setHistoryHistoryOrders(data.filter(o => !o.isActive));
        } catch (e) { toast({ variant: 'destructive', title: "Load Failed" }); }
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
        const orderDate = toDateSafe(order.orderDate);
        if (order.tableNumber && order.sessionId) {
            const sid = order.sessionId;
            if (!tableSessions[sid]) {
                tableSessions[sid] = { id: sid, tableNumber: order.tableNumber, orders: [], totalAmount: 0, status: 'Pending', lastActivity: new Date(0), needsService: false };
            }
            tableSessions[sid].orders.push(order);
            tableSessions[sid].totalAmount += order.totalAmount;
            if (order.needsService) { tableSessions[sid].needsService = true; tableSessions[sid].serviceType = order.serviceType; }
            if (orderDate > tableSessions[sid].lastActivity) { tableSessions[sid].lastActivity = orderDate; tableSessions[sid].status = order.status; }
        } else { directDeliveries.push(order); }
    });

    const finalSessions: Record<string, Session> = {};
    Object.values(tableSessions).forEach(s => {
        const norm = normalizeTable(s.tableNumber || '');
        if (norm && myTableSet.has(norm)) finalSessions[norm] = s; else others.push(s);
    });
    return { sessions: finalSessions, homeDeliveries: directDeliveries, otherSessions: others };
  }, [activeOrders, myStore]);

  const handleOrderUpdate = (orderId: string, newStatus: Order['status']) => {
      if (!firestore) return;
      startUpdateTransition(async () => {
          try {
              const orderRef = doc(firestore, 'orders', orderId);
              const finalized = ['Delivered', 'Completed', 'Cancelled'].includes(newStatus);
              await updateDoc(orderRef, { status: newStatus, updatedAt: serverTimestamp(), isActive: !finalized });
              toast({ title: "Order Updated" });
          } catch (e) { toast({ variant: 'destructive', title: "Update Failed" }); }
      });
  }

  const handleDismissService = (orderId: string) => {
      startUpdateTransition(async () => {
          const res = await dismissTableService(orderId);
          if (res.success) toast({ title: "Resolved" });
      });
  };

  if (storeLoading || ordersLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 opacity-20" /></div>;

  return (
    <div className={cn("container mx-auto py-10 px-4 md:px-6 max-w-7xl transition-colors duration-500", isKitchenMode ? "bg-slate-900" : "bg-background")}>
        {selectedHistoryItems && <ViewOrderDetailsDialog isOpen={!!selectedHistoryItems} onClose={() => setSelectedHistoryItems(null)} title={selectedHistoryItems.title} items={selectedHistoryItems.items} total={selectedHistoryItems.total} />}

        <div className="mb-12 flex flex-col md:flex-row justify-between md:items-end gap-6 border-b pb-10 border-black/5">
            <div>
                <h1 className={cn("text-6xl font-black font-headline tracking-tighter", isKitchenMode ? "text-white" : "text-gray-950")}>{isKitchenMode ? 'KITCHEN SYSTEM' : 'Operation Center'}</h1>
                <p className={cn("font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40", isKitchenMode ? "text-primary" : "text-muted-foreground")}>STORE: {myStore?.name || '...'}</p>
            </div>
            <div className="flex gap-3">
                <Button onClick={() => setIsKitchenMode(!isKitchenMode)} variant="outline" className={cn("h-12 px-6 rounded-2xl font-black text-[10px] uppercase border-2", isKitchenMode ? "bg-primary text-white border-primary" : "")}>
                    {isKitchenMode ? <Monitor className="mr-2 h-4 w-4" /> : <ChefHat className="mr-2 h-4 w-4" />}
                    {isKitchenMode ? 'Switch to Manager' : 'Switch to Kitchen'}
                </Button>
                {!isKitchenMode && (
                    <>
                        <Button onClick={() => refetch?.()} variant="outline" className="h-12 px-4 rounded-2xl font-black text-[10px] uppercase border-2"><RefreshCw className="h-4 w-4" /></Button>
                        <Button asChild variant="outline" className="h-12 px-6 rounded-2xl font-black text-[10px] uppercase border-2"><Link href="/dashboard/owner/sales-report">Profit Reports</Link></Button>
                    </>
                )}
            </div>
        </div>

        <div className="space-y-24">
            <section>
                <h2 className="text-2xl font-black font-headline tracking-tight uppercase mb-8 border-l-8 border-blue-600 pl-4 text-blue-600">{isKitchenMode ? 'PREPARATION (DELIVERY)' : 'Home Delivery & Services'}</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {homeDeliveries.map(order => (
                        <DeliveryOrderCard key={order.id} order={order} store={myStore || undefined} onStatusChange={handleOrderUpdate} isUpdating={isUpdating} onDismissService={handleDismissService} isKitchenMode={isKitchenMode} />
                    ))}
                </div>
            </section>

            <section>
                <h2 className="text-2xl font-black font-headline tracking-tight uppercase mb-8 border-l-8 border-green-600 pl-4 text-green-600">{isKitchenMode ? 'PREPARATION (DINE-IN)' : 'Table & Chair Service'}</h2>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-8">
                    {Object.entries(sessions).map(([tableId, s]) => (
                        <SessionCard key={s.id} session={s} isUpdating={isUpdating} onDismissService={handleDismissService} isKitchenMode={isKitchenMode} onStatusUpdate={handleOrderUpdate} store={myStore!} />
                    ))}
                </div>
            </section>

             {!isKitchenMode && (
                <section className="pt-16 border-t-2 border-black/5">
                    <div className="flex flex-col items-center gap-6 mb-12">
                        <History className="h-5 w-5 opacity-20" />
                        <h2 className="text-[10px] font-black uppercase tracking-[0.5em] opacity-30">Session History</h2>
                        <div className="flex gap-4">
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button variant="outline" className="h-12 px-6 rounded-xl border-2 font-black text-[10px] uppercase tracking-widest"><CalendarIcon className="mr-2 h-4 w-4" />{selectedDate ? format(selectedDate, "PP") : "Pick Date"}</Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0 rounded-3xl"><Calendar mode="single" selected={selectedDate} onSelect={(d) => { setSelectedDate(d); setHistoryHistoryOrders(null); }} /></PopoverContent>
                            </Popover>
                            {!historyOrders ? <Button onClick={fetchHistory} className="h-12 px-8 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Load History</Button> : <Button onClick={() => setHistoryHistoryOrders(null)} variant="ghost" className="h-12 px-6 font-black text-[10px] uppercase">Close</Button>}
                        </div>
                    </div>
                    {historyOrders && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                            {historyOrders.map(order => (
                                <Card key={order.id} className="bg-white border-0 shadow-sm rounded-2xl cursor-pointer hover:shadow-lg active:scale-95" onClick={() => setSelectedHistoryItems({ items: order.items, title: `Order #${order.id.slice(-6)}`, total: order.totalAmount })}>
                                    <CardContent className="p-4 flex justify-between items-center">
                                        <div className="min-w-0 pr-4"><p className="font-black text-[11px] truncate leading-tight">{order.customerName || `Table ${order.tableNumber}`}</p><p className="text-[9px] font-bold opacity-40 uppercase tracking-tighter">{order.orderDate instanceof Timestamp ? format(order.orderDate.toDate(), 'p') : '—'}</p></div>
                                        <div className="text-right shrink-0"><Badge variant="outline" className="text-[8px] font-black uppercase mb-1 rounded-sm">{order.status}</Badge><p className="font-black text-xs text-primary">₹{order.totalAmount.toFixed(0)}</p></div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </section>
             )}
        </div>
    </div>
  );
}

function toDateSafe(d: any): Date {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    if (d instanceof Timestamp) return d.toDate();
    if (typeof d === 'string') return new Date(d);
    if (typeof d === 'object' && d.seconds) return new Date(d.seconds * 1000);
    return new Date();
}
