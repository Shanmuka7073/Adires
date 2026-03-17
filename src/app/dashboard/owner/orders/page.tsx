
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
  Receipt,
  History,
  Calendar as CalendarIcon,
  RefreshCw,
  Clock,
  BellRing,
  Printer,
  Monitor,
  ChefHat,
  Utensils
} from 'lucide-react';
import Link from 'next/link';
import {
  collection, query, where, orderBy, doc, updateDoc, serverTimestamp, Timestamp, getDocs, limit
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useEffect, useMemo, useRef, useState, useTransition, useCallback } from 'react';
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
  Draft: { icon: Clock, variant: 'outline', color: 'text-gray-400', label: 'Ordering...' },
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
    win.document.write(`<html><body style="width:300px;padding:20px;font-family:monospace;"><h2>${store.name}</h2><p>${store.address}</p><hr/>${itemsHtml}<hr/>TOTAL: ₹${session.totalAmount.toFixed(2)}<script>window.onload=()=>window.print()</script></body></html>`);
}

function SessionCard({ session, isUpdating, onDismissService, isKitchenMode, store }: { session: Session; isUpdating: boolean; onDismissService: (id: string) => void; isKitchenMode: boolean; store: Store }) {
  const { toast } = useToast();
  const [isProcessing, startAction] = useTransition();

  const handleAction = () => {
    startAction(async () => {
        let result;
        if (session.status === 'Billed') result = await markSessionAsPaid(session.id);
        else result = await confirmOrderSession(session.id);
        if (result.success) toast({ title: 'Success' });
    });
  };

  const meta = STATUS_META[session.status] || STATUS_META.Pending;
  if (isKitchenMode && !['Pending', 'Processing'].includes(session.status)) return null;

  return (
    <Card className={cn("rounded-2xl shadow-lg border-0 relative transition-all", session.status === 'Billed' && "bg-green-50 ring-2 ring-green-500", session.needsService && "ring-2 ring-red-500 animate-pulse")}>
      {session.needsService && (
          <div className="absolute top-0 left-0 w-full h-8 bg-red-600 flex items-center justify-between px-3 rounded-t-2xl z-10">
              <span className="text-[10px] font-black uppercase text-white flex items-center gap-1"><BellRing className="h-3 w-3"/> {session.serviceType || 'Service'}</span>
              <button onClick={() => onDismissService(session.orders[0].id)} className="text-[10px] font-black text-white underline">Resolved</button>
          </div>
      )}
      <CardHeader className={cn("p-3 pb-1", session.needsService && "pt-9")}>
        <div className="flex justify-between items-start">
            <div>
                 <CardTitle className="text-lg font-black">Table {session.tableNumber || '?'}</CardTitle>
                 <CardDescription className="text-[8px] opacity-40">#{session.id.slice(-4)}</CardDescription>
            </div>
             <Badge className="text-[8px] font-black uppercase h-5">{meta.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-1 space-y-2">
          {session.orders.flatMap(o => o.items).map((it, i) => (
              <div key={i} className="flex justify-between items-center text-[10px] font-bold py-1 border-b border-black/5 last:border-0">
                  <span className="truncate pr-2">{it.productName} <span className="opacity-40">x{it.quantity}</span></span>
                  <span className="shrink-0">₹{(it.price * it.quantity).toFixed(0)}</span>
              </div>
          ))}
      </CardContent>
      <CardFooter className="p-3 pt-2 flex flex-col gap-2 bg-black/5 rounded-b-2xl">
            <div className="flex justify-between w-full text-[10px] font-black uppercase">
                <span className="opacity-40">Total</span>
                <span className="text-primary">₹{session.totalAmount.toFixed(0)}</span>
            </div>
            <div className="flex gap-1.5 w-full">
                {session.status === 'Billed' && (
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-lg shrink-0" onClick={() => handlePrintReceipt(session, store)}><Printer className="h-3.5 w-3.5"/></Button>
                )}
                <Button className="h-8 flex-1 rounded-lg text-[9px] font-black uppercase" onClick={handleAction} disabled={isUpdating || isProcessing}>
                    {session.status === 'Billed' ? 'Cash Received' : 'To Kitchen'}
                </Button>
            </div>
      </CardFooter>
    </Card>
  )
}

function DeliveryOrderCard({ order, onStatusChange, isUpdating, isKitchenMode }: { order: Order; onStatusChange: (id: string, s: any) => void; isUpdating: boolean; isKitchenMode: boolean }) {
    if (isKitchenMode && !['Pending', 'Processing'].includes(order.status)) return null;
    const meta = STATUS_META[order.status] || STATUS_META.Pending;

    return (
        <Card className="rounded-2xl shadow-lg border-0 overflow-hidden bg-white">
            <CardHeader className="p-3 pb-1 bg-blue-50/50">
                <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-2">
                        <CardTitle className="text-xs font-black uppercase truncate">{order.customerName}</CardTitle>
                        <CardDescription className="text-[8px] truncate">{order.deliveryAddress}</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[8px] font-black uppercase shrink-0">{meta.label}</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-3 pt-2 space-y-1">
                {order.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[10px] font-bold">
                        <span className="truncate pr-2">{it.productName} <span className="opacity-40">x{it.quantity}</span></span>
                        <span>₹{(it.price * it.quantity).toFixed(0)}</span>
                    </div>
                ))}
            </CardContent>
            <CardFooter className="p-3 pt-2 bg-black/5">
                <Button className="w-full h-8 rounded-lg text-[9px] font-black uppercase" onClick={() => onStatusChange(order.id, 'Processing')} disabled={isUpdating}>
                    {order.status === 'Pending' ? 'Start Delivery Prep' : 'Next Step'}
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function StoreOrdersPage() {
  const { firestore } = useFirebase();
  const [isUpdating, startUpdate] = useTransition();
  const [isKitchenMode, setIsKitchenMode] = useState(false);
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const { userStore: myStore, loading: isStoreLoading } = useAppStore();

  const activeOrdersQuery = useMemoFirebase(() =>
    firestore && myStore ? query(collection(firestore, 'orders'), where('storeId', '==', myStore.id), where('isActive', '==', true), orderBy('orderDate', 'desc'), limit(50)) : null,
  [firestore, myStore]);

  const { data: activeOrders, isLoading: ordersLoading } = useCollection<Order>(activeOrdersQuery);

  const { sessions, homeDeliveries } = useMemo(() => {
    const tableSessions: Record<string, Session> = {};
    const onlineJobs: Order[] = [];
    if (!activeOrders) return { sessions: {}, homeDeliveries: [] };
    activeOrders.forEach(o => {
        if (o.tableNumber && o.sessionId) {
            if (!tableSessions[o.sessionId]) tableSessions[o.sessionId] = { id: o.sessionId, tableNumber: o.tableNumber, orders: [], totalAmount: 0, status: 'Pending', lastActivity: new Date(0), needsService: o.needsService, serviceType: o.serviceType };
            tableSessions[o.sessionId].orders.push(o);
            tableSessions[o.sessionId].totalAmount += o.totalAmount;
        } else onlineJobs.push(o);
    });
    return { sessions: tableSessions, homeDeliveries: onlineJobs };
  }, [activeOrders]);

  const handleOrderUpdate = (orderId: string, status: any) => {
      if (!firestore) return;
      startUpdate(async () => {
          await updateDoc(doc(firestore, 'orders', orderId), { status, updatedAt: serverTimestamp(), isActive: !['Delivered', 'Completed', 'Cancelled'].includes(status) });
          toast({ title: "Updated" });
      });
  }

  const handleDismissService = (orderId: string) => {
      startUpdate(async () => { await dismissTableService(orderId); toast({ title: "Resolved" }); });
  };

  if (isStoreLoading || ordersLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;

  return (
    <div className={cn("min-h-screen py-6 px-4 max-w-7xl mx-auto transition-colors duration-500", isKitchenMode ? "bg-slate-950" : "bg-slate-50")}>
        <div className="flex justify-between items-center mb-8 border-b pb-4 border-black/10">
            <div>
                <h1 className={cn("text-2xl font-black tracking-tighter", isKitchenMode ? "text-white" : "text-gray-900")}>OPERATION CENTER</h1>
                <p className={cn("text-[9px] font-bold uppercase opacity-40", isKitchenMode ? "text-primary" : "text-muted-foreground")}>{myStore?.name}</p>
            </div>
            <div className="flex gap-2">
                <Button onClick={() => setIsKitchenMode(!isKitchenMode)} variant="outline" className={cn("h-10 px-4 rounded-xl font-black text-[10px] uppercase border-2", isKitchenMode && "bg-primary text-white border-primary")}>
                    {isKitchenMode ? <Monitor className="h-4 w-4 mr-2"/> : <ChefHat className="h-4 w-4 mr-2"/>} {isKitchenMode ? 'POS Mode' : 'Kitchen Mode'}
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <section className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-2"><Truck className="h-4 w-4"/> Home Delivery & Online</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {homeDeliveries.map(o => <DeliveryOrderCard key={o.id} order={o} onStatusChange={handleOrderUpdate} isUpdating={isUpdating} isKitchenMode={isKitchenMode} />)}
                    {homeDeliveries.length === 0 && <p className="text-[10px] opacity-30 uppercase font-black py-10 text-center border-2 border-dashed rounded-2xl">No online jobs</p>}
                </div>
            </section>

            <section className="space-y-4">
                <h2 className="text-xs font-black uppercase tracking-widest text-green-600 flex items-center gap-2"><Utensils className="h-4 w-4"/> Floor Activity (Tables)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.values(sessions).map(s => <SessionCard key={s.id} session={s} isUpdating={isUpdating} onDismissService={handleDismissService} isKitchenMode={isKitchenMode} store={myStore!} />)}
                    {Object.values(sessions).length === 0 && <p className="text-[10px] opacity-30 uppercase font-black py-10 text-center border-2 border-dashed rounded-2xl">No active tables</p>}
                </div>
            </section>
        </div>
    </div>
  );
}

function toDateSafe(d: any): Date {
    if (!d) return new Date();
    if (d instanceof Timestamp) return d.toDate();
    return new Date(d);
}
