
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
  PlusCircle,
  X,
  Search,
  History,
  TrendingUp,
  ArrowRight,
  Sparkles,
  Phone,
  RefreshCw,
  Plus,
  User as UserIcon,
  Circle,
  ChevronDown
} from 'lucide-react';
import {
  collection, query, where, orderBy, doc, updateDoc, serverTimestamp, Timestamp, limit, getDocs, setDoc, writeBatch
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useMemo, useState, useTransition, useEffect, useCallback, useRef } from 'react';
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogFooter, AlertDialogCancel, AlertDialogAction, AlertDialogDescription
} from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { playTickSound } from '@/lib/cart';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfDay, subDays } from 'date-fns';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Checkbox } from '@/components/ui/checkbox';
import Image from 'next/image';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

const STATUS_META: Record<string, any> = {
  Draft: { icon: Clock, variant: 'outline', color: 'text-gray-400', label: 'Draft' },
  Pending: { icon: AlertTriangle, variant: 'secondary', color: 'text-red-600', label: 'New', animate: true, headerColor: 'bg-red-500' },
  Processing: { icon: CookingPot, variant: 'secondary', color: 'text-amber-600', label: 'Processing', headerColor: 'bg-amber-500' },
  'Out for Delivery': { icon: Truck, variant: 'outline', color: 'text-purple-600', label: 'Delivery', headerColor: 'bg-purple-500' },
  Billed: { icon: Check, variant: 'default', color: 'text-green-600', label: 'Billed', headerColor: 'bg-green-500' },
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
  customerPhone?: string;
}

function StatusHeader({ label, colorClass, count }: { label: string, colorClass: string, count: number }) {
    if (count === 0) return null;
    return (
        <div className="flex items-center justify-between px-1 mb-3">
            <div className="flex items-center gap-2">
                <div className={cn("h-2 w-2 rounded-full", colorClass)} />
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-950">{label}</h3>
            </div>
            <div className="h-5 w-5 rounded-full bg-black/5 flex items-center justify-center text-[9px] font-black text-gray-400">{count}</div>
        </div>
    );
}

function POSHeader({ store }: { store: Store | null }) {
    return (
        <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
                <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-primary/10 bg-white">
                    <Image src={store?.imageUrl || ADIRES_LOGO} alt="Store" fill className="object-cover" />
                </div>
                <div>
                    <h1 className="text-sm font-black uppercase tracking-tight leading-none text-gray-950">
                        {store?.name || 'STORE HUB'}
                    </h1>
                    <div className="flex items-center gap-1.5 mt-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                        <span className="text-[8px] font-bold text-green-600 uppercase tracking-widest">Live</span>
                        <ChevronDown className="h-3 w-3 text-gray-400" />
                    </div>
                </div>
            </div>
            <Button variant="ghost" size="icon" className="rounded-full bg-black/5 h-10 w-10" asChild>
                <Link href="/dashboard/customer/my-profile">
                    <UserIcon className="h-5 w-5 text-gray-600" />
                </Link>
            </Button>
        </div>
    );
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

function SessionCard({ session, store, isSalon, onDismissService, onStatusChange }: { session: Session; store: Store; isSalon: boolean; onDismissService: (s: Session) => void, onStatusChange: (id: string, s: any) => void }) {
  const meta = STATUS_META[session.status] || STATUS_META.Pending;
  const isBilled = session.status === 'Billed';
  
  const handleAction = () => {
    const nextStatus = session.status === 'Pending' ? 'Processing' : session.status === 'Processing' ? 'Billed' : 'Completed';
    session.orders.forEach(o => onStatusChange(o.id, nextStatus));
  };

  return (
    <Card className="rounded-2xl border-0 shadow-md bg-white overflow-hidden mb-3">
        <div className="p-4 flex justify-between items-center bg-black/5 border-b border-black/5">
            <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                    {session.orderType === 'delivery' ? <Truck className="h-5 w-5 text-purple-500" /> : <Utensils className="h-5 w-5 text-gray-400" />}
                </div>
                <div>
                    <p className="text-xs font-black uppercase tracking-tight text-gray-950">{isSalon ? 'Chair' : 'Table'} {session.tableNumber || 'Walk-in'}</p>
                    <p className="text-[8px] font-bold opacity-40 uppercase tracking-widest">#{session.id.slice(-4)}</p>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <Badge variant="outline" className={cn("text-[8px] font-black uppercase border-primary/20", meta.animate && "animate-pulse")}>{meta.label}</Badge>
                {session.needsService && <button onClick={() => onDismissService(session)} className="h-6 w-6 rounded-full bg-red-500 text-white flex items-center justify-center animate-bounce shadow-lg"><BellRing className="h-3 w-3"/></button>}
            </div>
        </div>
        <div className="p-4 space-y-2">
            {session.orders.flatMap(o => o.items).map((it, i) => (
                <div key={i} className="flex justify-between items-center text-[10px] font-bold text-gray-600">
                    <span className="truncate pr-2">{it.productName} <span className="opacity-40 font-black">x{it.quantity}</span></span>
                    <span className="font-black text-gray-950 shrink-0">₹{(it.price * it.quantity).toFixed(0)}</span>
                </div>
            ))}
        </div>
        <div className="px-4 py-3 bg-black/5 flex items-center justify-between">
            <div className="flex flex-col leading-none">
                <span className="text-[8px] font-black uppercase opacity-40 tracking-widest mb-0.5">Bill Total</span>
                <span className="text-sm font-black text-primary">₹{session.totalAmount.toFixed(0)}</span>
            </div>
            <Button size="sm" className="h-8 rounded-lg text-[9px] font-black uppercase tracking-widest px-4 shadow-md" onClick={handleAction}>
                {isBilled ? 'Paid' : 'Next Step'}
            </Button>
        </div>
    </Card>
  )
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
        return { totalSales, aov, orderCount: completed.length };
    }, [history]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-20">
            <div className="grid grid-cols-2 gap-4">
                <Card className="rounded-2xl border-0 shadow-lg bg-white p-4 flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40 leading-none">Revenue ({days}D)</span>
                    <p className="text-2xl font-black tracking-tighter text-gray-950">₹{stats.totalSales.toFixed(0)}</p>
                </Card>
                <Card className="rounded-2xl border-0 shadow-lg bg-white p-4 flex flex-col gap-1">
                    <span className="text-[9px] font-black uppercase tracking-widest opacity-40 leading-none">Visits</span>
                    <p className="text-2xl font-black tracking-tighter text-gray-950">{stats.orderCount}</p>
                </Card>
            </div>

            <Card className="rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white">
                <CardHeader className="bg-primary/5 border-b border-black/5 py-4">
                    <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                        <History className="h-4 w-4 text-primary" /> Past Transactions
                    </CardTitle>
                </CardHeader>
                <div className="p-0">
                    <ScrollArea className="h-[400px]">
                        {isLoading ? (
                            <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 opacity-20" /></div>
                        ) : history.length > 0 ? (
                            <Table>
                                <TableBody>
                                    {history.map(o => (
                                        <TableRow key={o.id} className="border-b border-black/5">
                                            <TableCell className="py-4">
                                                <p className="font-black text-[11px] uppercase truncate max-w-[120px]">{o.customerName || 'Walk-in'}</p>
                                                <p className="text-[8px] opacity-40 font-bold uppercase">{format(toDateSafe(o.orderDate), 'dd MMM, p')}</p>
                                            </TableCell>
                                            <TableCell className="font-black text-xs text-primary">₹{o.totalAmount.toFixed(0)}</TableCell>
                                            <TableCell className="text-right pr-4">
                                                <Badge variant="outline" className="text-[7px] font-black uppercase h-4 px-1.5 border-black/10">
                                                    {o.status}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        ) : <div className="p-20 text-center opacity-20"><Package className="h-12 w-12 mx-auto mb-2"/><p className="text-[10px] font-black uppercase tracking-widest">No History</p></div>}
                    </ScrollArea>
                </div>
            </Card>
        </div>
    );
}

export default function StoreOrdersPage() {
  const { firestore, user } = useFirebase();
  const [activeTab, setActiveTab] = useState('live');
  const [liveSearch, setLiveSearch] = useState('');
  const [liveFilter, setLiveFilter] = useState('all');
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const { toast } = useToast();
  const { stores, userStore, fetchInitialData } = useAppStore();

  const myStore = useMemo(() => userStore || stores.find(s => s.ownerId === user?.uid) || null, [userStore, stores, user?.uid]);

  const activeOrdersQuery = useMemoFirebase(() =>
    firestore && myStore ? query(collection(firestore, 'orders'), where('storeId', '==', myStore.id), where('isActive', '==', true), orderBy('orderDate', 'desc'), limit(100)) : null,
  [firestore, myStore]);

  const menuQuery = useMemoFirebase(() => 
    firestore && myStore ? query(collection(firestore, `stores/${myStore.id}/menus`), limit(1)) : null,
  [firestore, myStore]);

  const { data: activeOrders, isLoading: ordersLoading } = useCollection<Order>(activeOrdersQuery);
  const { data: menus } = useCollection<Menu>(menuQuery);
  const menuItems = useMemo(() => menus?.[0]?.items || [], [menus]);

  const { sessionsByStatus, counts } = useMemo(() => {
    const grouped: Record<string, Session[]> = { Pending: [], Processing: [], Billed: [] };
    let active = 0, newCount = 0, procCount = 0;
    
    if (!activeOrders) return { sessionsByStatus: grouped, counts: { active, newCount, procCount } };

    const searchLower = liveSearch.toLowerCase();
    const tableSessions: Record<string, Session> = {};

    activeOrders.forEach(o => {
        const matchesSearch = 
            o.customerName.toLowerCase().includes(searchLower) || 
            o.tableNumber?.toLowerCase().includes(searchLower);
        
        if (liveSearch && !matchesSearch) return;
        if (liveFilter !== 'all' && o.status.toLowerCase() !== liveFilter) return;

        if (o.sessionId) {
            if (!tableSessions[o.sessionId]) {
                tableSessions[o.sessionId] = { 
                    id: o.sessionId, tableNumber: o.tableNumber || null, orders: [], totalAmount: 0, status: o.status, orderType: o.orderType, lastActivity: toDateSafe(o.orderDate), needsService: o.needsService, serviceType: o.serviceType, customerPhone: o.phone
                };
            }
            tableSessions[o.sessionId].orders.push(o);
            tableSessions[o.sessionId].totalAmount += o.totalAmount;
            const statusWeights: Record<string, number> = { 'Pending': 1, 'Processing': 2, 'Billed': 3 };
            if (statusWeights[o.status] > (statusWeights[tableSessions[o.sessionId].status] || 0)) tableSessions[o.sessionId].status = o.status;
        }
    });

    Object.values(tableSessions).forEach(s => {
        active++;
        if (s.status === 'Pending') { newCount++; grouped.Pending.push(s); }
        else if (s.status === 'Processing') { procCount++; grouped.Processing.push(s); }
        else if (s.status === 'Billed') grouped.Billed.push(s);
    });

    return { sessionsByStatus: grouped, counts: { active, newCount, procCount } };
  }, [activeOrders, liveSearch, liveFilter]);

  const handleOrderUpdate = (orderId: string, status: any) => {
      if (!firestore) return;
      const orderRef = doc(firestore, 'orders', orderId);
      const isActive = !['Delivered', 'Completed', 'Cancelled'].includes(status);
      updateDoc(orderRef, { status, isActive, updatedAt: serverTimestamp() });
  }

  const handleDismissService = (session: Session) => {
      if (!firestore) return;
      const batch = writeBatch(firestore);
      session.orders.forEach(o => { if (o.needsService) batch.update(doc(firestore, 'orders', o.id), { needsService: false, serviceType: null, updatedAt: serverTimestamp() }); });
      batch.commit().then(() => toast({ title: "Resolved" }));
  };

  if (ordersLoading && !activeOrders) return <div className="p-12 text-center h-screen flex flex-col items-center justify-center opacity-20"><Loader2 className="animate-spin h-10 w-10 text-primary mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">Opening Hub...</p></div>;

  return (
    <div className="min-h-screen bg-[#F8F9FA] pb-24">
        <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
            <QuickCounterSaleDialog storeId={myStore?.id || ''} menuItems={menuItems} onComplete={() => setIsNewSaleOpen(false)} isSalon={true} />
        </Dialog>

        <main className="container mx-auto px-4 pt-6">
            <POSHeader store={myStore} />

            <div className="flex justify-center mb-8">
                <div className="inline-flex bg-white p-1 rounded-2xl shadow-sm border border-black/5">
                    <button onClick={() => setActiveTab('live')} className={cn("px-8 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all", activeTab === 'live' ? "bg-primary text-white shadow-lg" : "text-gray-400 hover:text-gray-600")}>Live</button>
                    <button onClick={() => setActiveTab('history')} className={cn("px-8 h-10 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all", activeTab === 'history' ? "bg-primary text-white shadow-lg" : "text-gray-400 hover:text-gray-600")}>Insights</button>
                </div>
            </div>

            {activeTab === 'live' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {/* Status Pills */}
                    <div className="flex gap-2">
                        <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm border border-green-100 flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center text-white"><Check className="h-3 w-3" /></div>
                            <span className="text-[10px] font-black uppercase text-green-700 tracking-tight">{counts.active} Active</span>
                        </div>
                        <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm border border-red-100 flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-red-500 flex items-center justify-center text-white"><Circle className="h-1 w-1 fill-current" /></div>
                            <span className="text-[10px] font-black uppercase text-red-700 tracking-tight">{counts.newCount} New</span>
                        </div>
                        <div className="flex-1 bg-white p-3 rounded-2xl shadow-sm border border-amber-100 flex items-center gap-2">
                            <div className="h-5 w-5 rounded-full bg-amber-500 flex items-center justify-center text-white"><Clock className="h-3 w-3" /></div>
                            <span className="text-[10px] font-black uppercase text-amber-700 tracking-tight">{counts.procCount} Proc.</span>
                        </div>
                    </div>

                    {/* Search & Filter */}
                    <div className="space-y-4">
                        <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                            <Input placeholder="Search sessions, tables, or customers..." value={liveSearch} onChange={e => setLiveSearch(e.target.value)} className="h-12 rounded-2xl border-0 shadow-sm bg-white pl-11 text-xs font-bold" />
                        </div>
                        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                            {['all', 'pending', 'processing', 'delivery'].map(f => (
                                <button key={f} onClick={() => setLiveFilter(f)} className={cn("px-6 h-9 rounded-full font-black text-[9px] uppercase tracking-widest border-2 transition-all shrink-0", liveFilter === f ? "bg-primary border-primary text-white shadow-md" : "bg-white border-black/5 text-gray-400")}>{f}</button>
                            ))}
                        </div>
                    </div>

                    {/* Order Sections */}
                    {counts.active > 0 ? (
                        <div className="space-y-8">
                            <section>
                                <StatusHeader label="NEW" colorClass="bg-red-500" count={sessionsByStatus.Pending.length} />
                                {sessionsByStatus.Pending.map(s => <SessionCard key={s.id} session={s} store={myStore!} isSalon={true} onDismissService={handleDismissService} onStatusChange={handleOrderUpdate} />)}
                            </section>
                            <section>
                                <StatusHeader label="PROCESSING" colorClass="bg-amber-500" count={sessionsByStatus.Processing.length} />
                                {sessionsByStatus.Processing.map(s => <SessionCard key={s.id} session={s} store={myStore!} isSalon={true} onDismissService={handleDismissService} onStatusChange={handleOrderUpdate} />)}
                            </section>
                            <section>
                                <StatusHeader label="BILLED" colorClass="bg-green-500" count={sessionsByStatus.Billed.length} />
                                {sessionsByStatus.Billed.map(s => <SessionCard key={s.id} session={s} store={myStore!} isSalon={true} onDismissService={handleDismissService} onStatusChange={handleOrderUpdate} />)}
                            </section>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                            <div className="h-24 w-24 rounded-full bg-white shadow-xl flex items-center justify-center mb-6"><ShoppingBag className="h-10 w-10 text-primary opacity-20" /></div>
                            <h2 className="text-lg font-black text-gray-900 uppercase tracking-tight">You're all set! No active orders</h2>
                            <p className="text-xs font-bold text-gray-500 mt-1 uppercase tracking-widest">Create a new sale to get started.</p>
                            <Button onClick={() => setIsNewSaleOpen(true)} className="mt-8 rounded-full h-12 px-8 font-black uppercase text-[10px] tracking-[0.2em] shadow-xl"><Plus className="h-4 w-4 mr-2" /> Create Order</Button>
                        </div>
                    )}
                </div>
            ) : (
                myStore && <HistoryAndInsightsCenter storeId={myStore.id} />
            )}
        </main>

        <Button onClick={() => setIsNewSaleOpen(true)} className="fixed bottom-24 right-6 h-14 w-14 rounded-full shadow-2xl z-50 bg-primary text-white border-4 border-white/20 active:scale-95 transition-all">
            <Plus className="h-8 w-8" />
        </Button>
    </div>
  );
}

function toDateSafe(d: any): Date {
    if (!d) return new Date();
    if (d instanceof Timestamp) return d.toDate();
    return new Date(d);
}
