
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  limit,
  Timestamp,
  orderBy,
  setDoc,
  serverTimestamp,
  updateDoc,
  writeBatch
} from 'firebase/firestore';

import type {
  Store,
  Menu,
  MenuItem,
  Order,
  OrderItem,
  MenuTheme,
  GetIngredientsOutput,
  Product,
  ProductVariant,
  CustomizationOption,
} from '@/lib/types';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { format } from 'date-fns';

import {
  Utensils,
  Plus,
  Minus,
  Receipt,
  Loader2,
  Check,
  Clock,
  Search,
  Download,
  Eye,
  CreditCard,
  PlusCircle,
  BellRing,
  ArrowLeft,
  Sparkles,
  Package,
  CheckCircle,
  AlertTriangle,
  CookingPot,
  LocateFixed,
  Video,
  Truck,
  X,
  Calculator,
  ShoppingBag,
  ArrowRight,
  History,
  Leaf,
  Phone
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

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { getIngredientsForDish } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import IngredientsDialog from '@/components/IngredientsDialog';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import QRCode from 'qrcode.react';
import { useAppStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

// --- HELPERS ---
function toDateSafe(d: any): Date {
    if (!d) return new Date();
    if (d instanceof Date) return d;
    if (d instanceof Timestamp) return d.toDate();
    if (typeof d === 'string') return new Date(d);
    if (typeof d === 'object' && d.seconds) return new Date(d.seconds * 1000);
    return new Date();
}

// --- SUB-COMPONENTS ---

function OrderStatusTimeline({ status, theme }: { status: Order['status'], theme?: MenuTheme }) {
    const steps = [
        { label: 'Placed', icon: Package, s: 1 },
        { label: 'Kitchen', icon: CookingPot, s: 2 },
        { label: 'Ready', icon: Receipt, s: 3 },
        { label: 'Served', icon: Check, s: 4 },
    ];

    const getStep = (s: string) => {
        if (s === 'Pending') return 1;
        if (s === 'Processing') return 2;
        if (['Billed', 'Out for Delivery'].includes(s)) return 3;
        if (['Completed', 'Delivered'].includes(s)) return 4;
        return 0;
    };

    const currentStep = getStep(status);
    if (status === 'Cancelled') return <Badge variant="destructive" className="rounded-xl w-full py-2 justify-center font-black text-[10px] tracking-widest">ORDER CANCELLED</Badge>;

    return (
        <div className="relative py-4">
            <div className="flex justify-between items-center relative z-10">
                {steps.map((step, idx) => {
                    const isActive = currentStep >= step.s;
                    return (
                        <div key={idx} className="flex flex-col items-center gap-1.5">
                            <div className={cn(
                                "h-8 w-8 rounded-full flex items-center justify-center border-2 transition-all",
                                isActive ? "bg-primary border-primary text-white scale-110 shadow-lg" : "bg-black/20 border-white/10 text-white/20"
                            )} style={{ backgroundColor: isActive ? theme?.primaryColor : '', borderColor: isActive ? theme?.primaryColor : '' }}>
                                <step.icon className="h-4 w-4" />
                            </div>
                            <span className="text-[7px] font-black uppercase tracking-tighter text-white/40">{step.label}</span>
                        </div>
                    )
                })}
            </div>
            <div className="absolute top-[30px] left-[10%] right-[10%] h-[2px] bg-white/5 -z-0">
                <div className="h-full transition-all duration-1000 bg-primary" style={{ width: `${Math.min(100, Math.max(0, (currentStep - 1) * 33.33))}%`, backgroundColor: theme?.primaryColor }} />
            </div>
        </div>
    );
}

function DeliveryDetailsDialog({ isOpen, onOpenChange, onSave, initialData, theme }: any) {
    const [name, setName] = useState(initialData.name || '');
    const [phone, setPhone] = useState(initialData.phone || '');
    const [address, setAddress] = useState(initialData.address || '');
    const [lat, setLat] = useState<number | null>(null);
    const [lng, setLng] = useState<number | null>(null);
    const [isLocating, setIsLocating] = useState(false);

    const handleGetLocation = () => {
        setIsLocating(true);
        navigator.geolocation.getCurrentPosition((pos) => {
            setLat(pos.coords.latitude);
            setLng(pos.coords.longitude);
            setAddress(`GPS (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
            setIsLocating(false);
        }, () => setIsLocating(false));
    };

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-[2.5rem] border-0 shadow-2xl">
                <DialogHeader>
                    <DialogTitle>Delivery Info</DialogTitle>
                    <DialogDescription>Where should we send your order?</DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-1"><Label className="text-[10px] uppercase font-black opacity-40">Your Name</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className="rounded-xl" /></div>
                    <div className="space-y-1"><Label className="text-[10px] uppercase font-black opacity-40">Mobile Number</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="10-digit number" className="rounded-xl" /></div>
                    <div className="space-y-1">
                        <Label className="text-[10px] uppercase font-black opacity-40">Full Address</Label>
                        <div className="flex gap-2">
                            <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Street, Building, Area" className="rounded-xl flex-1" />
                            <Button variant="outline" size="icon" className="rounded-xl h-10 w-10 shrink-0" onClick={handleGetLocation} disabled={isLocating}>
                                {isLocating ? <Loader2 className="h-4 w-4 animate-spin"/> : <LocateFixed className="h-4 w-4" />}
                            </Button>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={() => onSave({ name, phone, address, lat, lng })} disabled={!name || !phone || !address} className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>Confirm Delivery Details</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function LiveBillSheet({ 
    sessionId, 
    theme, 
    store, 
    onShowUpi, 
    isSalon,
    placedOrders,
    historyOrders,
    isLoadingOrders,
    onFinalizeBill 
}: { 
    sessionId: string; 
    theme: MenuTheme | undefined; 
    store: Store; 
    onShowUpi: () => void; 
    isSalon: boolean;
    placedOrders: Order[];
    historyOrders: Order[];
    isLoadingOrders: boolean;
    onFinalizeBill: () => void;
}) {
  const { cartItems } = useCart();
  const sessionTotal = useMemo(() => placedOrders.reduce((acc, order) => acc + order.totalAmount, 0), [placedOrders]);
  const isBilled = placedOrders.some(o => o.status === 'Billed');
  const isFinalized = placedOrders.length > 0 && placedOrders.every(o => ['Completed', 'Delivered'].includes(o.status));

  if (isLoadingOrders) return <div className="flex justify-center p-12 bg-[#1A1616]"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: theme?.backgroundColor || '#1A1616' }}>
        <SheetHeader className='p-5 border-b' style={{ borderColor: theme?.primaryColor + '20' }}>
            <SheetTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: theme?.primaryColor || '#FBC02D' }}>
                <Receipt className="h-5 w-5" /> {isSalon ? 'Visit Progress' : 'Live Order Progress'}
            </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-10">
             {/* CURRENT ACTIVE ORDERS */}
             {placedOrders.length > 0 && (
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <Sparkles className="h-3 w-3" /> Current Session
                    </h4>
                    {placedOrders.sort((a,b) => toDateSafe(a.orderDate).getTime() - toDateSafe(b.orderDate).getTime()).map((order, idx) => (
                        <div key={order.id} className="space-y-3 p-4 rounded-3xl border-2 bg-black/10" style={{ borderColor: theme?.primaryColor + '10' }}>
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: theme?.textColor || '#fff' }}>Batch #{idx + 1}</h4>
                                <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20" style={{ color: theme?.primaryColor || '#FBC02D' }}>{order.status}</Badge>
                            </div>
                            
                            <OrderStatusTimeline status={order.status} theme={theme} />

                            <div className="space-y-1 pt-2">
                                {order.items.map((it, iIdx) => (
                                    <div key={iIdx} className="flex flex-col text-[11px]" style={{ color: theme?.textColor || '#fff' }}>
                                        <div className="flex justify-between">
                                            <span className="opacity-80 font-bold">{it.productName} x{it.quantity}</span>
                                            <span className="font-black">₹{it.price * it.quantity}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                 </div>
             )}

             {/* UN-PLACED ITEMS */}
             {cartItems.length > 0 && (
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40" style={{ color: theme?.textColor || '#fff' }}>Selection (Ready to Send)</h4>
                    <div className="p-4 rounded-3xl border-2 border-dashed bg-white/5 space-y-3" style={{ borderColor: theme?.primaryColor + '30' }}>
                        {cartItems.map((it, idx) => (
                            <div key={idx} className="flex flex-col text-xs" style={{ color: theme?.textColor || '#fff' }}>
                                <div className="flex justify-between">
                                    <span className="opacity-80 font-bold">{it.product.name} x{it.quantity}</span>
                                    <span className="font-black">₹{(it.variant.price * it.quantity).toFixed(0)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
             )}

             {/* ORDER HISTORY (PREVIOUS VISITS) */}
             {historyOrders.length > 0 && (
                 <div className="space-y-4 pt-4 border-t border-white/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <History className="h-3 w-3" /> Order History (Past Visits)
                    </h4>
                    <div className="space-y-2">
                        {historyOrders.map((order) => (
                            <div key={order.id} className="p-3 rounded-2xl bg-black/20 flex justify-between items-center text-[10px]">
                                <div>
                                    <p className="font-black text-white/80">{format(toDateSafe(order.orderDate), 'dd MMM yyyy')}</p>
                                    <p className="opacity-40">{order.items.length} items</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-primary">₹{order.totalAmount.toFixed(0)}</p>
                                    <p className="text-[8px] uppercase opacity-40 font-bold">Successful</p>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
             )}
        </div>

        <div className="p-6 border-t space-y-4 bg-black/20" style={{ borderColor: theme?.primaryColor + '20' }}>
            <div className="flex justify-between items-baseline mb-2">
                <span className="text-sm font-bold uppercase tracking-widest opacity-60" style={{ color: theme?.textColor || '#fff' }}>Total Session Bill</span>
                <span className="text-2xl font-black" style={{ color: theme?.primaryColor || '#FBC02D' }}>₹{sessionTotal.toFixed(2)}</span>
            </div>
            
            <div className="pt-2">
              {isFinalized ? (
                 <div className="text-center p-5 bg-primary/10 rounded-2xl border-2" style={{ borderColor: theme?.primaryColor + '30' }}>
                    <CheckCircle className="mx-auto h-8 w-8 mb-2" style={{ color: theme?.primaryColor || '#FBC02D' }} />
                    <p className="font-black text-xs uppercase" style={{ color: theme?.textColor || '#fff' }}>Visit Completed</p>
                </div>
              ) : isBilled && store.upiId ? (
                  <Button onClick={onShowUpi} className="w-full h-14 rounded-2xl uppercase font-black tracking-widest bg-green-600 hover:bg-green-700 text-white shadow-xl">
                    <CreditCard className="mr-2 h-5 w-5" /> Pay ₹{sessionTotal.toFixed(0)} with UPI
                  </Button>
              ) : isBilled ? (
                 <div className="text-center p-5 bg-primary/10 rounded-2xl border-2" style={{ borderColor: theme?.primaryColor + '30' }}>
                    <Clock className="mx-auto h-8 w-8 mb-2" style={{ color: theme?.primaryColor || '#FBC02D' }} />
                    <p className="font-black text-xs uppercase" style={{ color: theme?.textColor || '#fff' }}>Bill Requested</p>
                </div>
              ) : placedOrders.length > 0 ? (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button className="w-full h-14 rounded-2xl text-base font-black uppercase tracking-widest shadow-xl" variant="destructive">Finalize Bill & Pay</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2rem] border-0 shadow-2xl" style={{ backgroundColor: theme?.backgroundColor || '#1A1616' }}>
                        <AlertDialogHeader><AlertDialogTitle className="text-xl font-black uppercase" style={{ color: theme?.primaryColor || '#FBC02D' }}>Finalize Visit?</AlertDialogTitle><AlertDialogDescription style={{ color: theme?.textColor || '#fff', opacity: 0.7 }}>This will close your ordering session and generate the final bill.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter className="gap-2"><AlertDialogCancel className="rounded-xl font-bold">Back</AlertDialogCancel><AlertDialogAction onClick={onFinalizeBill} className="rounded-xl font-bold" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>Finalize</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
        </div>
    </div>
  );
}

function MenuCard({ item, onAdd, onShowDetails, recentlyAdded, currentQuantityInOrder, theme, isPersonalized = false }: { item: MenuItem, onAdd: (item: MenuItem, qty: number) => void, onShowDetails: (item: MenuItem) => void, recentlyAdded: boolean, currentQuantityInOrder: number, theme: MenuTheme | undefined, isPersonalized?: boolean }) {
    const [qty, setQty] = useState(1);
    const isOutOfStock = item.isAvailable === false;
    
    return (
        <Card className={cn(
            "flex flex-col shadow-xl rounded-[1.5rem] border-0 overflow-hidden group hover:shadow-2xl transition-all duration-300 relative",
            isOutOfStock && "opacity-50 grayscale pointer-events-none",
            isPersonalized && "ring-2 ring-primary/40 shadow-primary/10"
        )} style={{ backgroundColor: '#ffffff' }}>
            <div className="relative aspect-video w-full rounded-t-[1.5rem] overflow-hidden cursor-pointer" onClick={() => onShowDetails(item)}>
                <Image src={item.imageUrl || ADIRES_LOGO} alt={item.name} fill className="object-cover group-hover:scale-110 transition-transform duration-500" />
                {item.dietary && (
                    <div className="absolute top-2 left-2 h-5 w-5 bg-white/90 rounded-sm flex items-center justify-center p-0.5 shadow-md">
                        <div className={cn("h-full w-full rounded-full border-2", item.dietary === 'veg' ? 'border-green-600 bg-green-600' : 'border-red-600 bg-red-600')}></div>
                    </div>
                )}
                <div className="absolute bottom-2 left-2 bg-primary text-white px-3 py-1 rounded-full shadow-lg border border-white/20">
                    <p className="text-xs font-black">₹{item.price.toFixed(0)}</p>
                </div>
                {isOutOfStock && <div className="absolute inset-0 bg-black/60 flex items-center justify-center"><Badge variant="destructive" className="font-black uppercase text-[10px]">Sold Out</Badge></div>}
            </div>
            <div className="p-3 flex flex-col gap-3 flex-1 min-w-0">
                <div className="min-w-0">
                    <h3 className="font-black text-sm leading-tight text-gray-950 mb-1 truncate">{item.name}</h3>
                    <div className="flex items-center gap-1.5 opacity-60">
                        <Sparkles className="h-3 w-3 text-amber-500" />
                        <span className="text-[8px] font-black uppercase tracking-widest text-gray-600">Top Rated</span>
                    </div>
                </div>
                <div className="flex items-center justify-between h-8 w-full rounded-xl bg-muted/50 border border-black/5 px-1 overflow-hidden">
                    <button onClick={() => setQty(Math.max(1, qty - 1))} className="h-6 w-6 rounded-lg flex items-center justify-center text-gray-600 hover:bg-black/5"><Minus className="h-3 w-3" /></button>
                    <span className="text-xs font-black text-gray-950">{qty}</span>
                    <button onClick={() => setQty(qty + 1)} className="h-6 w-6 rounded-lg flex items-center justify-center text-gray-600 hover:bg-black/5"><Plus className="h-3 w-3" /></button>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl bg-black/5 hover:bg-black/10" onClick={() => onShowDetails(item)}><Eye className="h-4 w-4 text-gray-600" /></Button>
                    <Button onClick={() => onAdd(item, qty)} disabled={isOutOfStock} className={cn("flex-1 h-9 rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg transition-all active:scale-95", recentlyAdded ? "bg-green-600 text-white" : "")} style={{ backgroundColor: recentlyAdded ? '' : (theme?.primaryColor || '#FBC02D'), color: recentlyAdded ? '' : (theme?.backgroundColor || '#1A1616') }}>
                        {recentlyAdded ? <Check className="h-4 w-4" /> : 'Add to Order'}
                    </Button>
                </div>
            </div>
        </Card>
    );
}

// --- MAIN PAGE ---

export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const searchParams = useSearchParams(); const { firestore } = useFirebase(); const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState(''); const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [vegOnly, setVegOnly] = useState(false);
  const [isDeliveryDetailsOpen, setIsDeliveryDetailsOpen] = useState(false); const [isModeDialogOpen, setIsModeDialogOpen] = useState(false); const [isUpiDialogOpen, setIsUpiDialogOpen] = useState(false);
  const [isLiveBillOpen, setIsLiveBillOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState<string | null>(null); const [deliveryAddress, setDeliveryAddress] = useState(''); const [customerName, setCustomerName] = useState(''); const [phone, setPhone] = useState(''); const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number} | null>(null);
  const [selectedItemForIngredients, setSelectedItemForIngredients] = useState<MenuItem | null>(null); const [ingredientsData, setIngredientsData] = useState<GetIngredientsOutput | null>(null); const [isFetchingIngredients, startFetchingIngredients] = useTransition(); const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());
  const [isAdding, startAdding] = useTransition();
  const { canInstall, triggerInstall } = useInstall();
  const { isInitialized, fetchInitialData } = useAppStore();
  const { cartItems, addItem, clearCart } = useCart();

  const { data: store, isLoading: storeLoading } = useDoc<Store>(useMemoFirebase(() => firestore ? doc(firestore, 'stores', storeId) : null, [firestore, storeId]));
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(useMemoFirebase(() => firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null, [firestore, storeId]));
  const menu = menus?.[0];

  const upsellItems = useMemo(() => {
      if (!selectedItemForIngredients || !menu?.items) return [];
      const recIds = (selectedItemForIngredients as any).recommendations || [];
      return menu.items.filter(i => recIds.includes(i.id));
  }, [selectedItemForIngredients, menu?.items]);

  // STABLE DEVICE IDENTITY
  const deviceId = useMemo(() => {
      if (typeof window === 'undefined') return 'unknown';
      let dId = localStorage.getItem(`device_id_${storeId}`);
      if (!dId) {
          dId = Math.random().toString(36).substring(2, 15);
          localStorage.setItem(`device_id_${storeId}`, dId);
      }
      return dId;
  }, [storeId]);

  const sessionId = useMemo(() => {
    const dS = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
    if (tableNumber === 'Counter') return `counter-${Date.now()}-${storeId}`; 
    if (tableNumber) return `table-${tableNumber}-${dS}-${storeId}`;
    return `home-${deviceId}-${dS}`;
  }, [tableNumber, storeId, deviceId]);

  // QUERY FOR CURRENT SESSION ORDERS
  const ordersQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, 'orders'), where('sessionId', '==', sessionId), where('isActive', '==', true)) : null), [firestore, sessionId]);
  const { data: placedOrders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

  // QUERY FOR HISTORY (Previous visits from this device)
  const historyQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      return query(
          collection(firestore, 'orders'),
          where('storeId', '==', storeId),
          where('deviceId', '==', deviceId),
          where('isActive', '==', false),
          orderBy('orderDate', 'desc'),
          limit(5)
      );
  }, [firestore, storeId, deviceId]);
  const { data: historyOrders } = useCollection<Order>(historyQuery);

  const activeItemCount = useMemo(() => placedOrders?.reduce((acc, o) => acc + o.items.length, 0) || 0, [placedOrders]);
  const isSalon = useMemo(() => !!(store?.businessType === 'salon' || store?.name.toLowerCase().includes('salon')), [store]);
  const availableCategories = useMemo(() => menu?.items ? Array.from(new Set(menu.items.map(i => i.category))).sort() : [], [menu]);
  
  // INTELLIGENT PERSONALIZATION LOGIC
  const personalizedRecommendations = useMemo(() => {
      if (!menu?.items || !historyOrders) return [];
      
      const itemFrequency: Record<string, number> = {};
      historyOrders.forEach(order => {
          order.items.forEach(it => {
              itemFrequency[it.productName] = (itemFrequency[it.productName] || 0) + 1;
          });
      });

      const recommended = menu.items
          .filter(item => item.isAvailable !== false)
          .map(item => ({ item, score: itemFrequency[item.name] || 0 }))
          .filter(pair => pair.score > 0)
          .sort((a, b) => b.score - a.score)
          .map(pair => pair.item)
          .slice(0, 4);

      if (recommended.length === 0) {
          return menu.items.filter(i => i.isAvailable !== false).slice(0, 4);
      }

      return recommended;
  }, [menu?.items, historyOrders]);

  const groupedMenu = useMemo(() => {
    if (!menu?.items) return {};
    let filtered = menu.items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (selectedCategory) filtered = filtered.filter(i => i.category === selectedCategory);
    if (vegOnly) filtered = filtered.filter(i => i.dietary === 'veg');
    
    return filtered.reduce((acc, i) => { const c = i.category || 'Other'; if(!acc[c]) acc[c] = []; acc[c].push(i); return acc; }, {} as Record<string, MenuItem[]>);
  }, [menu, searchTerm, selectedCategory, vegOnly]);

  const currentOrderedCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      placedOrders?.forEach(order => { order.items.forEach(item => { counts[item.productName] = (counts[item.productName] || 0) + item.quantity; }); });
      return counts;
  }, [placedOrders]);

  useEffect(() => { if (firestore && !isInitialized) fetchInitialData(firestore); }, [firestore, isInitialized, fetchInitialData]);

  useEffect(() => {
    const urlTable = searchParams.get('table'); if (urlTable) setTableNumber(urlTable);
    const sA = localStorage.getItem(`last_address_${storeId}`); const sN = localStorage.getItem(`last_name_${storeId}`); const sP = localStorage.getItem(`last_phone_${storeId}`);
    if (sA) setDeliveryAddress(sA); if (sN) setCustomerName(sN); if (sP) setPhone(sP);
  }, [searchParams, storeId]);

  if (storeLoading || menuLoading || ordersLoading) return <div className="p-12 flex items-center justify-center bg-white min-h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!store) return <div className="p-12 text-center bg-white min-h-screen text-gray-900">Store not found.</div>;

  const handleAddItem = (item: MenuItem, qty: number = 1, customs?: Record<string, CustomizationOption[]>) => {
    const product: Product = { 
        id: item.id, 
        storeId: storeId, 
        name: item.name, 
        description: item.description || '', 
        imageId: 'cat-restaurant', 
        isMenuItem: true, 
        price: item.price, 
        imageUrl: (item as any).imageUrl 
    };
    
    const customsPrice = customs ? Object.values(customs).flat().reduce((acc, o) => acc + o.price, 0) : 0;
    const variant: ProductVariant = { 
        sku: `${item.id}-default`, 
        weight: '1 pc', 
        price: item.price + customsPrice, 
        stock: 999 
    };
    
    addItem(product, variant, qty, tableNumber || undefined, sessionId, customs);
    setRecentlyAdded(prev => new Set(prev).add(item.id));
    setTimeout(() => setRecentlyAdded(prev => { const n = new Set(prev); n.delete(item.id); return n; }), 2000);
  };

  const handlePlaceOrder = () => {
    if (!tableNumber && (!deliveryAddress || !customerName || !phone)) { setIsDeliveryDetailsOpen(true); return; }
    if (!firestore) return;

    startAdding(async () => {
        const isCounter = tableNumber === 'Counter';
        const orderId = doc(collection(firestore, 'orders')).id;
        const orderRef = doc(firestore, 'orders', orderId);

        const orderItems: OrderItem[] = cartItems.map(item => ({
          id: crypto.randomUUID(), 
          orderId: orderId,
          productId: item.product.id,
          menuItemId: item.product.id, 
          productName: item.product.name, 
          variantSku: item.variant.sku,
          variantWeight: item.variant.weight, 
          quantity: item.quantity, 
          price: item.variant.price,
          selectedCustomizations: item.selectedCustomizations
        }));

        const totalAmount = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

        const orderData = {
          id: orderId, 
          storeId: storeId, 
          tableNumber: tableNumber ? String(tableNumber) : null,
          sessionId: sessionId,
          deviceId: deviceId, 
          userId: 'guest',
          customerName: customerName || (tableNumber === 'Counter' ? 'Walk-in Guest' : (tableNumber ? `Table ${tableNumber}` : 'Guest')),
          deliveryAddress: deliveryAddress || (tableNumber ? 'In-store dining' : 'TBD'),
          deliveryLat: deliveryCoords?.lat || 0,
          deliveryLng: deliveryCoords?.lng || 0,
          phone: phone || '',
          status: isCounter ? 'Billed' : 'Pending',
          orderType: tableNumber === 'Counter' ? 'counter' : (tableNumber ? 'dine-in' : 'delivery'),
          isActive: true, 
          orderDate: serverTimestamp(), 
          updatedAt: serverTimestamp(),
          items: orderItems,
          totalAmount: totalAmount,
        };

        setDoc(orderRef, orderData).catch(async (e) => {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: orderRef.path,
                operation: 'create',
                requestResourceData: orderData
            }));
        });
        
        toast({ title: isCounter ? 'Bill Generated!' : 'Sent to Kitchen!' }); 
        clearCart(); 
        if(isCounter) handleStartNewOrder(); 
    });
  };

  const handleFinalizeBill = () => { 
    if (!firestore || !placedOrders?.length) return;
    const batch = writeBatch(firestore);
    placedOrders.forEach(order => {
        batch.update(doc(firestore, 'orders', order.id), { status: 'Billed', updatedAt: serverTimestamp() });
    });
    
    batch.commit().catch(e => toast({ variant: 'destructive', title: 'Action Failed' }));
    toast({ title: 'Bill Requested' });
  };

  const handleCallWaiter = (type: string) => { 
    if (!firestore || !placedOrders?.length) return;
    const orderRef = doc(firestore, 'orders', placedOrders[0].id);
    
    updateDoc(orderRef, { needsService: true, serviceType: type, updatedAt: serverTimestamp() })
        .catch(e => toast({ variant: 'destructive', title: 'Request Failed' }));
    toast({ title: 'Request Sent' }); 
  };

  const handleShowIngredients = (item: MenuItem) => {
    setIngredientsData(null); setSelectedItemForIngredients(item);
    startFetchingIngredients(async () => {
      const res = await getIngredientsForDish({ dishName: item.name, language: 'en' });
      if (res && res.isSuccess) setIngredientsData(res);
    });
  };

  const handleStartNewOrder = () => { window.location.reload(); };

  const theme = menu?.theme;
  const isSessionFinalized = !!(placedOrders && placedOrders.length > 0 && placedOrders.every(o => ['Completed', 'Delivered'].includes(o.status)));

  return (
    <>
      {selectedItemForIngredients && (
        <IngredientsDialog 
            open={!!selectedItemForIngredients} 
            onClose={() => setSelectedItemForIngredients(null)} 
            item={selectedItemForIngredients}
            isLoading={isFetchingIngredients} 
            ingredients={(ingredientsData?.components as any) || []} 
            recommendations={upsellItems}
            itemType={ingredientsData?.itemType} 
            onAdd={(customs) => { 
                handleAddItem(selectedItemForIngredients, 1, customs); 
                setSelectedItemForIngredients(null); 
            }} 
            onShowRecommendation={(rec) => {
                setSelectedItemForIngredients(rec);
                handleShowIngredients(rec);
            }}
        />
      )}
      <DeliveryDetailsDialog isOpen={isDeliveryDetailsOpen} onOpenChange={setIsDeliveryDetailsOpen} onSave={(d: any) => { setCustomerName(d.name); setPhone(d.phone); setDeliveryAddress(d.address); if(d.lat) setDeliveryCoords({lat:d.lat, lng:d.lng}); localStorage.setItem(`last_address_${storeId}`, d.name); localStorage.setItem(`last_phone_${storeId}`, d.phone); localStorage.setItem(`last_address_${storeId}`, d.address); setIsDeliveryDetailsOpen(false); }} initialData={{ name: customerName, phone, address: deliveryAddress }} theme={theme} />
      <ModeSelectionDialog isOpen={isModeDialogOpen} onOpenChange={setIsModeDialogOpen} onSelectMode={(m: any, v: any) => { if(m==='delivery') setTableNumber(null); else if(v) setTableNumber(v); setIsModeDialogOpen(false); handleStartNewOrder(); }} currentMode={tableNumber === 'Counter' ? 'counter' : (tableNumber ? 'table' : 'delivery')} theme={theme} isSalon={isSalon} />
      {placedOrders && <UPIPaymentDialog isOpen={isUpiDialogOpen} onOpenChange={setIsUpiDialogOpen} total={placedOrders.reduce((acc, o) => acc + o.totalAmount, 0)} store={store} theme={theme} />}
      
      <div className="min-h-screen pb-24 bg-[#FDFCF7]">
          <div className="container mx-auto py-4 px-3 max-w-2xl">
            <div className="space-y-6">
              <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                      <Button asChild variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-black/5"><Link href="/"><ArrowLeft className="h-4 w-4 text-gray-950" /></Link></Button>
                      <div className="relative h-10 w-10 rounded-xl overflow-hidden border-2 shadow-sm" style={{ borderColor: theme?.primaryColor || '#FBC02D' }}><Image src={store.imageUrl || ADIRES_LOGO} alt={store.name} fill className="object-cover" /></div>
                      <div className="min-w-0">
                          <h1 className="text-base font-black truncate leading-tight text-gray-950">{store.name}</h1>
                          <div className="flex items-center gap-1.5 mt-0.5">
                              {tableNumber === 'Counter' ? <Badge className="px-1.5 py-0 text-[8px] font-black uppercase tracking-widest bg-green-600 text-white border-0">Counter</Badge> : tableNumber ? <Badge className="px-1.5 py-0 text-[8px] font-black uppercase tracking-widest" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>{isSalon ? `Chair ${tableNumber}` : `T-${tableNumber}`}</Badge> : <Badge className="px-1.5 py-0 text-[8px] font-black uppercase tracking-widest bg-blue-600 text-white border-0">{isSalon ? 'Home' : 'Delivery'}</Badge>}
                              <button onClick={() => setIsModeDialogOpen(true)} className="text-[8px] font-black uppercase tracking-widest underline opacity-40 hover:opacity-100 transition-opacity text-gray-900">Change</button>
                          </div>
                      </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                      {canInstall && (
                        <Button onClick={triggerInstall} size="sm" className="h-8 rounded-xl font-black text-[9px] uppercase tracking-widest shadow-lg shadow-primary/20" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>
                            <Download className="mr-1.5 h-3.5 w-3.5" /> Install App
                        </Button>
                      )}
                      {store.liveVideoUrl && placedOrders && placedOrders.length > 0 && (
                        <Button asChild variant="outline" size="sm" className="h-8 rounded-xl border-2 px-3 font-black text-[9px] uppercase tracking-widest" style={{ color: theme?.primaryColor || '#FBC02D', borderColor: theme?.primaryColor || '#FBC02D' }}>
                            <Link href={`/live-order/${placedOrders[0].id}`}><Video className="mr-1.5 h-3.5 w-3.5" /> Live</Link>
                        </Button>
                      )}
                  </div>
              </div>

              {isSessionFinalized ? (
                  <Card className="rounded-[2.5rem] border-0 shadow-2xl text-center py-16 px-6 bg-white">
                      <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full mb-6 bg-green-50 border-4 border-green-100 shadow-inner"><CheckCircle className="h-10 w-10 text-green-600" /></div>
                      <h2 className="text-2xl font-black mb-4 text-gray-950 tracking-tight uppercase">Visit Completed</h2>
                      <Button onClick={handleStartNewOrder} className="rounded-xl h-12 px-8 uppercase font-black text-[10px] tracking-[0.2em] shadow-2xl" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>Start New Session</Button>
                  </Card>
              ) : (
                <div className="space-y-6">
                    <div className="flex gap-2 bg-white p-1.5 rounded-2xl border-2 border-black/5 overflow-x-auto no-scrollbar shadow-sm">
                        <button 
                            onClick={() => setVegOnly(!vegOnly)}
                            className={cn(
                                "flex items-center gap-2 px-4 h-9 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all shrink-0 border-2",
                                vegOnly ? "bg-green-600 border-green-500 text-white shadow-lg" : "bg-muted border-transparent text-gray-400"
                            )}
                        >
                            <Leaf className={cn("h-3 w-3", vegOnly ? "text-white" : "text-green-600")} />
                            Veg Only
                        </button>
                        <Separator orientation="vertical" className="h-9 bg-black/5" />
                        <button 
                            onClick={() => setSelectedCategory(null)} 
                            className={cn(
                                "px-4 h-9 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 transition-all shrink-0", 
                                !selectedCategory ? "bg-primary border-primary text-white shadow-md" : "bg-transparent border-transparent text-gray-400"
                            )}
                            style={!selectedCategory ? { backgroundColor: theme?.primaryColor } : {}}
                        >
                            All
                        </button>
                        {availableCategories.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => setSelectedCategory(cat)} 
                                className={cn(
                                    "px-4 h-9 rounded-xl font-black text-[9px] uppercase tracking-widest border-2 transition-all shrink-0", 
                                    selectedCategory === cat ? "bg-primary border-primary text-white shadow-md" : "bg-transparent border-transparent text-gray-400"
                                )}
                                style={selectedCategory === cat ? { backgroundColor: theme?.primaryColor } : {}}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>

                    <div className="relative group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary group-focus-within:text-primary transition-colors" style={{ color: theme?.primaryColor }} />
                        <Input 
                            placeholder="Search dishes or categories..." 
                            value={searchTerm} 
                            onChange={(e) => setSearchTerm(e.target.value)} 
                            className="h-14 rounded-2xl bg-white border-4 pl-12 text-sm font-black text-gray-950 placeholder:text-gray-300 shadow-xl" 
                            style={{ borderColor: theme?.primaryColor + '40' }} 
                        />
                        {searchTerm && (
                            <button onClick={() => setSearchTerm('')} className="absolute right-4 top-1/2 -translate-y-1/2 h-6 w-6 bg-black/5 rounded-full flex items-center justify-center"><X className="h-3 w-3 text-gray-400" /></button>
                        )}
                    </div>

                    {!searchTerm && !selectedCategory && personalizedRecommendations.length > 0 && (
                        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                            <div className="flex items-center gap-2 px-1">
                                <Sparkles className="h-4 w-4 text-amber-500" />
                                <h2 className="text-xl font-black uppercase tracking-tighter text-gray-950">Recommended</h2>
                            </div>
                            <ScrollArea className="w-full whitespace-nowrap pb-4">
                                <div className="flex gap-4 px-1">
                                    {personalizedRecommendations.map(item => (
                                        <div key={item.id} className="w-48 flex-shrink-0">
                                            <MenuCard 
                                                item={item} 
                                                onAdd={handleAddItem} 
                                                onShowDetails={handleShowIngredients} 
                                                recentlyAdded={recentlyAdded.has(item.id)} 
                                                currentQuantityInOrder={currentOrderedCounts[item.name] || 0} 
                                                theme={theme} 
                                                isPersonalized={true}
                                            />
                                        </div>
                                    ))}
                                </div>
                                <ScrollBar orientation="horizontal" className="opacity-0" />
                            </ScrollArea>
                        </section>
                    )}

                    {Object.keys(groupedMenu).length > 0 ? (
                        Object.entries(groupedMenu).map(([category, items]) => (
                            <section key={category} className="space-y-4 pt-4">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 px-1">{category}</h2>
                                <div className="grid grid-cols-2 gap-4">
                                    {items.map((item) => (
                                        <MenuCard key={item.id} item={item} onAdd={handleAddItem} onShowDetails={handleShowIngredients} recentlyAdded={recentlyAdded.has(item.id)} currentQuantityInOrder={currentOrderedCounts[item.name] || 0} theme={theme} />
                                    ))}
                                </div>
                            </section>
                        ))
                    ) : (
                        <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-black/5 opacity-40">
                            <AlertTriangle className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-950">Zero matches found</p>
                            <button className="mt-2 text-primary font-bold uppercase text-[8px] tracking-widest underline" onClick={() => { setSearchTerm(''); setSelectedCategory(null); setVegOnly(false); }}>Clear Filters</button>
                        </div>
                    )}
                </div>
              )}
            </div>
          </div>

          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[400px] px-4 flex gap-2">
              {tableNumber && tableNumber !== 'Counter' && placedOrders && placedOrders.length > 0 && (
                  <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="outline" className="h-14 w-14 rounded-2xl shadow-2xl border-4 shrink-0 bg-white text-primary" style={{ borderColor: theme?.primaryColor || '#FBC02D', color: theme?.primaryColor }}><BellRing className="h-6 w-6" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-48 rounded-2xl p-2 border-0 shadow-2xl">
                          <DropdownMenuLabel className="text-[10px] uppercase font-black opacity-40">Staff Call</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleCallWaiter('Water')} className="rounded-xl font-bold">Glass of Water</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCallWaiter('Cleaning')} className="rounded-xl font-bold">Clear Table</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleCallWaiter('Assistance')} className="rounded-xl font-bold">General Help</DropdownMenuItem>
                      </DropdownMenuContent>
                  </DropdownMenu>
              )}
              {cartItems.length > 0 && (
                  <Button onClick={handlePlaceOrder} className="h-14 flex-1 rounded-2xl shadow-2xl text-xs font-black uppercase tracking-widest border-2 border-white/20" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>
                      {isAdding ? <Loader2 className="animate-spin h-5 w-5"/> : <PlusCircle className="mr-2 h-5 w-5" />}
                      {tableNumber === 'Counter' ? `Bill (${cartItems.length})` : `Place Order (${cartItems.length})`}
                  </Button>
              )}
              {(activeItemCount > 0 || cartItems.length > 0 || (historyOrders && historyOrders.length > 0)) && (
                  <Sheet open={isLiveBillOpen} onOpenChange={setIsLiveBillOpen}>
                      <SheetTrigger asChild>
                          <Button variant="outline" className={cn("h-14 rounded-2xl shadow-2xl text-[10px] font-black uppercase tracking-widest border-4", (cartItems.length === 0 || tableNumber === 'Counter') ? "flex-1" : "px-5")} style={{ borderColor: theme?.primaryColor || '#FBC02D', color: theme?.primaryColor || '#FBC02D', backgroundColor: '#ffffff' }}>
                              <Receipt className={cn(cartItems.length === 0 && "mr-2", "h-5 w-5")} /> 
                              {(cartItems.length === 0 || tableNumber === 'Counter') && "Live Bill"}
                              {activeItemCount > 0 && <Badge className="ml-2 h-6 min-w-[24px] rounded-lg text-xs font-black" style={{ backgroundColor: theme?.primaryColor || '#FBC02D', color: theme?.backgroundColor || '#1A1616' }}>{activeItemCount}</Badge>}
                          </Button>
                      </SheetTrigger>
                      <SheetContent side="bottom" className="h-[85vh] rounded-t-[3rem] p-0 border-0 overflow-hidden shadow-2xl">
                          <LiveBillSheet 
                            sessionId={sessionId} 
                            theme={theme} 
                            store={store} 
                            onShowUpi={() => setIsUpiDialogOpen(true)} 
                            isSalon={isSalon} 
                            placedOrders={placedOrders || []} 
                            historyOrders={historyOrders || []}
                            isLoadingOrders={ordersLoading} 
                            onFinalizeBill={handleFinalizeBill}
                          />
                      </SheetContent>
                  </Sheet>
              )}
          </div>
        </div>
    </>
  );
}
