
'use client';

import { Order, Store, MenuItem, Menu } from '@/lib/types';
import {
  Badge
} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Search,
  Plus,
  ChevronRight,
  Loader2,
  MapPin,
  Phone,
  Navigation,
  ShoppingBag,
  History,
  Check,
  X,
  TrendingUp,
} from 'lucide-react';
import {
  collection, query, where, orderBy, doc, updateDoc, serverTimestamp, limit, setDoc, Timestamp
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { useMemo, useState, useTransition, useEffect } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogDescription } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card } from '@/components/ui/card';
import { format } from 'date-fns';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { playTickSound } from '@/lib/cart';
import { getStoreSalesReport } from '@/app/actions';
import Link from 'next/link';

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-red-500',
  Processing: 'bg-amber-500',
  Billed: 'bg-green-500',
  'Out for Delivery': 'bg-purple-500',
};

interface Session {
  id: string;
  tableNumber: string | null;
  customerName: string;
  phone: string;
  address: string;
  lat?: number;
  lng?: number;
  orders: Order[];
  totalAmount: number;
  status: Order['status'];
  orderType: Order['orderType'];
  lastActivity: Date;
}

function SessionRow({ session, isSalon, onClick }: { session: Session; isSalon: boolean; onClick: () => void }) {
  const isDelivery = session.orderType === 'delivery';

  return (
    <div onClick={onClick} className="flex items-center justify-between p-3 border-b border-black/5 bg-white active:bg-black/5 transition-colors group cursor-pointer">
        <div className="flex items-center gap-3 min-w-0">
            <div className={cn("h-2 w-2 rounded-full shrink-0", STATUS_COLORS[session.status] || 'bg-gray-300')} />
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <p className="text-[11px] font-black uppercase tracking-tight text-gray-950 truncate">
                        {session.tableNumber && session.tableNumber !== 'Counter' ? `${isSalon ? 'CH' : 'T'}-${session.tableNumber}` : (isDelivery ? 'HOME' : 'WALK')} • #{session.id.slice(-4)}
                    </p>
                    {isDelivery && <Badge className="bg-blue-500 text-white text-[7px] h-3.5 font-black uppercase px-1 border-0">Home</Badge>}
                </div>
                <p className="text-[9px] font-bold opacity-40 uppercase truncate">
                    {session.customerName} • {session.orders.flatMap(o => o.items).length} items
                </p>
            </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
            <p className="font-black text-xs text-primary">₹{session.totalAmount.toFixed(0)}</p>
            <div className="h-7 w-7 rounded-lg bg-black/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                <ChevronRight className="h-4 w-4" />
            </div>
        </div>
    </div>
  )
}

function SessionDetailsDialog({ session, isOpen, onOpenChange, onStatusUpdate }: { session: Session | null, isOpen: boolean, onOpenChange: (open: boolean) => void, onStatusUpdate: (orderId: string, status: any) => void }) {
    if (!session) return null;

    const items = session.orders.flatMap(o => o.items);
    const isDelivery = session.orderType === 'delivery';

    const handleUpdateStatus = (status: string) => {
        session.orders.forEach(o => onStatusUpdate(o.id, status));
        onOpenChange(false);
    };

    const handleNavigate = () => {
        const url = (session.lat && session.lat !== 0) 
            ? `https://www.google.com/maps/dir/?api=1&destination=${session.lat},${session.lng}`
            : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(session.address)}`;
        window.open(url, '_blank');
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl h-[85vh] flex flex-col">
                <div className="p-5 bg-primary/5 border-b border-black/5 flex justify-between items-center">
                    <div>
                        <DialogTitle className="text-sm font-black uppercase tracking-tight">Order #{session.id.slice(-6)}</DialogTitle>
                        <p className="text-[10px] font-bold opacity-40 uppercase">{session.orderType} • {format(session.lastActivity, 'p')}</p>
                    </div>
                    <Badge className={cn("rounded-md font-black uppercase text-[9px]", STATUS_COLORS[session.status])}>{session.status}</Badge>
                </div>

                <ScrollArea className="flex-1 p-5">
                    <div className="space-y-8 pb-10">
                        <section className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Customer Details</h4>
                            <Card className="rounded-2xl border-2 p-4 bg-muted/30 shadow-none">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <p className="font-black text-xs uppercase text-gray-950">{session.customerName}</p>
                                        <p className="text-[10px] font-bold opacity-60 mt-1">{session.phone || 'No phone'}</p>
                                    </div>
                                    {session.phone && (
                                        <Button size="icon" variant="outline" className="rounded-xl h-10 w-10 border-2" asChild>
                                            <a href={`tel:${session.phone}`}><Phone className="h-4 w-4" /></a>
                                        </Button>
                                    )}
                                </div>
                                {isDelivery && (
                                    <div className="mt-4 pt-4 border-t border-black/5 space-y-3">
                                        <div className="flex gap-2">
                                            <MapPin className="h-4 w-4 text-primary shrink-0" />
                                            <p className="text-[10px] font-bold text-gray-600 leading-tight">{session.address}</p>
                                        </div>
                                        <Button onClick={handleNavigate} className="w-full h-10 rounded-xl font-black text-[9px] uppercase tracking-widest gap-2 bg-blue-600 hover:bg-blue-700">
                                            <Navigation className="h-3.5 w-3.5" /> Navigate to Address
                                        </Button>
                                    </div>
                                )}
                            </Card>
                        </section>

                        <section className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Item Manifest</h4>
                            <div className="space-y-2">
                                {items.map((it, idx) => (
                                    <div key={idx} className="flex justify-between items-center p-3 rounded-xl border-2 bg-white text-xs font-bold uppercase tracking-tight">
                                        <span>{it.productName} <span className="opacity-40">x{it.quantity}</span></span>
                                        <span className="text-primary font-black">₹{(it.price * it.quantity).toFixed(0)}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex justify-between items-baseline px-1 pt-2">
                                <span className="text-[9px] font-black uppercase opacity-40">Order Total</span>
                                <span className="text-xl font-black text-primary">₹{session.totalAmount.toFixed(0)}</span>
                            </div>
                        </section>
                    </div>
                </ScrollArea>

                <div className="p-5 border-t bg-gray-50 flex gap-2 shrink-0 pb-10">
                    {session.status === 'Pending' && (
                        <Button onClick={() => handleUpdateStatus('Processing')} className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">Accept Job</Button>
                    )}
                    {session.status === 'Processing' && (
                        <Button onClick={() => handleUpdateStatus('Billed')} className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">Mark Ready</Button>
                    )}
                    {session.status === 'Billed' && (
                        <Button onClick={() => handleUpdateStatus('Completed')} className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 bg-green-600 hover:bg-green-700">Complete Session</Button>
                    )}
                    <Button variant="ghost" onClick={() => handleUpdateStatus('Cancelled')} className="h-12 rounded-xl font-bold uppercase text-[9px] text-destructive">Cancel</Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}

function QuickCounterSaleDialog({ storeId, menuItems, onComplete }: { storeId: string, menuItems: MenuItem[], onComplete: () => void }) {
    const { firestore } = useFirebase();
    const [cart, setCart] = useState<{item: MenuItem, qty: number}[]>([]);
    const total = cart.reduce((acc, i) => acc + (i.item.price * i.qty), 0);

    const handleGenerateBill = () => {
        if (cart.length === 0 || !firestore) return;
        const orderId = `counter-${Date.now()}`;
        const orderRef = doc(firestore, 'orders', orderId);
        const orderData = {
            id: orderId, storeId, tableNumber: 'Counter', sessionId: orderId, userId: 'guest', customerName: 'Walk-in',
            status: 'Billed', orderType: 'counter', isActive: true, orderDate: serverTimestamp(),
            items: cart.map(c => ({ id: crypto.randomUUID(), orderId, productName: c.item.name, quantity: c.qty, price: c.item.price })),
            totalAmount: total,
        };
        setDoc(orderRef, orderData).catch(e => console.error(e));
        onComplete();
    };

    return (
        <DialogContent className="max-w-lg rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl">
            <div className="p-4 bg-primary/5 border-b border-black/5"><DialogTitle className="text-sm font-black uppercase">Quick Bill</DialogTitle></div>
            <div className="p-4 max-h-[60vh] overflow-y-auto space-y-2">
                {menuItems.map(it => (
                    <button key={it.id} onClick={() => { playTickSound(); setCart(p => [...p, { item: it, qty: 1 }]) }} className="w-full p-3 border-2 border-black/5 rounded-xl flex justify-between items-center text-xs font-bold uppercase tracking-tight">
                        <span>{it.name}</span>
                        <span className="text-primary">₹{it.price}</span>
                    </button>
                ))}
            </div>
            <div className="p-4 border-t bg-white space-y-3">
                <div className="flex justify-between font-black text-sm"><span>TOTAL</span><span>₹{total}</span></div>
                <Button onClick={handleGenerateBill} className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest">Generate Bill</Button>
            </div>
        </DialogContent>
    )
}

function InsightsTab({ storeId }: { storeId: string }) {
    const [report, setReport] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!storeId) return;
        const fetchReport = async () => {
            const res = await getStoreSalesReport({ storeId, period: 'daily' });
            if (res.success) setReport(res.report);
            setIsLoading(false);
        };
        fetchReport();
    }, [storeId]);

    if (isLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    const totalSales = report?.totalSales || 0;
    const totalOrders = report?.totalOrders || 0;

    return (
        <div className="p-4 space-y-6 animate-in fade-in duration-500">
            <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-3xl bg-primary/5 border-2 border-primary/10">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Today Revenue</p>
                    <p className="text-2xl font-black tracking-tighter text-primary">₹{totalSales.toFixed(0)}</p>
                </div>
                <div className="p-4 rounded-3xl bg-blue-50 border-2 border-blue-100">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Total Orders</p>
                    <p className="text-2xl font-black tracking-tighter text-blue-600">{totalOrders}</p>
                </div>
            </div>

            <section className="space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 flex items-center gap-2">
                    <TrendingUp className="h-3 w-3" /> Top Performers
                </h4>
                <div className="space-y-2">
                    {report?.topProducts?.length > 0 ? report.topProducts.map((p: any) => (
                        <div key={p.name} className="p-3 bg-white rounded-2xl border-2 border-black/5 flex justify-between items-center">
                            <span className="text-xs font-black uppercase truncate leading-none">{p.name}</span>
                            <Badge variant="secondary" className="text-[8px] font-black uppercase">{p.count} sold</Badge>
                        </div>
                    )) : (
                        <p className="text-center py-8 text-[10px] font-black uppercase opacity-20">No sales data yet</p>
                    )}
                </div>
            </section>
            
            <Button asChild variant="outline" className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-2">
                <Link href="/dashboard/owner/sales-report">View Full Analytics</Link>
            </Button>
        </div>
    )
}

export default function StoreOrdersPage() {
  const { firestore, user } = useFirebase();
  const [activeTab, setActiveTab] = useState('live');
  const [liveSearch, setLiveSearch] = useState('');
  const [liveFilter, setLiveFilter] = useState('all');
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const { stores, userStore } = useAppStore();

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

  const { sessions, counts } = useMemo(() => {
    let active = 0, newCount = 0, procCount = 0;
    if (!activeOrders) return { sessions: [], counts: { active, newCount, procCount } };

    const searchLower = liveSearch.toLowerCase();
    const tableSessions: Record<string, Session> = {};

    activeOrders.forEach(o => {
        const customerMatch = o.customerName?.toLowerCase().includes(searchLower);
        const tableMatch = o.tableNumber?.toLowerCase().includes(searchLower);
        if (liveSearch && !(customerMatch || tableMatch)) return;
        if (liveFilter !== 'all' && o.status.toLowerCase() !== liveFilter) return;

        if (!tableSessions[o.sessionId!]) {
            tableSessions[o.sessionId!] = { 
                id: o.sessionId!, 
                tableNumber: o.tableNumber || null, 
                customerName: o.customerName || 'Guest',
                phone: o.phone || '',
                address: o.deliveryAddress || '',
                lat: o.deliveryLat,
                lng: o.deliveryLng,
                orders: [], 
                totalAmount: 0, 
                status: o.status, 
                orderType: o.orderType, 
                lastActivity: toDateSafe(o.orderDate) 
            };
        }
        tableSessions[o.sessionId!].orders.push(o);
        tableSessions[o.sessionId!].totalAmount += o.totalAmount;
        if (o.status === 'Pending') newCount++; else if (o.status === 'Processing') procCount++;
        active++;
    });

    return { sessions: Object.values(tableSessions), counts: { active, newCount, procCount } };
  }, [activeOrders, liveSearch, liveFilter]);

  const handleOrderUpdate = (orderId: string, status: any) => {
      if (!firestore) return;
      updateDoc(doc(firestore, 'orders', orderId), { status, isActive: !['Delivered', 'Completed', 'Cancelled'].includes(status), updatedAt: serverTimestamp() });
  };

  if (ordersLoading && !activeOrders) return <div className="p-12 text-center h-screen flex flex-col items-center justify-center opacity-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
        <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
            <QuickCounterSaleDialog storeId={myStore?.id || ''} menuItems={menuItems} onComplete={() => setIsNewSaleOpen(false)} />
        </Dialog>

        <SessionDetailsDialog 
            session={selectedSession} 
            isOpen={!!selectedSession} 
            onOpenChange={(open) => !open && setSelectedSession(null)} 
            onStatusUpdate={handleOrderUpdate}
        />

        <main className="container mx-auto px-3 pt-4 animate-in fade-in duration-500">
            <div className="flex bg-black/5 p-1 rounded-xl mb-4 border border-black/5">
                <button onClick={() => setActiveTab('live')} className={cn("flex-1 h-8 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all", activeTab === 'live' ? "bg-white shadow-sm text-primary" : "text-gray-400")}>Live Orders</button>
                <button onClick={() => setActiveTab('history')} className={cn("flex-1 h-8 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all", activeTab === 'history' ? "bg-white shadow-sm text-primary" : "text-gray-400")}>Insights</button>
            </div>

            {activeTab === 'live' ? (
                <>
                    <div className="space-y-3 mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-950 font-bold" />
                            <Input 
                                placeholder="Search table or name..." 
                                value={liveSearch} 
                                onChange={e => setLiveSearch(e.target.value)} 
                                className="h-11 rounded-2xl border-2 border-gray-950 bg-white pl-10 text-xs font-black uppercase tracking-tight shadow-md" 
                            />
                        </div>

                        <div className="flex gap-2 text-[10px]">
                            <div className="px-2.5 py-1.5 bg-green-50 text-green-600 rounded-lg font-black uppercase tracking-tighter border border-green-100 flex items-center gap-1">✔ {counts.active} ACTIVE</div>
                            <div className="px-2.5 py-1.5 bg-red-50 text-red-500 rounded-lg font-black uppercase tracking-tighter border border-red-100 flex items-center gap-1">● {counts.newCount} NEW</div>
                            <div className="px-2.5 py-1.5 bg-yellow-50 text-yellow-600 rounded-lg font-black uppercase tracking-tighter border border-yellow-100 flex items-center gap-1">⏱ {counts.procCount} PROC.</div>
                        </div>
                    </div>

                    <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-4">
                        {['all', 'pending', 'processing', 'billed'].map(f => (
                            <button key={f} onClick={() => setLiveFilter(f)} className={cn("px-3 h-7 rounded-lg font-black text-[9px] uppercase tracking-widest border-2 transition-all shrink-0", liveFilter === f ? "bg-primary border-primary text-white shadow-md" : "bg-white border-black/5 text-gray-400")}>{f}</button>
                        ))}
                    </div>

                    <div className="space-y-0.5 rounded-[1.5rem] overflow-hidden border-2 border-black/5 shadow-xl bg-white">
                        {sessions.length > 0 ? (
                            sessions.map(s => <SessionRow key={s.id} session={s} isSalon={true} onClick={() => setSelectedSession(s)} />)
                        ) : (
                            <div className="bg-white p-12 text-center flex flex-col items-center gap-3 opacity-20">
                                <ShoppingBag className="h-8 w-8" />
                                <p className="text-[10px] font-black uppercase tracking-widest">No matching orders</p>
                            </div>
                        )}
                    </div>
                </>
            ) : (
                <InsightsTab storeId={myStore?.id || ''} />
            )}
        </main>

        <Button onClick={() => setIsNewSaleOpen(true)} className="fixed bottom-20 right-4 h-12 w-12 rounded-full shadow-2xl z-50 bg-primary text-white active:scale-90 transition-transform">
            <Plus className="h-6 w-6" />
        </Button>
    </div>
  );
}

function toDateSafe(d: any): Date {
    if (!d) return new Date();
    if (d instanceof Timestamp) return d.toDate();
    if (d instanceof Date) return d;
    if (typeof d === 'object' && d.seconds) return new Date(d.seconds * 1000);
    return new Date(d);
}
