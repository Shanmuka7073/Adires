
'use client';

import { Order, Store, MenuItem, Menu } from '@/lib/types';
import {
  Badge
} from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import {
  ShoppingBag,
  Plus,
  User as UserIcon,
  Search,
  Loader2,
  ChevronRight,
  Utensils,
  Clock,
  AlertTriangle,
  CookingPot,
  Receipt,
  Truck,
  CheckCircle,
  Circle
} from 'lucide-react';
import {
  collection, query, where, orderBy, doc, updateDoc, serverTimestamp, Timestamp, limit, getDocs, setDoc, writeBatch
} from 'firebase/firestore';
import { useFirebase, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useMemo, useState, useTransition, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { playTickSound } from '@/lib/cart';
import Link from 'next/link';
import { format } from 'date-fns';
import Image from 'next/image';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-red-500',
  Processing: 'bg-amber-500',
  Billed: 'bg-green-500',
  'Out for Delivery': 'bg-purple-500',
};

interface Session {
  id: string;
  tableNumber: string | null;
  orders: Order[];
  totalAmount: number;
  status: Order['status'];
  orderType: Order['orderType'];
  lastActivity: Date;
}

function SessionRow({ session, isSalon, onStatusChange }: { session: Session; isSalon: boolean; onStatusChange: (id: string, s: any) => void }) {
  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    const nextStatus = session.status === 'Pending' ? 'Processing' : session.status === 'Processing' ? 'Billed' : 'Completed';
    session.orders.forEach(o => onStatusChange(o.id, nextStatus));
  };

  return (
    <div className="flex items-center justify-between p-3 border-b border-black/5 bg-white active:bg-black/5 transition-colors group">
        <div className="flex items-center gap-3 min-w-0">
            <div className={cn("h-2 w-2 rounded-full shrink-0", STATUS_COLORS[session.status] || 'bg-gray-300')} />
            <div className="min-w-0">
                <p className="text-[11px] font-black uppercase tracking-tight text-gray-950 truncate">
                    {isSalon ? 'CH' : 'T'}-{session.tableNumber || 'WALK'} • #{session.id.slice(-4)}
                </p>
                <p className="text-[9px] font-bold opacity-40 uppercase truncate">
                    {session.orders.flatMap(o => o.items).map(i => i.productName).join(', ')}
                </p>
            </div>
        </div>
        <div className="flex items-center gap-4 shrink-0">
            <p className="font-black text-xs text-primary">₹{session.totalAmount.toFixed(0)}</p>
            <button onClick={handleAction} className="h-7 w-7 rounded-lg bg-black/5 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-all">
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    </div>
  )
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
        <DialogContent className="max-w-lg rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl">
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

export default function StoreOrdersPage() {
  const { firestore, user } = useFirebase();
  const [activeTab, setActiveTab] = useState('live');
  const [liveSearch, setLiveSearch] = useState('');
  const [liveFilter, setLiveFilter] = useState('all');
  const [isNewSaleOpen, setIsNewSaleOpen] = useState(false);
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

  const { sessions, counts } = useMemo(() => {
    let active = 0, newCount = 0, procCount = 0;
    if (!activeOrders) return { sessions: [], counts: { active, newCount, procCount } };

    const searchLower = liveSearch.toLowerCase();
    const tableSessions: Record<string, Session> = {};

    activeOrders.forEach(o => {
        if (liveSearch && !(o.customerName.toLowerCase().includes(searchLower) || o.tableNumber?.toLowerCase().includes(searchLower))) return;
        if (liveFilter !== 'all' && o.status.toLowerCase() !== liveFilter) return;

        if (!tableSessions[o.sessionId!]) {
            tableSessions[o.sessionId!] = { id: o.sessionId!, tableNumber: o.tableNumber || null, orders: [], totalAmount: 0, status: o.status, orderType: o.orderType, lastActivity: toDateSafe(o.orderDate) };
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
  }

  if (ordersLoading && !activeOrders) return <div className="p-12 text-center h-screen flex flex-col items-center justify-center opacity-20"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
        <Dialog open={isNewSaleOpen} onOpenChange={setIsNewSaleOpen}>
            <QuickCounterSaleDialog storeId={myStore?.id || ''} menuItems={menuItems} onComplete={() => setIsNewSaleOpen(false)} />
        </Dialog>

        <main className="container mx-auto px-3 pt-4">
            {/* 1. HEADER */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <div className="relative h-8 w-8 rounded-full overflow-hidden border-2 bg-white shrink-0"><Image src={myStore?.imageUrl || ADIRES_LOGO} alt="S" fill className="object-cover" /></div>
                    <div>
                        <h1 className="text-[11px] font-black uppercase leading-none truncate max-w-[120px]">{myStore?.name || 'OPERATIONS'}</h1>
                        <div className="flex items-center gap-1 mt-0.5"><div className="h-1 w-1 rounded-full bg-green-500 animate-pulse"/><span className="text-[7px] font-black uppercase text-green-600 tracking-widest">Live Hub</span></div>
                    </div>
                </div>
                <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-black/5"><Link href="/dashboard/customer/my-profile"><UserIcon className="h-4 w-4" /></Link></Button>
            </div>

            {/* 2. TABS */}
            <div className="flex bg-black/5 p-1 rounded-xl mb-4 border border-black/5">
                <button onClick={() => setActiveTab('live')} className={cn("flex-1 h-8 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all", activeTab === 'live' ? "bg-white shadow-sm text-primary" : "text-gray-400")}>Live</button>
                <button onClick={() => setActiveTab('history')} className={cn("flex-1 h-8 rounded-lg font-black text-[10px] uppercase tracking-widest transition-all", activeTab === 'history' ? "bg-white shadow-sm text-primary" : "text-gray-400")}>Insights</button>
            </div>

            {/* 3. STATUS SUMMARY */}
            <div className="flex gap-2 text-[10px] mb-4">
                <div className="px-2.5 py-1 bg-green-50 text-green-600 rounded-lg font-black uppercase tracking-tighter border border-green-100 flex items-center gap-1">✔ {counts.active} ACTIVE</div>
                <div className="px-2.5 py-1 bg-red-50 text-red-500 rounded-lg font-black uppercase tracking-tighter border border-red-100 flex items-center gap-1">● {counts.newCount} NEW</div>
                <div className="px-2.5 py-1 bg-yellow-50 text-yellow-600 rounded-lg font-black uppercase tracking-tighter border border-yellow-100 flex items-center gap-1">⏱ {counts.procCount} PROC.</div>
            </div>

            {/* 4. SEARCH */}
            <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 opacity-20" />
                <Input placeholder="Search..." value={liveSearch} onChange={e => setLiveSearch(e.target.value)} className="h-9 rounded-xl border-2 bg-white pl-9 text-[11px] font-bold" />
            </div>

            {/* 5. FILTER CHIPS */}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-4">
                {['all', 'pending', 'processing', 'billed'].map(f => (
                    <button key={f} onClick={() => setLiveFilter(f)} className={cn("px-3 h-7 rounded-lg font-black text-[9px] uppercase tracking-widest border-2 transition-all shrink-0", liveFilter === f ? "bg-primary border-primary text-white" : "bg-white border-black/5 text-gray-400")}>{f}</button>
                ))}
            </div>

            {/* 6. ORDER LIST */}
            <div className="space-y-0.5 rounded-[1.5rem] overflow-hidden border-2 border-black/5 shadow-xl">
                {sessions.length > 0 ? (
                    sessions.map(s => <SessionRow key={s.id} session={s} isSalon={true} onStatusChange={handleOrderUpdate} />)
                ) : (
                    <div className="bg-white p-8 text-center flex flex-col items-center gap-3 opacity-20">
                        <ShoppingBag className="h-8 w-8" />
                        <p className="text-[10px] font-black uppercase tracking-widest">All Clear</p>
                    </div>
                )}
            </div>
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
    return new Date(d);
}
