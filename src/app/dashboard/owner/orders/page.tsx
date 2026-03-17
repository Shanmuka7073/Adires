
'use client';

import { Order, Store, OrderItem, Menu, MenuItem } from '@/lib/types';
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
  Calculator,
  Plus,
  PlusCircle,
  X,
  Search,
  Scissors
} from 'lucide-react';
import {
  collection, query, where, orderBy, doc, updateDoc, serverTimestamp, Timestamp, limit
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useMemo, useState, useTransition, useEffect } from 'react';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogDescription
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { markSessionAsPaid, confirmOrderSession, dismissTableService, updateOrderStatus, addRestaurantOrderItem } from '@/app/actions';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';

const STATUS_META: Record<string, any> = {
  Draft: { icon: Clock, variant: 'outline', color: 'text-gray-400', label: 'Draft' },
  Pending: { icon: AlertTriangle, variant: 'secondary', color: 'text-amber-600', label: 'New' },
  Processing: { icon: CookingPot, variant: 'secondary', color: 'text-blue-600', label: 'Processing' },
  'Out for Delivery': { icon: Truck, variant: 'outline', color: 'text-purple-600', label: 'Delivery' },
  Billed: { icon: Check, variant: 'default', color: 'text-green-600', label: 'Billed' },
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

function QuickCounterSaleDialog({ storeId, menuItems, onComplete, isSalon }: { storeId: string, menuItems: MenuItem[], onComplete: () => void, isSalon: boolean }) {
    const { toast } = useToast();
    const [isProcessing, startAction] = useTransition();
    const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = useMemo(() => {
        return menuItems.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [menuItems, searchTerm]);

    const addToCart = (item: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(i => i.item.id === item.id);
            if (existing) return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { item, qty: 1 }];
        });
    };

    const total = cart.reduce((acc, i) => acc + (i.item.price * i.qty), 0);

    const handleGenerateBill = () => {
        if (cart.length === 0) return;
        startAction(async () => {
            const items: any[] = cart.map(c => ({
                product: { id: c.item.id, name: c.item.name },
                variant: { sku: `${c.item.id}-default`, weight: '1 pc', price: c.item.price },
                quantity: c.qty
            }));

            const res = await addRestaurantOrderItem({
                storeId,
                tableNumber: 'Counter',
                sessionId: `counter-${Date.now()}`,
                items,
                status: 'Billed'
            });

            if (res.success) {
                toast({ title: "Bill Generated!" });
                setCart([]);
                onComplete();
            } else {
                toast({ variant: 'destructive', title: 'Error', description: res.error });
            }
        });
    };

    return (
        <DialogContent className="max-w-4xl rounded-[2.5rem] border-0 shadow-2xl h-[90vh] flex flex-col p-0 overflow-hidden">
            <div className="p-6 bg-primary/5 border-b border-black/5 shrink-0">
                <DialogTitle className="text-2xl font-black uppercase tracking-tight">Quick {isSalon ? 'Checkout' : 'Counter POS'}</DialogTitle>
                <DialogDescription className="text-xs font-bold opacity-40 uppercase">Two-touch billing for walk-ins</DialogDescription>
            </div>

            <div className="flex-1 flex min-h-0">
                {/* Menu Side */}
                <div className="flex-1 border-r border-black/5 flex flex-col min-w-0">
                    <div className="p-4 border-b border-black/5 bg-white/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                            <Input 
                                placeholder="Search items..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 h-11 rounded-xl border-2"
                            />
                        </div>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {filteredItems.map(it => (
                                <button 
                                    key={it.id} 
                                    onClick={() => addToCart(it)}
                                    className="p-3 bg-white border-2 border-black/5 rounded-2xl text-left hover:border-primary transition-all active:scale-95 group shadow-sm"
                                >
                                    <p className="text-[10px] font-black uppercase opacity-40 mb-1 leading-none">{it.category}</p>
                                    <p className="font-bold text-xs leading-tight mb-2 line-clamp-2">{it.name}</p>
                                    <p className="font-black text-primary text-sm">₹{it.price.toFixed(0)}</p>
                                </button>
                            ))}
                        </div>
                    </ScrollArea>
                </div>

                {/* Cart Side */}
                <div className="w-[300px] bg-black/5 flex flex-col shrink-0">
                    <div className="p-4 border-b border-black/5 flex justify-between items-center">
                        <h3 className="font-black text-[10px] uppercase tracking-widest opacity-40">Selection</h3>
                        <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase" onClick={() => setCart([])}>Clear</Button>
                    </div>
                    <ScrollArea className="flex-1 p-4">
                        <div className="space-y-3">
                            {cart.map((c, idx) => (
                                <div key={idx} className="flex justify-between items-start gap-2 bg-white p-3 rounded-xl shadow-sm">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-xs truncate leading-none">{c.item.name}</p>
                                        <p className="text-[9px] font-black opacity-40 mt-1 uppercase">₹{c.item.price} x {c.qty}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-black text-xs">
                                        <button onClick={() => {
                                            if(c.qty > 1) setCart(p => p.map(i => i.item.id === c.item.id ? {...i, qty: i.qty - 1} : i));
                                            else setCart(p => p.filter(i => i.item.id !== c.item.id));
                                        }} className="h-5 w-5 rounded-md bg-black/5 flex items-center justify-center">-</button>
                                        <span className="w-4 text-center">{c.qty}</span>
                                        <button onClick={() => addToCart(c.item)} className="h-5 w-5 rounded-md bg-black/5 flex items-center justify-center">+</button>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && <div className="text-center py-20 opacity-20"><ShoppingBag className="h-10 w-10 mx-auto mb-2"/><p className="text-[8px] font-black uppercase">No items</p></div>}
                        </div>
                    </ScrollArea>
                    <div className="p-6 bg-white border-t border-black/5 space-y-4">
                        <div className="flex justify-between items-baseline">
                            <span className="text-[10px] font-black uppercase opacity-40">Total</span>
                            <span className="text-2xl font-black text-primary">₹{total.toFixed(0)}</span>
                        </div>
                        <Button 
                            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20" 
                            disabled={cart.length === 0 || isProcessing}
                            onClick={handleGenerateBill}
                        >
                            {isProcessing ? <Loader2 className="animate-spin h-4 w-4" /> : <Receipt className="mr-2 h-4 w-4" />}
                            Generate Bill
                        </Button>
                    </div>
                </div>
            </div>
        </DialogContent>
    );
}

function SessionCard({ session, isUpdating, onDismissService, isKitchenMode, store, isSalon }: { session: Session; isUpdating: boolean; onDismissService: (id: string) => void; isKitchenMode: boolean; store: Store; isSalon: boolean }) {
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

  const handlePrint = () => {
      const win = window.open('', '_blank');
      if (!win) return;
      
      const itemsHtml = session.orders.flatMap(o => o.items).map(it => `
          <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 5px;">
              <span>${it.productName} x${it.quantity}</span>
              <span>₹${(it.price * it.quantity).toFixed(0)}</span>
          </div>
      `).join('');

      win.document.write(`
          <html>
              <head>
                  <title>Bill #${session.id.slice(-4)}</title>
                  <style>
                      body { font-family: monospace; padding: 20px; width: 300px; }
                      .header { text-align: center; border-bottom: 1px dashed #000; padding-bottom: 10px; margin-bottom: 10px; }
                      .footer { border-top: 1px dashed #000; padding-top: 10px; margin-top: 10px; text-align: center; }
                      .total { font-size: 18px; font-weight: bold; margin-top: 10px; }
                  </style>
              </head>
              <body>
                  <div class="header">
                      <h2 style="margin: 0;">${store.name}</h2>
                      <p style="font-size: 10px;">${store.address}</p>
                      <p style="font-size: 12px;">Bill: #${session.id.slice(-4)} | ${isSalon ? 'Chair' : 'Table'}: ${session.tableNumber || 'Counter'}</p>
                  </div>
                  <div class="items">${itemsHtml}</div>
                  <div class="total" style="display: flex; justify-content: space-between;">
                      <span>TOTAL</span>
                      <span>₹${session.totalAmount.toFixed(0)}</span>
                  </div>
                  <div class="footer">
                      <p>Thank you! Visit Again.</p>
                      <p style="font-size: 8px;">Generated by LocalBasket</p>
                  </div>
                  <script>window.onload = () => { window.print(); window.close(); }</script>
              </body>
          </html>
      `);
  };

  const meta = STATUS_META[session.status] || STATUS_META.Pending;
  if (isKitchenMode && !['Pending', 'Processing'].includes(session.status)) return null;

  const titleIcon = session.orderType === 'takeaway' ? <ShoppingBag className="h-4 w-4" /> : session.orderType === 'counter' ? <Calculator className="h-4 w-4" /> : (isSalon ? <Scissors className="h-4 w-4" /> : <Utensils className="h-4 w-4" />);

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
                    <CardTitle className="text-sm font-black">{isSalon ? 'Chair' : ''} {session.tableNumber || 'Walking'}</CardTitle>
                    <CardDescription className="text-[7px] opacity-40">#{session.id.slice(-4)}</CardDescription>
                 </div>
            </div>
             <div className="flex gap-1">
                {session.status === 'Billed' && <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md hover:bg-black/5" onClick={handlePrint}><Printer className="h-3 w-3"/></Button>}
                <Badge className="text-[7px] font-black uppercase h-4 px-1.5" variant={meta.variant}>{meta.label}</Badge>
             </div>
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
                    {session.status === 'Billed' ? 'Cash Received' : (isSalon ? 'Start Service' : 'To Kitchen')}
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
                    {order.status === 'Pending' ? 'Process Job' : 'Next Step'}
                </Button>
            </CardFooter>
        </Card>
    );
}

export default function StoreOrdersPage() {
  const { firestore } = useFirebase();
  const [isUpdating, startUpdate] = useTransition();
  const [isKitchenMode, setIsKitchenMode] = useState(false);
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const { toast } = useToast();
  const { stores, userStore, loading: isAppLoading } = useAppStore();

  const myStore = useMemo(() => userStore || stores[0], [userStore, stores]);
  const isSalon = useMemo(() => myStore?.businessType === 'salon' || myStore?.name.toLowerCase().includes('salon'), [myStore]);

  const activeOrdersQuery = useMemoFirebase(() =>
    firestore && myStore ? query(collection(firestore, 'orders'), where('storeId', '==', myStore.id), where('isActive', '==', true), orderBy('orderDate', 'desc'), limit(50)) : null,
  [firestore, myStore]);

  const menuQuery = useMemoFirebase(() => 
    firestore && myStore ? query(collection(firestore, `stores/${myStore.id}/menus`), limit(1)) : null,
  [firestore, myStore]);

  const { data: activeOrders, isLoading: ordersLoading } = useCollection<Order>(activeOrdersQuery);
  const { data: menus } = useCollection<Menu>(menuQuery);
  const menuItems = useMemo(() => menus?.[0]?.items || [], [menus]);

  const { sessions, homeDeliveries } = useMemo(() => {
    const tableSessions: Record<string, Session> = {};
    const onlineJobs: Order[] = [];
    if (!activeOrders) return { sessions: {}, homeDeliveries: [] };
    activeOrders.forEach(o => {
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

  if (isAppLoading || ordersLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;

  return (
    <div className={cn("min-h-screen py-4 px-3 max-w-7xl mx-auto transition-colors duration-500", isKitchenMode ? "bg-slate-950" : "bg-slate-50")}>
        <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
            <QuickCounterSaleDialog 
                storeId={myStore!.id} 
                menuItems={menuItems} 
                onComplete={() => setIsNewSaleOpen(false)}
                isSalon={isSalon}
            />
        </Dialog>

        <div className="flex justify-between items-center mb-6 border-b pb-3 border-black/10">
            <div>
                <h1 className={cn("text-xl font-black tracking-tighter", isKitchenMode ? "text-white" : "text-gray-900")}>OP CENTER</h1>
                <p className={cn("text-[8px] font-bold uppercase opacity-40", isKitchenMode ? "text-primary" : "text-muted-foreground")}>{myStore?.name} • {isSalon ? 'SALON' : 'RESTAURANT'}</p>
            </div>
            <div className="flex gap-2">
                {!isSalon && (
                    <Button onClick={() => setIsKitchenMode(!isKitchenMode)} variant="outline" size="sm" className={cn("h-8 px-3 rounded-lg font-black text-[9px] uppercase border-2", isKitchenMode && "bg-primary text-white border-primary")}>
                        {isKitchenMode ? <Monitor className="h-3 w-3 mr-1.5"/> : <ChefHat className="h-3 w-3 mr-1.5"/>} {isKitchenMode ? 'POS' : 'KDS'}
                    </Button>
                )}
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <section className="space-y-3">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-blue-600 flex items-center gap-1.5"><Truck className="h-3 w-3"/> Out-Call & Online</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {homeDeliveries.map(o => <DeliveryOrderCard key={o.id} order={o} onStatusChange={handleOrderUpdate} isUpdating={isUpdating} isKitchenMode={isKitchenMode} />)}
                    {homeDeliveries.length === 0 && <p className="text-[8px] opacity-30 uppercase font-black py-8 text-center border-2 border-dashed rounded-xl">No active jobs</p>}
                </div>
            </section>

            <section className="space-y-3">
                <div className="flex justify-between items-center">
                    <h2 className="text-[10px] font-black uppercase tracking-widest text-green-600 flex items-center gap-1.5">{isSalon ? <Scissors className="h-3 w-3"/> : <Utensils className="h-3 w-3"/>} {isSalon ? 'Chair & Counter' : 'Table & Counter'}</h2>
                    <Button onClick={() => setIsNewSaleOpen(true)} size="sm" variant="outline" className="h-7 px-3 rounded-lg font-black text-[8px] uppercase border-2 border-green-600/30 text-green-600">
                        <PlusCircle className="h-3 w-3 mr-1"/> {isSalon ? 'New Checkout' : 'New Sale'}
                    </Button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {Object.values(sessions).map(s => <SessionCard key={s.id} session={s} isUpdating={isUpdating} onDismissService={handleDismissService} isKitchenMode={isKitchenMode} store={myStore!} isSalon={isSalon} />)}
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
