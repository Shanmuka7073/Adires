
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
  Scissors,
  Calendar as CalendarIcon,
  BarChart3,
  History,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Volume2,
  Filter,
  UserPlus
} from 'lucide-react';
import {
  collection, query, where, orderBy, doc, updateDoc, serverTimestamp, Timestamp, limit, getDocs, setDoc, writeBatch
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useMemo, useState, useTransition, useEffect, useCallback, useRef } from 'react';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogDescription
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { playTickSound } from '@/lib/cart';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfDay, endOfDay, subDays } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"


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
    const { firestore } = useFirebase();
    const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredItems = useMemo(() => {
        return menuItems.filter(i => 
            i.isAvailable !== false && 
            i.name.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [menuItems, searchTerm]);

    const addToCart = (item: MenuItem) => {
        playTickSound();
        setCart(prev => {
            const existing = prev.find(i => i.item.id === item.id);
            if (existing) return prev.map(i => i.item.id === item.id ? { ...i, qty: i.qty + 1 } : i);
            return [...prev, { item, qty: 1 }];
        });
    };

    const total = cart.reduce((acc, i) => acc + (i.item.price * i.qty), 0);

    const handleGenerateBill = () => {
        if (cart.length === 0 || !firestore) return;
        
        // Generate a highly unique ID for offline resilience
        const orderId = `counter-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const orderRef = doc(firestore, 'orders', orderId);
        
        const orderItems: OrderItem[] = cart.map(c => ({
            id: crypto.randomUUID(),
            orderId: orderId,
            productId: c.item.id,
            menuItemId: c.item.id,
            productName: c.item.name,
            variantSku: `${c.item.id}-default`,
            variantWeight: '1 pc',
            quantity: c.qty,
            price: c.item.price
        }));

        const orderData = {
            id: orderId,
            storeId: storeId,
            tableNumber: 'Counter',
            sessionId: orderId,
            userId: 'guest',
            customerName: 'Walk-in Guest',
            deliveryAddress: 'In-store counter',
            status: 'Billed',
            orderType: 'counter',
            isActive: true,
            orderDate: serverTimestamp(),
            updatedAt: serverTimestamp(),
            items: orderItems,
            totalAmount: total,
        };

        // NON-BLOCKING: No await here to allow multiple bills offline
        setDoc(orderRef, orderData).catch(async (serverError) => {
            const permissionError = new FirestorePermissionError({
                path: orderRef.path,
                operation: 'create',
                requestResourceData: orderData
            });
            errorEmitter.emit('permission-error', permissionError);
        });

        toast({ title: "Bill Generated!" });
        setCart([]);
        onComplete();
    };

    return (
        <DialogContent className="max-w-5xl w-[95vw] rounded-[2rem] md:rounded-[2.5rem] border-0 shadow-2xl h-[95vh] md:h-[90vh] flex flex-col p-0 overflow-hidden">
            <div className="p-4 md:p-6 bg-primary/5 border-b border-black/5 shrink-0">
                <DialogTitle className="text-xl md:text-2xl font-black uppercase tracking-tight">Quick {isSalon ? 'Checkout' : 'Counter POS'}</DialogTitle>
                <DialogDescription className="text-[10px] md:text-xs font-bold opacity-40 uppercase">Two-touch billing for walk-ins</DialogDescription>
            </div>

            <div className="flex-1 flex flex-col md:flex-row min-h-0">
                <div className="flex-1 border-b md:border-b-0 md:border-r border-black/5 flex flex-col min-h-0">
                    <div className="p-3 md:p-4 border-b border-black/5 bg-white/50">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                            <Input 
                                placeholder="Search items..." 
                                value={searchTerm} 
                                onChange={e => setSearchTerm(e.target.value)}
                                className="pl-10 h-10 md:h-11 rounded-xl border-2"
                            />
                        </div>
                    </div>
                    <ScrollArea className="flex-1 bg-white">
                        {menuItems.length > 0 ? (
                            <div className="p-3 md:p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                                {filteredItems.map(it => (
                                    <button 
                                        key={it.id} 
                                        onClick={() => addToCart(it)}
                                        className="p-2 md:p-3 bg-white border-2 border-black/5 rounded-xl md:rounded-2xl text-left hover:border-primary transition-all active:scale-95 group shadow-sm flex flex-col h-full"
                                    >
                                        <p className="text-[8px] md:text-[10px] font-black uppercase opacity-40 mb-1 leading-none truncate">{it.category}</p>
                                        <p className="font-bold text-[11px] md:text-xs leading-tight mb-1 md:mb-2 line-clamp-2 flex-1">{it.name}</p>
                                        <p className="font-black text-primary text-xs md:text-sm mt-auto">₹{it.price.toFixed(0)}</p>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="p-12 text-center flex flex-col items-center justify-center gap-4 opacity-40">
                                <Utensils className="h-12 w-12" />
                                <div className="space-y-1">
                                    <p className="font-black uppercase tracking-widest text-xs">No items found</p>
                                    <p className="text-[10px] font-bold">Please set up your digital menu items first.</p>
                                </div>
                                <Button asChild variant="outline" className="rounded-xl font-black text-[10px] uppercase h-10 px-6 border-2">
                                    <Link href="/dashboard/owner/menu-manager">Open Menu Manager</Link>
                                </Button>
                            </div>
                        )}
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                </div>

                <div className="h-[280px] md:h-auto md:w-[320px] bg-black/5 flex flex-col shrink-0">
                    <div className="p-3 md:p-4 border-b border-black/5 flex justify-between items-center bg-white/50 md:bg-transparent">
                        <h3 className="font-black text-[9px] md:text-[10px] uppercase tracking-widest opacity-40">Current Selection</h3>
                        <Button variant="ghost" size="sm" className="h-6 text-[8px] font-black uppercase" onClick={() => setCart([])}>Clear</Button>
                    </div>
                    <ScrollArea className="flex-1">
                        <div className="p-3 md:p-4 space-y-2 md:space-y-3">
                            {cart.map((c, idx) => (
                                <div key={idx} className="flex justify-between items-start gap-2 bg-white p-2 md:p-3 rounded-xl shadow-sm border border-black/5">
                                    <div className="min-w-0 flex-1">
                                        <p className="font-bold text-[11px] md:text-xs truncate leading-none">{c.item.name}</p>
                                        <p className="text-[8px] md:text-[9px] font-black opacity-40 mt-1 uppercase">₹{c.item.price} x {c.qty}</p>
                                    </div>
                                    <div className="flex items-center gap-1.5 font-black text-[10px] md:text-xs shrink-0">
                                        <button onClick={() => {
                                            playTickSound();
                                            if(c.qty > 1) setCart(p => p.map(i => i.item.id === c.item.id ? {...i, qty: i.qty - 1} : i));
                                            else setCart(p => p.filter(i => i.item.id !== c.item.id));
                                        }} className="h-5 w-5 md:h-6 md:w-6 rounded-md bg-black/5 flex items-center justify-center hover:bg-black/10">-</button>
                                        <span className="w-3 md:w-4 text-center">{c.qty}</span>
                                        <button onClick={() => addToCart(c.item)} className="h-5 w-5 md:h-6 md:w-6 rounded-md bg-black/5 flex items-center justify-center hover:bg-black/10">+</button>
                                    </div>
                                </div>
                            ))}
                            {cart.length === 0 && (
                                <div className="text-center py-12 md:py-32 opacity-20">
                                    <ShoppingBag className="h-8 w-8 md:h-12 md:w-12 mx-auto mb-2"/>
                                    <p className="text-[8px] md:text-[10px] font-black uppercase tracking-widest">No items selected</p>
                                </div>
                            )}
                        </div>
                        <ScrollBar orientation="vertical" />
                    </ScrollArea>
                    <div className="p-4 md:p-6 bg-white border-t border-black/5 space-y-3 md:space-y-4">
                        <div className="flex justify-between items-baseline">
                            <span className="text-[9px] md:text-[10px] font-black uppercase opacity-40">Total Amount</span>
                            <span className="text-xl md:text-2xl font-black text-primary">₹{total.toFixed(0)}</span>
                        </div>
                        <Button 
                            className="w-full h-12 md:h-14 rounded-xl md:rounded-2xl font-black uppercase tracking-widest text-[10px] md:text-xs shadow-xl shadow-primary/20" 
                            disabled={cart.length === 0}
                            onClick={handleGenerateBill}
                        >
                            <Receipt className="mr-2 h-4 w-4 md:h-5 md:w-5" />
                            Generate Bill
                        </Button>
                    </div>
                </div>
            </div>
        </DialogContent>
    );
}

function SessionCard({ session, store, isSalon, onDismissService }: { session: Session; store: Store; isSalon: boolean; onDismissService: (s: Session) => void }) {
  const { toast } = useToast();
  const { firestore } = useFirebase();

  const handleAction = () => {
    if (!firestore) return;
    const batch = writeBatch(firestore);
    const isBilled = session.status === 'Billed';
    
    session.orders.forEach(order => {
        const orderRef = doc(firestore, 'orders', order.id);
        if (isBilled) {
            batch.update(orderRef, { status: 'Completed', isActive: false, updatedAt: serverTimestamp() });
        } else {
            batch.update(orderRef, { status: 'Billed', updatedAt: serverTimestamp() });
        }
    });

    // NON-BLOCKING: No await
    batch.commit().catch(async (e) => {
        toast({ variant: 'destructive', title: 'Action Failed' });
    });
    toast({ title: 'Success' });
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
  const isBilled = session.status === 'Billed';
  
  const titleIcon = session.orderType === 'takeaway' ? <ShoppingBag className="h-4 w-4" /> : session.orderType === 'counter' ? <Calculator className="h-4 w-4" /> : (isSalon ? <Scissors className="h-4 w-4" /> : <Utensils className="h-4 w-4" />);

  return (
    <Card className={cn(
        "rounded-xl shadow-md border-0 relative transition-all", 
        isBilled ? "bg-green-50 ring-1 ring-green-500" : "bg-white",
        session.needsService && "ring-2 ring-red-500 animate-pulse"
    )}>
      {session.needsService && (
          <div className="absolute top-0 left-0 w-full h-6 bg-red-600 flex items-center justify-between px-2 rounded-t-xl z-10">
              <span className="text-[8px] font-black uppercase text-white flex items-center gap-1"><BellRing className="h-2.5 w-2.5"/> {session.serviceType || 'Service'}</span>
              <button 
                onClick={() => onDismissService(session)}
                className="h-4 px-2 rounded-md bg-white/20 hover:bg-white/40 text-white text-[7px] font-black uppercase transition-colors"
              >
                Resolve
              </button>
          </div>
      )}
      <CardHeader className={cn("p-2 pb-1", session.needsService && "pt-7")}>
        <div className="flex justify-between items-start">
            <div className="flex items-center gap-1.5 min-w-0">
                 <div className="opacity-20 shrink-0">{titleIcon}</div>
                 <div className="min-w-0">
                    <CardTitle className={cn("text-sm font-black truncate", isBilled ? "text-gray-950" : "text-gray-900")}>{isSalon ? 'Chair' : ''} {session.tableNumber || 'Walking'}</CardTitle>
                    <CardDescription className="text-[7px] opacity-40">#{session.id.slice(-4)}</CardDescription>
                 </div>
            </div>
             <div className="flex gap-1 shrink-0">
                {isBilled && <Button variant="ghost" size="icon" className="h-5 w-5 rounded-md hover:bg-black/5" onClick={handlePrint}><Printer className="h-3 w-3"/></Button>}
                <Badge className="text-[7px] font-black uppercase h-4 px-1.5" variant={meta.variant}>{meta.label}</Badge>
             </div>
        </div>
      </CardHeader>
      <CardContent className="p-2 pt-1 space-y-1">
          {session.orders.flatMap(o => o.items).map((it, i) => (
              <div key={i} className={cn("flex justify-between items-center text-[9px] font-bold py-1 px-2 rounded-md mb-0.5", isBilled ? "bg-black/5" : "bg-black/5")}>
                  <span className={cn("truncate pr-2", isBilled ? "text-gray-800" : "text-gray-700")}>{it.productName} <span className="opacity-40 font-black">x{it.quantity}</span></span>
                  <span className={cn("shrink-0 font-black", isBilled ? "text-gray-950" : "text-gray-600")}>₹{(it.price * it.quantity).toFixed(0)}</span>
              </div>
          ))}
      </CardContent>
      <CardFooter className={cn("p-2 pt-1 flex flex-col gap-1.5 rounded-b-xl bg-black/5")}>
            <div className="flex justify-between w-full text-[8px] font-black uppercase">
                <span className={cn("opacity-40", isBilled ? "text-black" : "text-black")}>Total Session</span>
                <span className={cn("font-black", isBilled ? "text-gray-950" : "text-primary")}>₹{session.totalAmount.toFixed(0)}</span>
            </div>
            <div className="flex gap-1 w-full">
                <Button className="w-full h-7 rounded-lg text-[8px] font-black uppercase shadow-sm" onClick={handleAction}>
                    {isBilled ? 'Cash Received' : (isSalon ? 'Start Service' : 'Send to Kitchen')}
                </Button>
            </div>
      </CardFooter>
    </Card>
  )
}

function DeliveryOrderCard({ order, onStatusChange }: { order: Order; onStatusChange: (id: string, s: any) => void; }) {
    const meta = STATUS_META[order.status] || STATUS_META.Pending;
    const isBilled = order.status === 'Billed';

    const getNextStatus = (current: string) => {
        if (current === 'Pending') return 'Processing';
        if (current === 'Processing') return 'Out for Delivery';
        if (current === 'Out for Delivery') return 'Delivered';
        return current;
    };

    return (
        <Card className={cn(
            "rounded-xl shadow-md border-0 overflow-hidden relative transition-all", 
            isBilled ? "bg-green-50 ring-1 ring-green-500" : "bg-white"
        )}>
            <CardHeader className={cn("p-2 pb-1 border-b border-black/5", isBilled ? "bg-green-100/50" : "bg-blue-50/50")}>
                <div className="flex justify-between items-start">
                    <div className="min-w-0 pr-2">
                        <CardTitle className={cn("text-[10px] font-black uppercase truncate", isBilled ? "text-gray-950" : "text-gray-950")}>{order.customerName}</CardTitle>
                        <CardDescription className={cn("text-[7px] truncate font-bold opacity-60", "text-gray-600")}>{order.deliveryAddress}</CardDescription>
                    </div>
                    <Badge variant="outline" className="text-[7px] font-black uppercase shrink-0 h-4 border-primary/20">{meta.label}</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-2 pt-1 space-y-0.5">
                {order.items.map((it, idx) => (
                    <div key={idx} className={cn("flex justify-between items-center text-[9px] font-bold py-1 px-2 rounded-md mb-0.5", isBilled ? "bg-black/5" : "bg-black/5")}>
                        <span className={cn("truncate pr-2", isBilled ? "text-gray-800" : "text-gray-700")}>{it.productName} <span className="opacity-40 font-black">x{it.quantity}</span></span>
                        <span className={cn("font-black", isBilled ? "text-gray-950" : "text-gray-600")}>₹{(it.price * it.quantity).toFixed(0)}</span>
                    </div>
                ))}
            </CardContent>
            <CardFooter className={cn("p-2 pt-1 flex gap-1", "bg-black/5")}>
                <Button className="flex-1 h-7 rounded-lg text-[8px] font-black uppercase shadow-sm" onClick={() => onStatusChange(order.id, getNextStatus(order.status))}>
                    {order.status === 'Pending' ? 'Process Job' : 'Next Step'}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-black/5"><UserPlus className="h-3 w-3" /></Button>
            </CardFooter>
        </Card>
    );
}

function HistoryAndInsightsCenter({ storeId }: { storeId: string }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [history, setHistory] = useState<Order[]>([]);
    const [isLoading, startLoading] = useTransition();
    const [days, setDays] = useState(7);

    const fetchHistory = useCallback(async () => {
        if (!firestore) return;
        startLoading(async () => {
            try {
                const start = startOfDay(subDays(new Date(), days));
                const q = query(
                    collection(firestore, 'orders'),
                    where('storeId', '==', storeId),
                    where('orderDate', '>=', Timestamp.fromDate(start)),
                    orderBy('orderDate', 'desc'),
                    limit(50)
                );
                const snap = await getDocs(q);
                setHistory(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
            } catch (e) {
                console.error(e);
                toast({ variant: 'destructive', title: 'Fetch Error', description: 'Failed to load history.' });
            }
        });
    }, [firestore, storeId, days, toast]);

    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    const stats = useMemo(() => {
        const completed = history.filter(o => ['Completed', 'Delivered'].includes(o.status));
        const totalSales = completed.reduce((acc, o) => acc + o.totalAmount, 0);
        const aov = completed.length > 0 ? totalSales / completed.length : 0;
        
        const itemMap = new Map<string, number>();
        completed.forEach(o => o.items.forEach(i => {
            itemMap.set(i.productName, (itemMap.get(i.productName) || 0) + i.quantity);
        }));
        
        const topItems = Array.from(itemMap.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        return { totalSales, aov, orderCount: completed.length, topItems };
    }, [history]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="rounded-3xl border-0 shadow-lg bg-white">
                    <CardHeader className="pb-2 flex flex-row justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Total Revenue</span>
                        <TrendingUp className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-black tracking-tighter text-gray-950">₹{stats.totalSales.toFixed(0)}</p>
                        <p className="text-[10px] font-bold opacity-40 uppercase mt-1">From {stats.orderCount} orders</p>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-lg bg-white">
                    <CardHeader className="pb-2 flex flex-row justify-between items-center">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Avg Order Value</span>
                        <Calculator className="h-4 w-4 text-blue-500" />
                    </CardHeader>
                    <CardContent>
                        <p className="text-3xl font-black tracking-tighter text-gray-950">₹{stats.aov.toFixed(0)}</p>
                        <p className="text-[10px] font-bold opacity-40 uppercase mt-1">Per visit profit driver</p>
                    </CardContent>
                </Card>
                <Card className="rounded-3xl border-0 shadow-lg bg-white">
                    <CardHeader className="pb-2">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Historical Filter</span>
                    </CardHeader>
                    <CardContent className="flex gap-2">
                        {[7, 14, 30].map(d => (
                            <Button key={d} variant={days === d ? 'default' : 'outline'} size="sm" onClick={() => setDays(d)} className="rounded-xl font-black text-[10px] h-8 flex-1">
                                {d}D
                            </Button>
                        ))}
                    </CardContent>
                </Card>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <Card className="rounded-3xl border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b border-black/5">
                        <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                            <History className="h-5 w-5 text-primary" /> Past Orders
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[400px]">
                            {isLoading ? (
                                <div className="p-8 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 opacity-20" /></div>
                            ) : history.length > 0 ? (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="text-[9px] font-black uppercase tracking-widest">Customer</TableHead>
                                            <TableHead className="text-[9px] font-black uppercase tracking-widest">Total</TableHead>
                                            <TableHead className="text-right text-[9px] font-black uppercase tracking-widest">Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {history.map(o => (
                                            <TableRow key={o.id} className="hover:bg-muted/30">
                                                <TableCell className="py-3">
                                                    <p className="font-bold text-xs">{o.customerName || 'Walk-in'}</p>
                                                    <p className="text-[8px] opacity-40 uppercase">{format(toDateSafe(o.orderDate), 'dd MMM, p')}</p>
                                                </TableCell>
                                                <TableCell className="font-black text-xs text-primary">₹{o.totalAmount.toFixed(0)}</TableCell>
                                                <TableCell className="text-right">
                                                    <Badge variant={STATUS_META[o.status]?.variant || 'outline'} className="text-[8px] font-black uppercase px-1.5 h-4">
                                                        {STATUS_META[o.status]?.label || o.status}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            ) : <div className="p-20 text-center opacity-30"><p className="text-[10px] font-black uppercase tracking-widest">No history for this range</p></div>}
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="rounded-3xl border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b border-black/5">
                        <CardTitle className="text-xl font-black uppercase tracking-tight flex items-center gap-2">
                            <Sparkles className="h-5 w-5 text-primary" /> Popular Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6">
                        <div className="space-y-4">
                            {stats.topItems.map(([name, count]) => (
                                <div key={name} className="flex justify-between items-center p-4 bg-muted/30 rounded-2xl border-2 border-transparent hover:border-primary/20 transition-all">
                                    <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center font-black text-primary text-xs">
                                            {count}
                                        </div>
                                        <span className="font-bold text-xs uppercase tracking-tight">{name}</span>
                                    </div>
                                    <ArrowRight className="h-4 w-4 opacity-20" />
                                </div>
                            ))}
                            {stats.topItems.length === 0 && <p className="text-center py-20 text-[10px] font-black uppercase opacity-30 tracking-widest">Data processing...</p>}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

export default function StoreOrdersPage() {
  const { firestore, user } = useFirebase();
  const [isKitchenMode, setIsKitchenMode] = useState(false);
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('live');
  const [liveSearch, setLiveSearch] = useState('');
  const [liveFilter, setLiveFilter] = useState('all');
  const { toast } = useToast();
  const { stores, userStore, loading: isAppLoading } = useAppStore();

  const myStore = useMemo(() => {
      if (userStore) return userStore;
      return stores.find(s => s.ownerId === user?.uid) || null;
  }, [userStore, stores, user?.uid]);

  const { isSalon, isRestaurant } = useMemo(() => {
    if (!myStore) return { isSalon: false, isRestaurant: false };
    if (myStore.businessType === 'salon') return { isSalon: true, isRestaurant: false };
    if (myStore.businessType === 'restaurant') return { isSalon: false, isRestaurant: true };
    const pool = `${myStore.name} ${myStore.description}`.toLowerCase();
    const isS = ['salon', 'saloon', 'parlour', 'beauty', 'hair', 'cut', 'spa', 'massage', 'style', 'makeup', 'barber'].some(kw => pool.includes(kw));
    return { isSalon: isS, isRestaurant: !isS };
  }, [myStore]);

  const activeOrdersQuery = useMemoFirebase(() =>
    firestore && myStore ? query(collection(firestore, 'orders'), where('storeId', '==', myStore.id), where('isActive', '==', true), orderBy('orderDate', 'desc'), limit(100)) : null,
  [firestore, myStore]);

  const menuQuery = useMemoFirebase(() => 
    firestore && myStore ? query(collection(firestore, `stores/${myStore.id}/menus`), limit(1)) : null,
  [firestore, myStore]);

  const { data: activeOrders, isLoading: ordersLoading } = useCollection<Order>(activeOrdersQuery);
  const { data: menus, isLoading: menusLoading } = useCollection<Menu>(menuQuery);
  const menuItems = useMemo(() => menus?.[0]?.items || [], [menus]);

  const { sessions, homeDeliveries } = useMemo(() => {
    const tableSessions: Record<string, Session> = {};
    const onlineJobs: Order[] = [];
    if (!activeOrders) return { sessions: {}, homeDeliveries: [] };

    const searchLower = liveSearch.toLowerCase();

    activeOrders.forEach(o => {
        const matchesSearch = 
            o.customerName.toLowerCase().includes(searchLower) || 
            o.tableNumber?.toLowerCase().includes(searchLower) ||
            o.id.toLowerCase().includes(searchLower);
        
        if (liveSearch && !matchesSearch) return;

        if (liveFilter === 'new' && o.status !== 'Pending') return;
        if (liveFilter === 'processing' && o.status !== 'Processing') return;
        if (liveFilter === 'delivery' && o.status !== 'Out for Delivery') return;
        if (liveFilter === 'billed' && o.status !== 'Billed') return;

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
  }, [activeOrders, liveSearch, liveFilter]);

  const handleOrderUpdate = (orderId: string, status: any) => {
      if (!firestore) return;
      const orderRef = doc(firestore, 'orders', orderId);
      const isActive = !['Delivered', 'Completed', 'Cancelled'].includes(status);
      
      // NON-BLOCKING: No await for offline responsiveness
      updateDoc(orderRef, {
          status,
          isActive,
          updatedAt: serverTimestamp()
      }).catch(async (e) => {
          errorEmitter.emit('permission-error', new FirestorePermissionError({
              path: orderRef.path,
              operation: 'update',
              requestResourceData: { status }
          }));
      });
      toast({ title: "Updated" });
  }

  const handleDismissService = (session: Session) => {
      if (!firestore) return;
      const batch = writeBatch(firestore);
      let count = 0;
      session.orders.forEach(order => {
          if (order.needsService) {
              batch.update(doc(firestore, 'orders', order.id), { 
                  needsService: false, 
                  serviceType: null, 
                  updatedAt: serverTimestamp() 
              });
              count++;
          }
      });
      
      if (count > 0) {
          batch.commit().catch(e => toast({ variant: 'destructive', title: "Failed to resolve" }));
          toast({ title: "Resolved" }); 
      }
  };

  const playNewOrderSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5
      oscillator.frequency.exponentialRampToValueAtTime(1109, audioCtx.currentTime + 0.1); // C#6
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.5);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.5);
    } catch (e) {}
  }, []);

  const playServiceRequestSound = useCallback(() => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
      oscillator.frequency.setValueAtTime(660, audioCtx.currentTime + 0.2);
      oscillator.frequency.setValueAtTime(440, audioCtx.currentTime + 0.4);
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.8);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.8);
    } catch (e) {}
  }, []);

  const prevOrderIds = useRef<Set<string>>(new Set());
  const prevServiceIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!activeOrders) return;

    const currentIds = new Set(activeOrders.map(o => o.id));
    const newIds = activeOrders.filter(o => !prevOrderIds.current.has(o.id));

    if (newIds.length > 0 && prevOrderIds.current.size > 0) {
      playNewOrderSound();
      toast({ title: "New Order Received!", description: `You have ${newIds.length} new items.` });
      if (Notification.permission === 'granted') {
          new Notification("New Order", { body: `Received ${newIds.length} new order(s).` });
      }
    }
    prevOrderIds.current = currentIds;

    const currentService = new Set(activeOrders.filter(o => o.needsService).map(o => o.id));
    const newService = activeOrders.filter(o => o.needsService && !prevServiceIds.current.has(o.id));

    if (newService.length > 0) {
      playServiceRequestSound();
      toast({ variant: 'destructive', title: "Service Required!", description: "A customer is calling for assistance." });
      if (Notification.permission === 'granted') {
          new Notification("Service Required", { body: "A customer is calling for assistance." });
      }
    }
    prevServiceIds.current = currentService;
  }, [activeOrders, toast, playNewOrderSound, playServiceRequestSound]);

  if (isAppLoading || ordersLoading || menusLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>;
  if (!myStore) return <div className="p-12 text-center"><p className="font-black uppercase tracking-widest text-xs opacity-40">Store information not found.</p></div>;

  return (
    <div className={cn("min-h-screen py-4 px-3 max-w-7xl mx-auto transition-colors duration-500", isKitchenMode && activeTab === 'live' ? "bg-slate-950" : "bg-slate-50")}>
        <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
            <QuickCounterSaleDialog 
                storeId={myStore.id} 
                menuItems={menuItems} 
                onComplete={() => setIsNewSaleOpen(false)}
                isSalon={isSalon}
            />
        </Dialog>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 border-b pb-3 border-black/10 gap-4">
            <div>
                <h1 className={cn("text-2xl font-black tracking-tighter", isKitchenMode && activeTab === 'live' ? "text-white" : "text-gray-900")}>OP CENTER</h1>
                <p className={cn("text-[8px] font-black uppercase tracking-widest opacity-40", isKitchenMode && activeTab === 'live' ? "text-primary" : "text-muted-foreground")}>{myStore.name} • {isSalon ? 'SALON' : 'RESTAURANT'}</p>
            </div>
            
            <div className="flex gap-2 w-full sm:w-auto">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="bg-black/5 p-1 rounded-xl border">
                    <TabsList className="bg-transparent h-8 p-0 gap-1">
                        <TabsTrigger value="live" className="rounded-lg font-black text-[9px] uppercase h-6 px-4">Live Hub</TabsTrigger>
                        <TabsTrigger value="history" className="rounded-lg font-black text-[9px] uppercase h-6 px-4">Insights</TabsTrigger>
                    </TabsList>
                </Tabs>
                
                {activeTab === 'live' && !isSalon && (
                    <Button onClick={() => setIsKitchenMode(!isKitchenMode)} variant="outline" size="sm" className={cn("h-10 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest border-2", isKitchenMode && "bg-primary text-white border-primary")}>
                        {isKitchenMode ? <Monitor className="h-4 w-4 mr-2"/> : <ChefHat className="h-4 w-4 mr-2"/>} {isKitchenMode ? 'POS VIEW' : 'KITCHEN'}
                    </Button>
                )}
                
                <Button onClick={() => setIsNewSaleOpen(true)} size="sm" variant="outline" className="h-10 px-4 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 border-green-600/30 text-green-600 hover:bg-green-50 shadow-sm">
                    <PlusCircle className="h-3.5 w-3.5 mr-1.5"/> New Sale
                </Button>
            </div>
        </div>

        <Tabs value={activeTab} className="w-full">
            <TabsContent value="live" className="mt-0">
                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="relative flex-1">
                        <Search className={cn("absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4", isKitchenMode ? "text-white/20" : "text-black/20")} />
                        <Input 
                            placeholder="Search active sessions, tables, or customers..." 
                            value={liveSearch}
                            onChange={e => setLiveSearch(e.target.value)}
                            className={cn(
                                "h-11 rounded-xl border-2 pl-10",
                                isKitchenMode ? "bg-white/5 border-white/10 text-white placeholder:text-white/20" : "bg-white border-black/5"
                            )}
                        />
                    </div>
                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {['all', 'new', 'processing', 'delivery', 'billed'].map(f => (
                            <button
                                key={f}
                                onClick={() => setLiveFilter(f)}
                                className={cn(
                                    "px-4 h-11 rounded-xl font-black text-[10px] uppercase tracking-widest border-2 transition-all shrink-0",
                                    liveFilter === f 
                                        ? "bg-primary border-primary text-white" 
                                        : (isKitchenMode ? "bg-white/5 border-white/10 text-white/40" : "bg-white border-black/5 text-black/40")
                                )}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 h-[calc(100vh-220px)] overflow-hidden">
                    <section className="flex flex-col h-full min-h-0">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 flex items-center gap-2 mb-4 shrink-0"><Truck className="h-3.5 w-3.5"/> Out-Call & Online</h2>
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-4">
                                {homeDeliveries.map(o => <DeliveryOrderCard key={o.id} order={o} onStatusChange={handleOrderUpdate} />)}
                                {homeDeliveries.length === 0 && (
                                    <div className={cn(
                                        "col-span-full text-center py-20 border-2 border-dashed rounded-3xl opacity-60",
                                        isKitchenMode ? "border-white/10 text-white" : "border-black/5 text-gray-400"
                                    )}>
                                        <ShoppingBag className="h-8 w-8 mx-auto mb-2"/>
                                        <p className={cn("text-[9px] font-black uppercase tracking-widest", isKitchenMode ? "text-white" : "text-black")}>No active jobs</p>
                                    </div>
                                )}
                            </div>
                            <ScrollBar orientation="vertical" />
                        </ScrollArea>
                    </section>

                    <section className="flex flex-col h-full min-h-0">
                        <div className="flex justify-between items-center mb-4 shrink-0">
                            <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-green-600 flex items-center gap-2">{isSalon ? <Scissors className="h-3.5 w-3.5"/> : <Utensils className="h-3.5 w-3.5"/>} {isSalon ? 'Chair & Counter' : 'Table & Counter'}</h2>
                        </div>
                        <ScrollArea className="flex-1">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pr-4 pb-10">
                                {Object.values(sessions).map(s => (
                                    <SessionCard 
                                        key={s.id} 
                                        session={s} 
                                        onDismissService={handleDismissService} 
                                        store={myStore} 
                                        isSalon={isSalon} 
                                    />
                                ))}
                                {Object.values(sessions).length === 0 && (
                                    <div className={cn(
                                        "col-span-full text-center py-20 border-2 border-dashed rounded-3xl opacity-60",
                                        isKitchenMode ? "border-white/10 text-white" : "border-black/5 text-gray-400"
                                    )}>
                                        <Monitor className="h-8 w-8 mx-auto mb-2"/>
                                        <p className={cn("text-[9px] font-black uppercase tracking-widest", isKitchenMode ? "text-white" : "text-black")}>No active sessions</p>
                                    </div>
                                )}
                            </div>
                            <ScrollBar orientation="vertical" />
                        </ScrollArea>
                    </section>
                </div>
            </TabsContent>
            
            <TabsContent value="history" className="mt-0">
                <HistoryAndInsightsCenter storeId={myStore.id} />
            </TabsContent>
        </Tabs>
    </div>
  );
}

function toDateSafe(d: any): Date {
    if (!d) return new Date();
    if (d instanceof Timestamp) return d.toDate();
    return new Date(d);
}
