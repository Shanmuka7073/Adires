
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
  serverTimestamp,
  updateDoc,
  writeBatch,
  setDoc,
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
  X,
  ShoppingBag,
  History,
  Trash2,
  ChevronDown,
  Pizza,
  CupSoda,
  Star,
  ArrowRight
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
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getIngredientsForDish } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import IngredientsDialog from '@/components/IngredientsDialog';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
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

const getCategoryIcon = (category: string) => {
    const c = category.toLowerCase();
    if (c.includes('pizza')) return <Pizza className="h-3.5 w-3.5" />;
    if (c.includes('drink') || c.includes('beverage')) return <CupSoda className="h-3.5 w-3.5" />;
    if (c.includes('starter') || c.includes('appetizer')) return <Star className="h-3.5 w-3.5" />;
    return <Utensils className="h-3.5 w-3.5" />;
};

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

function LiveBillSheet({ 
    theme, 
    isSalon,
    placedOrders,
    historyOrders,
    isLoadingOrders,
    onFinalizeBill 
}: { 
    sessionId: string; 
    theme: MenuTheme | undefined; 
    store: Store; 
    isSalon: boolean;
    placedOrders: Order[];
    historyOrders: Order[];
    isLoadingOrders: boolean;
    onFinalizeBill: () => void;
}) {
  const { cartItems, removeItem, cartTotal } = useCart();
  
  const placedTotal = useMemo(() => placedOrders.reduce((acc, order) => acc + order.totalAmount, 0), [placedOrders]);
  const sessionTotal = placedTotal + cartTotal;
  
  const isFinalized = placedOrders.length > 0 && placedOrders.every(o => ['Completed', 'Delivered'].includes(o.status));

  if (isLoadingOrders) return <div className="flex justify-center p-12 bg-white"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  
  return (
    <div className="flex flex-col h-full bg-[#FDFCF7]">
        <SheetHeader className='p-5 border-b shrink-0 bg-white'>
            <SheetTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight text-gray-950">
                <Receipt className="h-5 w-5 text-primary" /> {isSalon ? 'Visit Progress' : 'Live Order Progress'}
            </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-10 min-h-0">
             {/* CURRENT ACTIVE ORDERS */}
             {placedOrders.length > 0 && (
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 px-1">
                        <Sparkles className="h-3 w-3" /> Current Session
                    </h4>
                    {placedOrders.sort((a,b) => toDateSafe(a.orderDate).getTime() - toDateSafe(b.orderDate).getTime()).map((order, idx) => (
                        <div key={order.id} className="space-y-3 p-5 rounded-[2.5rem] border-2 bg-white shadow-md">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Batch #{idx + 1}</h4>
                                <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary">{order.status}</Badge>
                            </div>
                            
                            <OrderStatusTimeline status={order.status} />

                            <div className="space-y-2 pt-2 border-t border-dashed">
                                {order.items.map((it, iIdx) => (
                                    <div key={iIdx} className="flex justify-between items-center text-[11px] font-bold text-gray-700">
                                        <span>{it.productName} x{it.quantity}</span>
                                        <span className="font-black">₹{it.price * it.quantity}</span>
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
                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1">Selection (Ready to Send)</h4>
                    <div className="p-5 rounded-[2.5rem] border-2 border-dashed bg-white space-y-3 shadow-inner">
                        {cartItems.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs font-bold text-gray-800">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => removeItem(it.variant.sku)} className="text-red-500 hover:text-red-400 p-1.5 bg-red-50 rounded-lg">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </button>
                                    <span className="opacity-80 uppercase tracking-tight">{it.product.name} x{it.quantity}</span>
                                </div>
                                <span className="font-black text-primary">₹{(it.variant.price * it.quantity).toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                 </div>
             )}

             {/* ORDER HISTORY */}
             {historyOrders.length > 0 && (
                 <div className="space-y-4 pt-4 border-t border-black/5">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 px-1">
                        <History className="h-3 w-3" /> Visit History
                    </h4>
                    <div className="space-y-2">
                        {historyOrders.map((order) => (
                            <div key={order.id} className="p-4 rounded-2xl bg-white border-2 border-black/5 flex justify-between items-center text-[10px]">
                                <div>
                                    <p className="font-black text-gray-900">{format(toDateSafe(order.orderDate), 'dd MMM yyyy')}</p>
                                    <p className="opacity-40 font-bold uppercase">{order.items.length} items</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-black text-primary">₹{order.totalAmount.toFixed(0)}</p>
                                    <Badge className="text-[7px] font-black uppercase h-4 px-1 bg-green-50 text-green-600 border-green-100">Success</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
             )}
        </div>

        <div className="p-6 border-t space-y-4 bg-white shrink-0 pb-10 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-baseline mb-2 px-1">
                <span className="text-xs font-black uppercase tracking-widest opacity-40">Running Session Total</span>
                <span className="text-3xl font-black text-gray-950 tracking-tighter italic">₹{sessionTotal.toFixed(2)}</span>
            </div>
            
            <div className="pt-2">
              {isFinalized ? (
                 <div className="text-center p-6 bg-green-50 rounded-[2.5rem] border-2 border-green-100 shadow-inner">
                    <CheckCircle className="mx-auto h-8 w-8 mb-2 text-green-600" />
                    <p className="font-black text-[10px] uppercase tracking-widest text-green-800">Visit Completed</p>
                </div>
              ) : placedOrders.length > 0 ? (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button className="w-full h-14 rounded-2xl text-sm font-black uppercase tracking-widest shadow-xl shadow-primary/20" variant="destructive">Finalize Bill & Pay</Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-[2.5rem] border-0 shadow-2xl">
                        <AlertDialogHeader><AlertDialogTitle className="font-black uppercase">Close Session?</AlertDialogTitle><AlertDialogDescription className="font-bold">This will notify the staff that you are ready to pay your bill of ₹{sessionTotal.toFixed(0)}.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter className="gap-2"><AlertDialogCancel className="rounded-xl font-bold">Back</AlertDialogCancel><AlertDialogAction onClick={onFinalizeBill} className="rounded-xl font-bold bg-primary text-white">Yes, Finalize</AlertDialogAction></AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
              ) : null}
            </div>
        </div>
    </div>
  );
}

function MenuCard({ item, onAdd, onShowDetails, theme, currentQtyInCart }: { item: MenuItem, onAdd: (item: MenuItem, qty: number) => void, onShowDetails: (item: MenuItem) => void, theme: MenuTheme | undefined, currentQtyInCart: number }) {
    const isOutOfStock = item.isAvailable === false;
    
    return (
        <Card className={cn(
            "rounded-[2.5rem] border-0 shadow-lg overflow-hidden bg-white hover:shadow-2xl transition-all duration-500",
            isOutOfStock && "opacity-50 grayscale"
        )}>
            <div className="p-4 flex items-center gap-4">
                <div className="relative h-24 w-24 rounded-full overflow-hidden border-4 border-black/5 bg-muted shrink-0 shadow-inner cursor-pointer" onClick={() => onShowDetails(item)}>
                    <Image src={item.imageUrl || ADIRES_LOGO} alt={item.name} fill className="object-cover" />
                </div>
                
                <div className="flex-1 min-w-0 py-1">
                    <h3 className="font-black text-sm uppercase tracking-tight text-gray-950 leading-tight mb-1">{item.name}</h3>
                    <p className="text-xl font-black text-gray-900 tracking-tighter italic">₹{item.price.toFixed(0)}</p>
                </div>

                <div className="flex items-center gap-2 bg-black/5 p-1 rounded-full shadow-inner border border-black/5">
                    {currentQtyInCart > 0 && (
                        <>
                            <button 
                                onClick={() => onAdd(item, currentQtyInCart - 1)}
                                className="h-8 w-8 rounded-full bg-white flex items-center justify-center text-gray-400 hover:text-gray-900 shadow-sm active:scale-90 transition-all"
                            >
                                <Minus className="h-4 w-4" />
                            </button>
                            <span className="w-4 text-center font-black text-xs text-gray-950">{currentQtyInCart}</span>
                        </>
                    )}
                    <button 
                        onClick={() => onAdd(item, currentQtyInCart + 1)}
                        disabled={isOutOfStock}
                        className={cn(
                            "h-8 w-8 rounded-full flex items-center justify-center shadow-md active:scale-90 transition-all",
                            currentQtyInCart > 0 ? "bg-white text-gray-900" : "bg-primary text-white"
                        )}
                        style={currentQtyInCart === 0 ? { backgroundColor: theme?.primaryColor } : {}}
                    >
                        <Plus className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </Card>
    );
}

// --- MAIN PAGE ---

export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const searchParams = useSearchParams(); 
  const { firestore } = useFirebase(); 
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSearchVisible, setSearchVisible] = useState(false);
  const [isLiveBillOpen, setIsLiveBillOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState<string | null>(null); 
  const [deliveryAddress, setDeliveryAddress] = useState(''); 
  const [customerName, setCustomerName] = useState(''); 
  const [phone, setPhone] = useState(''); 
  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number} | null>(null);
  const [selectedItemForIngredients, setSelectedItemForIngredients] = useState<MenuItem | null>(null); 
  const [ingredientsData, setIngredientsData] = useState<GetIngredientsOutput | null>(null); 
  const [isFetchingIngredients, startFetchingIngredients] = useTransition(); 
  const [isAdding, startAdding] = useTransition();
  const { canInstall, triggerInstall } = useInstall();
  const { isInitialized, fetchInitialData, setUserStore, language } = useAppStore();
  const { cartItems, addItem, clearCart, updateQuantity, cartTotal } = useCart();

  const { data: store, isLoading: storeLoading } = useDoc<Store>(useMemoFirebase(() => firestore ? doc(firestore, 'stores', storeId) : null, [firestore, storeId]));
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(useMemoFirebase(() => firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null, [firestore, storeId]));
  const menu = menus?.[0];

  useEffect(() => { if (store) setUserStore(store); }, [store, setUserStore]);

  const [deviceId, setDeviceId] = useState<string | null>(null);
  useEffect(() => {
      if (typeof window !== 'undefined') {
          let dId = localStorage.getItem(`device_id_${storeId}`);
          if (!dId) { dId = Math.random().toString(36).substring(2, 15); localStorage.setItem(`device_id_${storeId}`, dId); }
          setDeviceId(dId);
      }
  }, [storeId]);

  const sessionId = useMemo(() => {
    if (!deviceId) return 'loading';
    const dS = `${new Date().getFullYear()}-${new Date().getMonth() + 1}-${new Date().getDate()}`;
    if (tableNumber === 'Counter') return `counter-${Date.now()}-${storeId}`; 
    if (tableNumber) return `table-${tableNumber}-${dS}-${storeId}`;
    return `home-${deviceId}-${dS}`;
  }, [tableNumber, storeId, deviceId]);

  const ordersQuery = useMemoFirebase(() => (firestore && deviceId ? query(collection(firestore, 'orders'), where('sessionId', '==', sessionId), where('isActive', '==', true)) : null), [firestore, sessionId, deviceId]);
  const { data: placedOrders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

  const historyQuery = useMemoFirebase(() => {
      if (!firestore || !deviceId) return null;
      return query(collection(firestore, 'orders'), where('storeId', '==', storeId), where('deviceId', '==', deviceId), where('isActive', '==', false), orderBy('orderDate', 'desc'), limit(5));
  }, [firestore, storeId, deviceId]);
  const { data: historyOrders } = useCollection<Order>(historyQuery);

  const activeItemCount = useMemo(() => (placedOrders?.reduce((acc, o) => acc + o.items.length, 0) || 0) + cartItems.length, [placedOrders, cartItems]);
  const isSalon = useMemo(() => !!(store?.businessType === 'salon' || store?.name.toLowerCase().includes('salon')), [store]);
  const availableCategories = useMemo(() => menu?.items ? Array.from(new Set(menu.items.map(i => i.category))).sort() : [], [menu]);
  
  useEffect(() => { if (!selectedCategory && availableCategories.length > 0) setSelectedCategory(availableCategories[0]); }, [availableCategories, selectedCategory]);

  const groupedMenu = useMemo(() => {
    if (!menu?.items) return {};
    let filtered = menu.items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (selectedCategory) filtered = filtered.filter(i => i.category === selectedCategory);
    return filtered.reduce((acc, i) => { const c = i.category || 'Other'; if(!acc[c]) acc[c] = []; acc[c].push(i); return acc; }, {} as Record<string, MenuItem[]>);
  }, [menu, searchTerm, selectedCategory]);

  useEffect(() => { if (firestore && !isInitialized) fetchInitialData(firestore); }, [firestore, isInitialized, fetchInitialData]);

  useEffect(() => {
    const urlTable = searchParams.get('table'); if (urlTable) setTableNumber(urlTable);
    if (typeof window !== 'undefined') {
        const sA = localStorage.getItem(`last_address_${storeId}`); const sN = localStorage.getItem(`last_name_${storeId}`); const sP = localStorage.getItem(`last_phone_${storeId}`);
        if (sA) setDeliveryAddress(sA); if (sN) setCustomerName(sN); if (sP) setPhone(sP);
    }
  }, [searchParams, storeId]);

  const handleAddItem = (item: MenuItem, qty: number = 1) => {
    const product: Product = { id: item.id, storeId: storeId, name: item.name, description: item.description || '', imageId: 'cat-restaurant', isMenuItem: true, price: item.price, imageUrl: (item as any).imageUrl };
    const variant: ProductVariant = { sku: `${item.id}-default`, weight: '1 pc', price: item.price, stock: 999 };
    
    if (qty === 0) {
        const existing = cartItems.find(i => i.product.id === item.id);
        if (existing) updateQuantity(existing.variant.sku, 0);
    } else {
        const existing = cartItems.find(i => i.product.id === item.id);
        if (existing) updateQuantity(existing.variant.sku, qty);
        else addItem(product, variant, qty, tableNumber || undefined, sessionId);
    }
  };

  const handlePlaceOrder = () => {
    if (!firestore) return;
    startAdding(async () => {
        const isCounter = tableNumber === 'Counter';
        const orderId = doc(collection(firestore, 'orders')).id;
        const orderRef = doc(firestore, 'orders', orderId);
        const orderItems: OrderItem[] = cartItems.map(item => ({ id: crypto.randomUUID(), orderId: orderId, productId: item.product.id, menuItemId: item.product.id, productName: item.product.name, variantSku: item.variant.sku, variantWeight: item.variant.weight, quantity: item.quantity, price: item.variant.price }));
        const totalAmount = orderItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
        const orderData = { id: orderId, storeId: storeId, tableNumber: tableNumber ? String(tableNumber) : null, sessionId: sessionId, deviceId: deviceId, userId: 'guest', customerName: customerName || (tableNumber === 'Counter' ? 'Walk-in Guest' : (tableNumber ? `Table ${tableNumber}` : 'Guest')), deliveryAddress: deliveryAddress || (tableNumber ? 'In-store dining' : 'TBD'), deliveryLat: deliveryCoords?.lat || 0, deliveryLng: deliveryCoords?.lng || 0, phone: phone || '', status: isCounter ? 'Billed' : 'Pending', orderType: tableNumber === 'Counter' ? 'counter' : (tableNumber ? 'dine-in' : 'delivery'), isActive: true, orderDate: serverTimestamp(), updatedAt: serverTimestamp(), items: orderItems, totalAmount: totalAmount };
        setDoc(orderRef, orderData).catch(async (e) => { errorEmitter.emit('permission-error', new FirestorePermissionError({ path: orderRef.path, operation: 'create' as const, requestResourceData: orderData })); });
        toast({ title: isCounter ? 'Bill Generated!' : 'Sent to Kitchen!' }); 
        clearCart(); 
        if(isCounter) handleStartNewOrder(); 
    });
  };

  const handleFinalizeBill = () => { 
    if (!firestore || !placedOrders?.length) return;
    const batch = writeBatch(firestore);
    placedOrders.forEach(order => { batch.update(doc(firestore, 'orders', order.id), { status: 'Billed', updatedAt: serverTimestamp() }); });
    batch.commit().catch(e => toast({ variant: 'destructive', title: 'Action Failed' }));
    toast({ title: 'Bill Requested' });
  };

  const handleShowIngredients = (item: MenuItem) => {
    setIngredientsData(null); setSelectedItemForIngredients(item);
    startFetchingIngredients(async () => {
      const res = await getIngredientsForDish({ dishName: item.name, language: (language || 'en') as 'en' | 'te' });
      if (res && res.isSuccess) setIngredientsData(res);
    });
  };

  const handleStartNewOrder = () => { if (typeof window !== 'undefined') window.location.reload(); };

  if (storeLoading || menuLoading || ordersLoading) return <div className="p-12 flex items-center justify-center bg-[#FDFCF7] min-h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!store) return <div className="p-12 text-center bg-[#FDFCF7] min-h-screen text-gray-900">Store not found.</div>;

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
            recommendations={[]} 
            itemType={ingredientsData?.itemType} 
            onAdd={(customs) => { handleAddItem(selectedItemForIngredients, 1); setSelectedItemForIngredients(null); }} 
            onShowRecommendation={(rec) => { setSelectedItemForIngredients(rec); handleShowIngredients(rec); }} 
        />
      )}
      
      <div className="min-h-screen pb-40 bg-[#FDFCF7] font-body">
          <header className="sticky top-0 z-50 bg-[#FDFCF7]/90 backdrop-blur-xl px-5 pt-6 pb-4">
              <div className="max-w-2xl mx-auto space-y-6">
                  <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="relative h-10 w-10 rounded-full overflow-hidden border-2 border-primary shadow-sm">
                              <Image src={store.imageUrl || ADIRES_LOGO} alt={store.name} fill className="object-cover" />
                          </div>
                          <div>
                              <div className="flex items-center gap-1.5">
                                  <h1 className="font-black text-sm uppercase tracking-tight text-gray-950 truncate leading-none">
                                      {customerName || (tableNumber ? `TABLE ${tableNumber}` : 'WELCOME')}
                                  </h1>
                                  <ChevronDown className="h-3 w-3 text-primary" />
                              </div>
                              <p className="text-[8px] font-black uppercase tracking-widest text-primary opacity-60 mt-1">{store.name}</p>
                          </div>
                      </div>
                      <div className="flex items-center gap-2">
                          <button 
                            onClick={() => setSearchVisible(!isSearchVisible)}
                            className="h-10 w-10 rounded-full bg-white shadow-md flex items-center justify-center border border-black/5 active:scale-90 transition-all"
                          >
                              {isSearchVisible ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
                          </button>
                          {canInstall && (
                            <button 
                                onClick={triggerInstall}
                                className="h-10 px-4 rounded-full bg-white shadow-md flex items-center gap-2 border border-black/5 active:scale-90 transition-all font-black text-[9px] uppercase tracking-widest"
                            >
                                <Download className="h-3.5 w-3.5 text-primary" /> Install
                            </button>
                          )}
                      </div>
                  </div>

                  {isSearchVisible && (
                      <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                          <Input 
                              autoFocus
                              placeholder="Search your favorite dishes..." 
                              value={searchTerm} 
                              onChange={e => setSearchTerm(e.target.value)}
                              className="h-12 rounded-2xl border-2 border-gray-950 bg-white text-xs font-bold shadow-lg"
                          />
                      </div>
                  )}

                  <div className="flex gap-2.5 overflow-x-auto no-scrollbar py-1">
                      {availableCategories.map(cat => {
                          const isActive = selectedCategory === cat;
                          return (
                              <button 
                                  key={cat} 
                                  onClick={() => setSelectedCategory(cat)}
                                  className={cn(
                                      "px-5 h-11 rounded-full font-black text-[10px] uppercase tracking-widest transition-all shrink-0 flex items-center gap-2 shadow-sm border",
                                      isActive ? "bg-[#B22222] border-[#B22222] text-white shadow-lg scale-105" : "bg-white border-black/5 text-gray-500"
                                  )}
                              >
                                  {getCategoryIcon(cat)}
                                  {cat}
                              </button>
                          );
                      })}
                  </div>
              </div>
          </header>

          <div className="container mx-auto px-5 max-w-2xl mt-4">
              {isSessionFinalized ? (
                  <Card className="rounded-[3rem] border-0 shadow-2xl text-center py-20 px-8 bg-white">
                      <div className="mx-auto h-24 w-24 flex items-center justify-center rounded-full mb-8 bg-green-50 border-4 border-green-100 shadow-inner"><CheckCircle className="h-12 w-12 text-green-600" /></div>
                      <h2 className="text-3xl font-black mb-4 text-gray-950 tracking-tight uppercase italic">Visit Completed</h2>
                      <p className="text-sm font-bold text-gray-500 mb-8 uppercase tracking-widest opacity-60">Thank you for dining with us!</p>
                      <Button onClick={handleStartNewOrder} className="rounded-2xl h-14 w-full uppercase font-black text-xs tracking-[0.2em] shadow-2xl bg-primary">Start New Session</Button>
                  </Card>
              ) : (
                <div className="space-y-10">
                    {Object.keys(groupedMenu).length > 0 ? (
                        Object.entries(groupedMenu).map(([category, items]) => (
                            <section key={category} className="space-y-4">
                                <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 px-1">{category}</h2>
                                <div className="grid grid-cols-1 gap-4">
                                    {items.map((item) => {
                                        const cartItem = cartItems.find(i => i.product.id === item.id);
                                        return (
                                            <MenuCard 
                                                key={item.id} 
                                                item={item} 
                                                onAdd={handleAddItem} 
                                                onShowDetails={handleShowIngredients} 
                                                theme={theme} 
                                                currentQtyInCart={cartItem?.quantity || 0}
                                            />
                                        );
                                    })}
                                </div>
                            </section>
                        ))
                    ) : (
                        <div className="text-center py-32 opacity-20"><Utensils className="h-12 w-12 mx-auto mb-4" /><p className="text-[10px] font-black uppercase tracking-widest">No dishes found</p></div>
                    )}
                </div>
              )}
          </div>

          {(activeItemCount > 0 || cartItems.length > 0) && !isSessionFinalized && (
              <div className="fixed bottom-8 left-0 right-0 z-50 px-5">
                  <div className="max-w-md mx-auto">
                      <div className="bg-[#FDD835] rounded-full h-16 flex items-center justify-between pl-8 pr-2 shadow-[0_20px_50px_-15px_rgba(253,216,53,0.5)] border-4 border-white">
                          <div className="flex items-center gap-4">
                              <div className="flex flex-col">
                                  <span className="text-[9px] font-black uppercase tracking-tighter text-gray-900/60 leading-none">Your Selection</span>
                                  <p className="text-lg font-black text-gray-950 leading-none mt-1">
                                      {activeItemCount} items <span className="mx-1 text-gray-950/20">|</span> ₹{cartTotal.toFixed(0)}
                                  </p>
                              </div>
                          </div>
                          
                          <Sheet open={isLiveBillOpen} onOpenChange={setIsLiveBillOpen}>
                              <SheetTrigger asChild>
                                  <Button className="h-12 rounded-full bg-gray-950 text-white font-black uppercase text-[10px] tracking-widest px-6 shadow-lg active:scale-95 transition-all">
                                      View Cart <ArrowRight className="ml-2 h-4 w-4" />
                                  </Button>
                              </SheetTrigger>
                              <SheetContent side="bottom" className="h-[85vh] rounded-t-[3rem] p-0 border-0 overflow-hidden shadow-2xl">
                                  <LiveBillSheet 
                                      sessionId={sessionId} 
                                      theme={theme} 
                                      store={store} 
                                      isSalon={isSalon} 
                                      placedOrders={placedOrders || []} 
                                      historyOrders={historyOrders || []} 
                                      isLoadingOrders={ordersLoading} 
                                      onFinalizeBill={handleFinalizeBill}
                                  />
                              </SheetContent>
                          </Sheet>
                      </div>
                      
                      {cartItems.length > 0 && (
                          <div className="mt-3 animate-in slide-in-from-bottom-2">
                              <Button 
                                onClick={handlePlaceOrder}
                                className="w-full h-12 rounded-full bg-primary text-white font-black uppercase text-[10px] tracking-widest shadow-xl"
                              >
                                  {isAdding ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <PlusCircle className="h-4 w-4 mr-2" />}
                                  {tableNumber ? `Send to ${isSalon ? 'Chair' : 'Kitchen'}` : 'Confirm Order'}
                              </Button>
                          </div>
                      )}
                  </div>
              </div>
          )}
      </div>
    </>
  );
}
