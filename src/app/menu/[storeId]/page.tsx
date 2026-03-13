'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';

import type {
  Store,
  Menu,
  MenuItem,
  Order,
  OrderItem,
  MenuTheme,
  GetIngredientsOutput,
} from '@/lib/types';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import {
  Utensils,
  Plus,
  Receipt,
  Loader2,
  Check,
  Clock,
  Search,
  X,
  Download,
  Eye,
  Home,
  MapPin,
  Save,
  Video,
  Truck,
  CheckCircle,
  PlusCircle,
  LocateFixed,
  Trash2,
  Smartphone,
  Zap,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { addRestaurantOrderItem, getIngredientsForDish, confirmOrderSession } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import IngredientsDialog from '@/components/IngredientsDialog';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

const ADIRES_LOGO = "https://i.ibb.co/NdxC1XFF/file-000000007de872069c754b2d3cd565ec.png";

/**
 * Detailed Quick Access / Install Dialog
 * Shows the user how the app will look on their home screen.
 */
function QuickAccessDialog({ store, isOpen, onOpenChange, onInstall }: { store: Store; isOpen: boolean; onOpenChange: (open: boolean) => void; onInstall: () => void }) {
    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl">
                <div className="bg-gradient-to-br from-primary/20 to-primary/5 p-8 text-center relative">
                    <button onClick={() => onOpenChange(false)} className="absolute top-4 right-4 p-2 rounded-full hover:bg-black/5"><X className="h-5 w-5 opacity-40" /></button>
                    
                    {/* Phone Mockup Preview */}
                    <div className="mx-auto w-48 h-80 bg-slate-900 rounded-[2.5rem] border-4 border-slate-800 shadow-2xl relative overflow-hidden mb-6 p-2">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-b-xl z-10"></div>
                        <div className="grid grid-cols-4 gap-3 p-4 pt-8">
                            {/* App Icon Mockup */}
                            <div className="col-span-1 space-y-1 flex flex-col items-center">
                                <div className="w-8 h-8 rounded-xl bg-white shadow-lg relative overflow-hidden border border-white/20 animate-in zoom-in-50 duration-700 delay-300">
                                    <Image src={store.imageUrl || ADIRES_LOGO} alt="App Icon" fill className="object-cover" />
                                </div>
                                <span className="text-[5px] font-bold text-white/60 truncate w-full text-center">{store.name}</span>
                            </div>
                            {/* Filler icons */}
                            {[1,2,3,4,5,6,7].map(i => (
                                <div key={i} className="w-8 h-8 rounded-xl bg-white/10"></div>
                            ))}
                        </div>
                        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-white/20"></div>
                        </div>
                    </div>

                    <h2 className="text-2xl font-black tracking-tight mb-2">Add to Home Screen</h2>
                    <p className="text-sm font-medium opacity-60 px-4">Get one-tap access to {store.name} just like a native app.</p>
                </div>

                <div className="p-8 space-y-6">
                    <div className="grid gap-4">
                        <div className="flex items-start gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl"><Zap className="h-5 w-5 text-primary" /></div>
                            <div>
                                <h4 className="font-black text-xs uppercase tracking-widest mb-1">Instant Launch</h4>
                                <p className="text-xs opacity-60">Open the menu directly without typing a URL in the browser.</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-4">
                            <div className="bg-primary/10 p-3 rounded-2xl"><Smartphone className="h-5 w-5 text-primary" /></div>
                            <div>
                                <h4 className="font-black text-xs uppercase tracking-widest mb-1">Full Screen Mode</h4>
                                <p className="text-xs opacity-60">Experience the menu in beautiful full-screen without browser bars.</p>
                            </div>
                        </div>
                    </div>

                    <Button onClick={onInstall} className="w-full h-14 rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-xl shadow-primary/20">
                        Install App Now
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

/**
 * Visual tracker showing the progress of a confirmed HOME DELIVERY order.
 */
function LiveOrderTracker({ order, theme }: { order: Order; theme: MenuTheme | undefined }) {
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const statuses = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Completed'];
    
    const statusLabels: Record<string, string> = {
        'Pending': 'Order Received',
        'Processing': 'Preparing Food',
        'Out for Delivery': 'On the Way',
        'Delivered': 'Delivered',
        'Completed': 'Delivered'
    };

    useEffect(() => {
        if (order.status !== 'Out for Delivery') {
            setTimeLeft(null);
            return;
        }

        const tick = () => {
            const now = new Date().getTime();
            let updateTimeMs = now;
            const up = order.updatedAt;

            if (up) {
                if (typeof up.toDate === 'function') updateTimeMs = up.toDate().getTime();
                else if (up.seconds) updateTimeMs = up.seconds * 1000;
                else {
                    const parsed = new Date(up).getTime();
                    if (!isNaN(parsed)) updateTimeMs = parsed;
                }
            }

            const twentyMinutesMs = 20 * 60 * 1000;
            const expiryTime = updateTimeMs + twentyMinutesMs;
            const diff = Math.max(0, Math.floor((expiryTime - now) / 1000));
            setTimeLeft(diff);
        };

        tick();
        const intervalId = setInterval(tick, 1000);
        return () => clearInterval(intervalId);
    }, [order.status, order.updatedAt]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden mb-6" style={{ backgroundColor: theme?.primaryColor + '05' }}>
            <CardContent className="p-8 text-center">
                <div className="mb-8">
                    <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full mb-4 bg-white/5 border border-white/10 shadow-xl">
                        <Clock className="h-10 w-10 animate-pulse" style={{ color: theme?.primaryColor }} />
                    </div>
                    {timeLeft !== null && (
                        <div className="mb-4">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 mb-1" style={{color: theme?.textColor}}>Arriving in</p>
                            <p className="text-5xl font-black tabular-nums tracking-tighter" style={{color: theme?.primaryColor}}>{formatTime(timeLeft)}</p>
                        </div>
                    )}
                    <h2 className="text-2xl font-black mb-1" style={{color: theme?.textColor}}>{statusLabels[order.status] || order.status}</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40" style={{color: theme?.textColor}}>Order ID: {order.id.slice(0,8)}</p>
                </div>
                <div className="pt-6 border-t border-black/5">
                    <Button asChild variant="ghost" className="h-12 px-6 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all hover:bg-black/5 active:scale-95" style={{ color: theme?.textColor }}>
                        <Link href={`/live-order/${order.id}`}>
                            <Video className="mr-2 h-4 w-4" /> Watch Preparation Live
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function LiveBillSheet({ orderId, theme }: { orderId: string; theme: MenuTheme | undefined }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [closing, startClose] = useTransition();

  const orderQuery = useMemoFirebase(
    () => (firestore ? doc(firestore, 'orders', orderId) : null),
    [firestore, orderId]
  );
  
  const { data: order, isLoading } = useDoc<Order>(orderQuery);
  
  const closeBill = async () => {
    if (!order) return;
    startClose(async () => {
      const result = await confirmOrderSession(order.id);
      if (result.success) {
          toast({ title: order.status === 'Draft' ? 'Order Placed!' : 'Bill requested.' });
      } else {
          toast({ variant: 'destructive', title: 'Failed to confirm order.', description: result.error });
      }
    });
  };

  const handleRemoveItem = async (itemToRemove: OrderItem) => {
      if (!firestore || !order) return;
      const orderRef = doc(firestore, 'orders', order.id);
      const updatedItems = (order.items || []).filter(item => item.id !== itemToRemove.id);
      if (updatedItems.length === 0) {
          try { await deleteDoc(orderRef); toast({ description: "Bill cleared." }); } catch (e) {}
          return;
      }
      const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      try {
          await updateDoc(orderRef, { items: updatedItems, totalAmount: newTotal });
          toast({ description: `${itemToRemove.productName} removed.` });
      } catch (e) { toast({ variant: 'destructive', title: 'Failed to remove item.' }); }
  };

  if (isLoading) return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin h-8 w-8 text-muted-foreground" /></div>;
  if (!order || !order.items?.length) return <div className="p-8 text-center"><p className="text-muted-foreground text-sm font-medium">Your bill is empty.</p></div>;

  const isDraft = order.status === 'Draft';
  const isLocked = ['Completed', 'Delivered', 'Billed'].includes(order.status);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: theme?.backgroundColor }}>
        <SheetHeader className='p-5 border-b' style={{ borderColor: theme?.primaryColor + '20' }}>
            <SheetTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: theme?.primaryColor }}>
              <Receipt className="h-5 w-5" /> Live Bill
            </SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
             {order.items.map((it, idx) => (
              <div key={idx} className="flex justify-between items-start text-sm pb-3 border-b last:border-0" style={{borderColor: theme?.primaryColor + '10', color: theme?.textColor}}>
                <div className="flex-1 pr-4 min-w-0">
                    <span className="font-bold leading-tight block truncate">{it.productName}</span>
                    <span className="text-[10px] opacity-60 font-bold uppercase tracking-wider">Qty: {it.quantity}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right font-bold shrink-0">₹{(it.price * it.quantity).toFixed(2)}</div>
                    {isDraft && <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(it)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
            ))}
        </div>
        <div className="p-6 border-t space-y-4 bg-black/10 backdrop-blur-md" style={{ borderColor: theme?.primaryColor + '20' }}>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-bold uppercase tracking-widest opacity-60" style={{ color: theme?.textColor }}>Total Amount</span>
              <span className="text-2xl font-black" style={{ color: theme?.primaryColor }}>₹{order.totalAmount.toFixed(2)}</span>
            </div>
            <div className="pt-2">
              {isLocked ? (
                 <div className="text-center p-5 bg-primary/10 border border-white/5 rounded-2xl">
                    <Check className="mx-auto h-8 w-8 mb-2" style={{ color: theme?.primaryColor }} />
                    <p className="font-black text-xs uppercase tracking-widest" style={{ color: theme?.textColor }}>Bill Locked</p>
                </div>
              ) : (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button className="w-full h-14 rounded-2xl text-base font-bold shadow-lg" variant="destructive" disabled={closing}>
                        {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {isDraft ? (order.tableNumber ? 'Confirm Order' : 'Place Order') : 'Close Bill & Pay'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl">
                        <AlertDialogHeader>
                        <AlertDialogTitle>{isDraft ? 'Place Order?' : 'Finalize your bill?'}</AlertDialogTitle>
                        <AlertDialogDescription>{isDraft ? "This will send your order to the kitchen." : "This will signal the staff that you're ready to pay."}</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold">Not yet</AlertDialogCancel>
                        <AlertDialogAction onClick={closeBill} className="rounded-xl font-bold">Yes, Confirm</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
        </div>
    </div>
  );
}


export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const searchParams = useSearchParams();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isAdding, startAdding] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddressMode, setIsAddressOpen] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [isQuickAccessOpen, setIsQuickAccessOpen] = useState(false);
  
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number} | null>(null);

  const [selectedItemForIngredients, setSelectedItemForIngredients] = useState<MenuItem | null>(null);
  const [ingredientsData, setIngredientsData] = useState<GetIngredientsOutput | null>(null);
  const [isFetchingIngredients, startFetchingIngredients] = useTransition();
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  const { canInstall, triggerInstall } = useInstall();

  useEffect(() => {
    const urlTable = searchParams.get('table');
    if (urlTable) {
      setTableNumber(urlTable);
      localStorage.setItem(`last_table_${storeId}`, urlTable);
    } else {
      const savedTable = localStorage.getItem(`last_table_${storeId}`);
      if (savedTable) setTableNumber(savedTable);
    }
    
    const savedAddress = localStorage.getItem(`last_address_${storeId}`);
    const savedName = localStorage.getItem(`last_name_${storeId}`);
    const savedPhone = localStorage.getItem(`last_phone_${storeId}`);
    if (savedAddress) setDeliveryAddress(savedAddress);
    if (savedName) setCustomerName(savedName);
    if (savedPhone) setPhone(savedPhone);
  }, [searchParams, storeId]);

  const sessionId = useMemo(() => {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const subSession = typeof window !== 'undefined' ? localStorage.getItem(`sub_session_${storeId}`) || '1' : '1';
    if (tableNumber) return `table-${tableNumber}-${dateString}-${subSession}`;
    let deviceId = localStorage.getItem(`device_session_${storeId}`);
    if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem(`device_session_${storeId}`, deviceId);
    }
    return `home-${deviceId}-${dateString}-${subSession}`;
  }, [tableNumber, storeId]);

  const orderId = `${storeId}_${sessionId}`;
  const orderRef = useMemoFirebase(
    () => (firestore && sessionId ? doc(firestore, 'orders', orderId) : null),
    [firestore, orderId, sessionId]
  );
  const { data: order, isLoading: orderLoading } = useDoc<Order>(orderRef);
  
  // Define itemCount based on fetched order
  const itemCount = order?.items?.length || 0;

  const storeRef = useMemoFirebase(() => firestore ? doc(firestore, 'stores', storeId) : null, [firestore, storeId]);
  const menuQuery = useMemoFirebase(() => firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null, [firestore, storeId]);
  const { data: store, isLoading: storeLoading } = useDoc<Store>(storeRef);
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);
  const menu = menus?.[0];

  const availableCategories = useMemo(() => {
    if (!menu?.items) return [];
    return Array.from(new Set(menu.items.map(item => item.category))).sort();
  }, [menu]);
  
  const groupedMenu = useMemo(() => {
    if (!menu?.items) return {};
    let filteredItems = menu.items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (selectedCategory) filteredItems = filteredItems.filter(item => item.category === selectedCategory);
    return filteredItems.reduce((acc, item) => {
        const cat = item.category || 'Other';
        if(!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, MenuItem[]>)
  }, [menu, searchTerm, selectedCategory]);

  const handleAddItem = (item: MenuItem) => {
    if (!tableNumber && (!deliveryAddress || !customerName)) {
        setIsAddressOpen(true);
        return;
    }
    startAdding(async () => {
      const result = await addRestaurantOrderItem({
        storeId, sessionId, tableNumber, item, quantity: 1, deliveryAddress, customerName, phone, deliveryLat: deliveryCoords?.lat, deliveryLng: deliveryCoords?.lng,
      });
      if (result.success) {
        toast({ title: "Dish Added" });
        setRecentlyAdded(prev => new Set(prev).add(item.id));
        setTimeout(() => setRecentlyAdded(prev => { const n = new Set(prev); n.delete(item.id); return n; }), 2000);
      }
    });
  };

  const handleShowIngredients = (item: MenuItem) => {
    setSelectedItemForIngredients(item);
    startFetchingIngredients(async () => {
      const response = await getIngredientsForDish({ dishName: item.name, language: 'en' });
      if (response && response.isSuccess) setIngredientsData(response);
    });
  };

  /**
   * Clears the current completed session and starts a fresh one.
   */
  const handleStartNewOrder = () => {
    const currentSub = parseInt(localStorage.getItem(`sub_session_${storeId}`) || '1', 10);
    localStorage.setItem(`sub_session_${storeId}`, (currentSub + 1).toString());
    window.location.reload();
  };

  if (storeLoading || menuLoading || orderLoading) return <div className="p-6 space-y-6"><Skeleton className="h-16 w-16 rounded-2xl" /><Skeleton className="h-10 w-full" /></div>;
  if (!store || !menu) return <div className="p-12 text-center opacity-50">Menu unavailable.</div>;
  
  const isHomeMode = !tableNumber;
  const isCompleted = ['Completed', 'Delivered'].includes(order?.status || '');
  const isTrackingHome = isHomeMode && ['Pending', 'Processing', 'Out for Delivery'].includes(order?.status || '');
  const theme = menu.theme;

  return (
    <>
      {selectedItemForIngredients && (
        <IngredientsDialog
          open={!!selectedItemForIngredients}
          onClose={() => setSelectedItemForIngredients(null)}
          dishName={selectedItemForIngredients.name}
          price={selectedItemForIngredients.price}
          isLoading={isFetchingIngredients}
          calories={ingredientsData?.nutrition?.calories || 0}
          protein={ingredientsData?.nutrition?.protein || 0}
          ingredients={(ingredientsData?.ingredients as any) || []}
          onAdd={() => { handleAddItem(selectedItemForIngredients); setSelectedItemForIngredients(null); }}
        />
      )}

      {/* QUICK ACCESS PREVIEW DIALOG */}
      <QuickAccessDialog 
        store={store} 
        isOpen={isQuickAccessOpen} 
        onOpenChange={isQuickAccessOpen => setIsQuickAccessOpen(isQuickAccessOpen)} 
        onInstall={() => { setIsQuickAccessOpen(false); triggerInstall(); }} 
      />

      <div className="min-h-screen pb-24" style={{ backgroundColor: theme?.backgroundColor }}>
          <div className="container mx-auto py-6 px-4 md:px-6 max-w-2xl">
            <div className="space-y-6">
              
              <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {store.imageUrl && <div className="relative h-12 w-12 rounded-2xl overflow-hidden shrink-0"><Image src={store.imageUrl} alt={store.name} fill className="object-cover" /></div>}
                    <div className="min-w-0">
                        <h1 className="text-base font-black font-headline truncate" style={{ color: theme?.primaryColor }}>{store.name}</h1>
                        {tableNumber && <Badge className="px-1.5 py-0 text-[8px] font-black uppercase tracking-widest" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>Table {tableNumber}</Badge>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/5" onClick={() => setIsSearchOpen(!isSearchOpen)}><Search className="h-3.5 w-3.5" style={{ color: theme?.primaryColor }} /></Button>
                    {canInstall && <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/5" onClick={() => setIsQuickAccessOpen(true)}><Download className="h-3.5 w-3.5" style={{ color: theme?.primaryColor }} /></Button>}
                  </div>
              </div>

              {isSearchOpen && <Input placeholder="Search dishes..." className="rounded-xl h-10 border-2" style={{ borderColor: theme?.primaryColor + '20' }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />}

              <div className="space-y-6">
                {isCompleted ? (
                    <Card className="rounded-[2.5rem] border-0 shadow-2xl text-center py-16 px-8" style={{ backgroundColor: theme?.backgroundColor === '#ffffff' ? '#fafafa' : theme?.backgroundColor, borderColor: theme?.primaryColor + '10' }}>
                        <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full mb-6 bg-white/5"><Check className="h-10 w-10 text-primary" style={{ color: theme?.primaryColor }} /></div>
                        <h2 className="text-2xl font-black mb-3">Thank You!</h2>
                        <Button onClick={handleStartNewOrder} className="rounded-xl h-12 px-8 uppercase font-black text-[10px] tracking-widest shadow-lg" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>Start New Order</Button>
                    </Card>
                ) : (
                    <>
                        {isTrackingHome && <LiveOrderTracker order={order!} theme={theme} />}

                        <ScrollArea className="w-full whitespace-nowrap pb-2">
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className={cn("rounded-lg px-3 h-7 font-black text-[9px] uppercase tracking-widest border", !selectedCategory ? "shadow-md" : "opacity-40")} style={{ backgroundColor: !selectedCategory ? theme?.primaryColor : 'transparent', color: !selectedCategory ? theme?.backgroundColor : theme?.primaryColor }} onClick={() => setSelectedCategory(null)}>All</Button>
                                {availableCategories.map(cat => (
                                    <Button key={cat} variant="ghost" size="sm" className={cn("rounded-lg px-3 h-7 font-black text-[9px] uppercase tracking-widest border", selectedCategory === cat ? "shadow-md" : "opacity-40")} style={{ backgroundColor: selectedCategory === cat ? theme?.primaryColor : 'transparent', color: selectedCategory === cat ? theme?.backgroundColor : theme?.primaryColor }} onClick={() => setSelectedCategory(cat)}>{cat}</Button>
                                ))}
                            </div>
                        </ScrollArea>

                        {canInstall && (
                            <Card onClick={() => setIsQuickAccessOpen(true)} className="rounded-2xl border-dashed border-2 cursor-pointer transition-all hover:bg-black/5" style={{ borderColor: theme?.primaryColor + '40', backgroundColor: theme?.primaryColor + '05' }}>
                                <CardContent className="p-4 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 p-2 rounded-xl"><Download className="h-5 w-5" style={{ color: theme?.primaryColor }} /></div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: theme?.primaryColor }}>Quick Access</p>
                                            <p className="text-xs font-bold" style={{ color: theme?.textColor }}>Add {store.name} to Home Screen</p>
                                        </div>
                                    </div>
                                    <Button size="sm" className="h-8 px-4 rounded-lg font-black text-[9px] uppercase tracking-widest" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>Install</Button>
                                </CardContent>
                            </Card>
                        )}

                        {Object.entries(groupedMenu).map(([category, items]) => (
                            <div key={category} className="space-y-2">
                                <h2 className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 px-1" style={{ color: theme?.textColor }}>{category}</h2>
                                <div className="grid gap-2">
                                    {items.map((item) => (
                                        <Card key={item.id} className="flex justify-between items-center p-3 shadow-sm rounded-xl border" style={{ backgroundColor: 'transparent', borderColor: theme?.primaryColor + '15' }}>
                                            <div className="flex-1 pr-4 min-w-0">
                                                <p className="font-bold text-xs truncate mb-0.5" style={{ color: theme?.textColor }}>{item.name}</p>
                                                <p className="text-[10px] font-black" style={{color: theme?.primaryColor}}>₹{item.price.toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleShowIngredients(item)}><Eye className="h-4 w-4" style={{ color: theme?.textColor }} /></Button>
                                                <Button onClick={() => handleAddItem(item)} disabled={isAdding || recentlyAdded.has(item.id)} className={cn("w-16 h-8 rounded-lg text-[9px] uppercase tracking-widest font-black", recentlyAdded.has(item.id) ? "bg-green-600" : "")} style={{ backgroundColor: recentlyAdded.has(item.id) ? '' : theme?.primaryColor, color: theme?.backgroundColor }}>{recentlyAdded.has(item.id) ? <Check className="h-3 w-3" /> : 'Add'}</Button>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </>
                )}
              </div>
            </div>
          </div>
          
          {itemCount > 0 && ['Pending', 'Processing', 'Out for Delivery', 'Billed', 'Draft'].includes(order?.status || '') && (
               <Sheet>
                  <SheetTrigger asChild>
                      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[200px] px-4">
                          <Button className="h-12 w-full rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.3)] text-[10px] font-black uppercase tracking-widest bg-primary hover:bg-primary/90 text-white" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>
                              <Receipt className="mr-2 h-4 w-4" /> View Bill <Badge className="ml-2 h-5 min-w-[20px] rounded-md text-[9px] font-black flex items-center justify-center" style={{ backgroundColor: theme?.backgroundColor, color: theme?.primaryColor }}>{itemCount}</Badge>
                          </Button>
                      </div>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[70vh] rounded-t-[2.5rem] p-0 border-0 overflow-hidden shadow-2xl">
                      <LiveBillSheet orderId={order!.id} theme={theme} />
                  </SheetContent>
              </Sheet>
          )}
        </div>
    </>
  );
}
