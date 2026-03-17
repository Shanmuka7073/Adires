
'use client';

import { Order, Store, OrderItem } from '@/lib/types';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  CookingPot,
  Truck,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Check,
  Package,
  Receipt,
  Clock,
  BellRing,
  Printer,
  Monitor,
  ChefHat,
  Utensils,
  ShoppingBag,
  Calculator
} from 'lucide-react';
import {
  collection, query, where, orderBy, doc, updateDoc, serverTimestamp, Timestamp, limit
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useMemo, useState, useTransition } from 'react';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogDescription
} from '@/components/ui/alert-dialog';
import { markSessionAsPaid, confirmOrderSession, dismissTableService, updateOrderStatus } from '@/app/actions';
import { cn } from '@/lib/utils';
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
  orderType: Order['orderType'];
  lastActivity: Date;
  needsService?: boolean;
  serviceType?: string;
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

  const titleIcon = session.orderType === 'takeaway' ? <ShoppingBag className="h-4 w-4" /> : session.orderType === 'counter' ? <Calculator className="h-4 w-4" /> : <Utensils className="h-4 w-4" />;

  return (
    <Card className={cn(
        "rounded-xl shadow-md border-0 relative transition-all", 
        session.status === 'Billed' && "bg-green-50 ring-1 ring-green-500", 
        session.needsService && "ring-2 ring-red-500 animate-pulse"
    )}>
      {session.needsService && (
          <div className="absolute top-0 left-0 w-full h-6 bg-red-600 flex items-center justify-between px-2 rounded-t-xl z-10">
              <span className="text-[8px] font-black uppercase text-white flex items-center gap-1"><BellRing className="h-2.5 w-2.5"/> {session.serviceType || 'Service'}</span>
              <button onClick={() => onDismissService(session.orders[0].id)} className="text-[8px] font-black text-white underline">Done</button>
          </div>
      )}
      <CardHeader className={cn("p-2 pb-1", session.needsService && "pt-7")}>
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-1.5">
                 <div className="opacity-20">{titleIcon}</div>
                 <div>
                    <CardTitle className="text-sm font-black">{session.tableNumber || 'Walking'}</CardTitle>
                    <CardDescription className="text-[7px] opacity-40">#{session.id.slice(-4)}</CardDescription>
                 </div>
            </div>
             <Badge className="text-[7px] font-black uppercase h-4 px-1.5" variant={meta.variant}>{meta.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-2 pt-1 space-y-1">
          {session.orders.flatMap(o => o.items).map((it, i) => (
              <div key={i} className="flex justify-between items-center text-[9px] font-bold py-0.5 border-b border-black/5 last:border-0">
                  <span className="truncate pr-2">{it.productName} <span className="opacity-40">x{it.quantity}</span></span>
                  <span className="shrink-0">₹{(it.price * it.quantity).toFixed(0)}</span>
              </div>
          ))}
      </CardContent>
      <CardFooter className="p-2 pt-1 flex flex-col gap-1.5 bg-black/5 rounded-b-xl">
            <div className="flex justify-between w-full text-[8px] font-black uppercase">
                <span className="opacity-40">Total</span>
                <span className="text-primary">₹{session.totalAmount.toFixed(0)}</span>
            </div>
            <div className="flex gap-1 w-full">
                <Button className="w-full h-7 rounded-lg text-[8px] font-black uppercase" onClick={handleAction} disabled={isUpdating || isProcessing}>
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

    const getNextStatus = (current: string) => {
        if (current === 'Pending') return 'Processing';
        if (current === 'Processing') return 'Out for Delivery';
        if (current === 'Out for Delivery') return 'Delivered';
        return current;
    };

    return (
        <Card className="rounded-xl shadow-md border-0 overflow-hidden bg-white">
            <CardHeader className="p-2 pb-1 bg-blue-50/50">
                <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-2">
                        <CardTitle className="text-[10px] font-black uppercase truncate">{order.customerName}</CardTitle>
                        <CardDescription className="text-[7px] truncate">{order.deliveryAddress}</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[7px] font-black uppercase shrink-0 h-4">{meta.label}</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-2 pt-1 space-y-0.5">
                {order.items.map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[9px] font-bold">
                        <span className="truncate pr-2">{it.productName} <span className="opacity-40">x{it.quantity}</span></span>
                        <span>₹{(it.price * it.quantity).toFixed(0)}</span>
                    </div>
                ))}
            </CardContent>
            <CardFooter className="p-2 pt-1 bg-black/5">
                <Button className="w-full h-7 rounded-lg text-[8px] font-black uppercase" onClick={() => onStatusChange(order.id, getNextStatus(order.status))} disabled={isUpdating}>
                    {order.status === 'Pending' ? 'Start Prep' : 'Next Step'}
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
  const { stores, userStore, loading: isStoreLoading } = useAppStore();

  const myStore = useMemo(() => userStore || stores[0], [userStore, stores]);

  const activeOrdersQuery = useMemoFirebase(() =>
    firestore && myStore ? query(collection(firestore, 'orders'), where('storeId', '==', myStore.id), where('isActive', '==', true), orderBy('orderDate', 'desc'), limit(50)) : null,
  [firestore, myStore]);

  const { data: activeOrders, isLoading: ordersLoading } = useCollection<Order>(activeOrdersQuery);

  const { sessions, homeDeliveries } = useMemo(() => {
    const tableSessions: Record<string, Session> = {};
    const onlineJobs: Order[] = [];
    if (!activeOrders) return { sessions: {}, homeDeliveries: [] };
    activeOrders.forEach(o => {
        // COUNTER and DINE-IN go to the right side (Table & Counter)
        if (o.orderType === 'dine-in' || o.orderType === 'counter') {
            if (o.sessionId) {
                if (!tableSessions[o.sessionId]) {
                    tableSessions[o.sessionId] = { 
                        id: o.sessionId, 
                        tableNumber: o.tableNumber || 'Counter', 
                        orders: [], 
                        totalAmount: 0, 
                        status: o.status, 
                        orderType: o.orderType,
                        lastActivity: toDateSafe(o.orderDate), 
                        needsService: o.needsService, 
                        serviceType: o.serviceType 
                    };
                }
                tableSessions[o.sessionId].orders.push(o);
                tableSessions[o.sessionId].totalAmount += o.totalAmount;
                
                const statusWeights: Record<string, number> = { 'Draft': 1, 'Pending': 2, 'Processing': 3, 'Billed': 4 };
                if (statusWeights[o.status] > (statusWeights[tableSessions[o.sessionId].status] || 0)) {
                    tableSessions[o.sessionId].status = o.status;
                }
                if (o.needsService) {
                    tableSessions[o.sessionId].needsService = true;
                    tableSessions[o.sessionId].serviceType = o.serviceType;
                }
            }
        } else {
            // DELIVERY or TAKEAWAY (from online) go to left side
            onlineJobs.push(o);
        }
    });
    return { sessions: tableSessions, homeDeliveries: onlineJobs };
  }, [activeOrders]);

  const handleOrderUpdate = (orderId: string, status: any) => {
      startUpdate(async () => {
          const res = await updateOrderStatus(orderId, status);
          if (res.success) toast({ title: "Updated" });
      });
  }

  const handleDismissService = (orderId: string) => {
      startUpdate(async () => { await dismissTableService(orderId); toast({ title: "Resolved" }); });
  };

  if (isStoreLoading || ordersLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;

  return (
    <div className={cn("min-h-screen py-4 px-3 max-w-7xl mx-auto transition-colors duration-500", isKitchenMode ? "bg-slate-950" : "bg-slate-50")}>
        <div className="flex justify-between items-center mb-6 border-b pb-3 border-black/10">
            <div>
                <h1 className={cn("text-xl font-black tracking-tighter", isKitchenMode ? "text-white" : "text-gray-900")}>OP CENTER</h1>
                <p className={cn("text-[8px] font-bold uppercase opacity-40", isKitchenMode ? "text-primary" : "text-muted-foreground")}>{myStore?.name}</p>
            </div>
            <div className="flex gap-2">
                <Button onClick={() => setIsKitchenMode(!isKitchenMode)} variant="outline" size="sm" className={cn("h-8 px-3 rounded-lg font-black text-[9px] uppercase border-2", isKitchenMode && "bg-primary text-white border-primary")}>
                    {isKitchenMode ? <Monitor className="h-3 w-3 mr-1.5"/> : <ChefHat className="h-3 w-3 mr-1.5"/>} {isKitchenMode ? 'POS' : 'KDS'}
                </Button>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-3">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5"><Truck className="h-3 w-3"/> Home Delivery & Online</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {homeDeliveries.map(o => <DeliveryOrderCard key={o.id} order={o} onStatusChange={handleOrderUpdate} isUpdating={isUpdating} isKitchenMode={isKitchenMode} />)}
                    {homeDeliveries.length === 0 && <p className="text-[8px] opacity-30 uppercase font-black py-8 text-center border-2 border-dashed rounded-xl">No active jobs</p>}
                </div>
            </section>

            <section className="space-y-3">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-green-600 flex items-center gap-1.5"><Utensils className="h-3 w-3"/> Table & Counter</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.values(sessions).map(s => <SessionCard key={s.id} session={s} isUpdating={isUpdating} onDismissService={handleDismissService} isKitchenMode={isKitchenMode} store={myStore!} />)}
                    {Object.values(sessions).length === 0 && <p className="text-[8px] opacity-30 uppercase font-black py-8 text-center border-2 border-dashed rounded-xl">No active sessions</p>}
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
