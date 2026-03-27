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
} from 'firebase/firestore';

import type {
  Store,
  Menu,
  MenuItem,
  Order,
  GetIngredientsOutput,
  Booking
} from '@/lib/types';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, Suspense } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';

import {
  Receipt,
  Loader2,
  Clock,
  Download,
  Trash2,
  Sparkles,
  CalendarCheck,
  RefreshCw,
  LogIn
} from 'lucide-react';

import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { getIngredientsForDish } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import IngredientsDialog from '@/components/IngredientsDialog';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import { BookingSheet } from '@/components/features/booking-sheet';
import Link from 'next/link';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

function LiveBillSheet({ 
    isSalon,
    placedOrders,
    isLoadingOrders,
    onFinalizeBill,
    customerBookings,
    user
}: { 
    isSalon: boolean;
    placedOrders: Order[];
    isLoadingOrders: boolean;
    onFinalizeBill: () => void;
    customerBookings?: Booking[];
    user: any;
}) {
  const { cartItems, removeItem, cartTotal } = useCart();
  
  if (!user) {
      return (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-6 bg-[#FDFCF7]">
              <div className="h-20 w-20 rounded-3xl bg-primary/10 flex items-center justify-center text-primary">
                  <LogIn className="h-10 w-10" />
              </div>
              <div className="space-y-2">
                  <h3 className="text-xl font-black uppercase tracking-tight">Identity Required</h3>
                  <div className="text-sm font-bold text-gray-500 uppercase tracking-widest opacity-60 leading-relaxed">
                      Please sign in to view your live orders and active beauty sessions.
                  </div>
              </div>
              <Button asChild className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl">
                  <Link href="/login">Log in to Hub</Link>
              </Button>
          </div>
      );
  }

  if (isSalon) {
      return (
          <div className="flex flex-col h-full bg-[#FDFCF7]">
              <div className='p-5 border-b bg-white'>
                  <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight text-gray-950">
                      <CalendarCheck className="h-5 w-5 text-primary" /> My Beauty Sessions
                  </h2>
              </div>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {customerBookings && customerBookings.length > 0 ? (
                      customerBookings.map(b => (
                          <Card key={b.id} className="p-4 rounded-[2rem] border-2 bg-white shadow-md flex justify-between items-center group active:scale-95 transition-all">
                              <div className="min-w-0">
                                  <div className="text-[10px] font-black uppercase text-primary tracking-widest truncate">{b.serviceName}</div>
                                  <div className="text-xs font-bold text-gray-900 mt-0.5">{format(new Date(b.date), 'dd MMM')} • {b.time}</div>
                              </div>
                              <Badge className={cn(
                                  "rounded-md font-black uppercase text-[8px] tracking-widest px-2 py-0.5 border-0 shadow-sm",
                                  b.status === 'Completed' ? 'bg-green-500 text-white' : 
                                  b.status === 'Booked' ? 'bg-blue-500 text-white' : 
                                  b.status === 'In Progress' ? 'bg-amber-500 text-white animate-pulse' : 'bg-gray-400 text-white'
                              )}>{b.status}</Badge>
                          </Card>
                      ))
                  ) : (
                      <div className="py-20 text-center opacity-30 flex flex-col items-center">
                          <Clock className="h-12 w-12 mb-4 opacity-20" />
                          <div className="font-black uppercase text-[10px] tracking-[0.2em]">No active bookings</div>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  const placedTotal = useMemo(() => placedOrders.reduce((acc, order) => acc + order.totalAmount, 0), [placedOrders]);
  const sessionTotal = placedTotal + cartTotal;
  const isFinalized = placedOrders.length > 0 && placedOrders.every(o => ['Completed', 'Delivered'].includes(o.status));

  if (isLoadingOrders) return <div className="flex justify-center p-12 bg-white h-full"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>;
  
  return (
    <div className="flex flex-col h-full bg-[#FDFCF7]">
        <div className='p-5 border-b shrink-0 bg-white shadow-sm'>
            <h2 className="flex items-center gap-2 text-lg font-black uppercase tracking-tight text-gray-950">
                <Receipt className="h-5 w-5 text-primary" /> Live Order Progress
            </h2>
        </div>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-10 min-h-0">
             {placedOrders.length > 0 && (
                 <div className="space-y-6">
                    <div className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 px-1">
                        <Sparkles className="h-3 w-3" /> <span>Current Session</span>
                    </div>
                    <div className="space-y-4">
                        {placedOrders.map((order, idx) => (
                            <div key={order.id} className="space-y-3 p-5 rounded-[2.5rem] border-2 bg-white shadow-md">
                                <div className="flex justify-between items-center">
                                    <div className="text-[10px] font-black uppercase tracking-widest opacity-40">Batch #{idx + 1}</div>
                                    <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary">{order.status}</Badge>
                                </div>
                                <div className="space-y-2 pt-2 border-t border-dashed">
                                    {order.items.map((it, iIdx) => (
                                        <div key={iIdx} className="flex justify-between items-center text-[11px] font-bold text-gray-700">
                                            <span>{it.productName} <span className="opacity-40">x{it.quantity}</span></span>
                                            <span className="font-black text-gray-900">₹{it.price * it.quantity}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                 </div>
             )}

             {cartItems.length > 0 && (
                 <div className="space-y-3">
                    <div className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1">Current Selection</div>
                    <div className="p-5 rounded-[2.5rem] border-2 border-dashed bg-white space-y-3 shadow-inner">
                        {cartItems.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs font-bold text-gray-800">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => removeItem(it.variant.sku)} className="text-red-500 p-1.5 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"><Trash2 className="h-3.5 w-3.5" /></button>
                                    <span className="opacity-80 uppercase tracking-tight">{it.product.name} x{it.quantity}</span>
                                </div>
                                <span className="font-black text-primary">₹{(it.variant.price * it.quantity).toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                 </div>
             )}
        </div>

        <div className="p-6 border-t space-y-4 bg-white shrink-0 pb-10 shadow-[0_-10px_40_-15px_rgba(0,0,0,0.05)]">
            <div className="flex justify-between items-baseline mb-2 px-1">
                <span className="text-xs font-black uppercase tracking-widest opacity-40">Grand Total</span>
                <span className="text-3xl font-black text-gray-950 tracking-tighter">₹{sessionTotal.toFixed(0)}</span>
            </div>
            {placedOrders.length > 0 && !isFinalized && (
                <Button className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-red-500/20" variant="destructive" onClick={onFinalizeBill}>Finalize & Bill</Button>
            )}
        </div>
    </div>
  );
}

function ServiceCard({ item, onBook, onShowDetails }: { item: MenuItem, onBook: (item: MenuItem) => void, onShowDetails: (item: MenuItem) => void }) {
    const isOutOfStock = item.isAvailable === false;
    return (
        <Card className={cn("rounded-[2rem] border-0 shadow-lg overflow-hidden bg-white hover:shadow-2xl transition-all", isOutOfStock && "opacity-50 grayscale")}>
            <div className="p-3 flex items-center gap-3">
                <div className="relative h-20 w-20 rounded-[1.5rem] overflow-hidden border-4 border-black/5 bg-muted shrink-0 shadow-inner cursor-pointer active:scale-95 transition-transform" onClick={() => onShowDetails(item)}>
                    <Image src={item.imageUrl || ADIRES_LOGO} alt={item.name} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-[11px] uppercase tracking-tight text-gray-950 leading-tight mb-0.5 truncate">{item.name}</h3>
                    <div className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mb-1.5">{item.duration || 30} minutes</div>
                    <div className="text-lg font-black text-gray-900 tracking-tighter italic leading-none">₹{item.price.toFixed(0)}</div>
                </div>
                <Button 
                    onClick={() => onBook(item)} 
                    disabled={isOutOfStock}
                    className="h-10 rounded-xl px-4 font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all bg-primary text-white border-0"
                >
                    Book
                </Button>
            </div>
        </Card>
    );
}

function MenuContent() {
  const { storeId } = useParams<{ storeId: string }>();
  const searchParams = useSearchParams();
  const { firestore, user } = useFirebase(); 
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState(''); 
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isLiveBillOpen, setIsLiveBillOpen] = useState(false);
  const [tableNumber, setTableNumber] = useState<string | null>(null); 
  const [selectedItemForIngredients, setSelectedItemForIngredients] = useState<MenuItem | null>(null); 
  const [ingredientsData, setIngredientsData] = useState<GetIngredientsOutput | null>(null); 
  const [isFetchingIngredients, startFetchingIngredients] = useTransition(); 
  const [bookingService, setBookingService] = useState<MenuItem | null>(null);
  const { canInstall, triggerInstall } = useInstall();
  const { language, deviceId } = useAppStore();
  const { cartTotal, setSessionId, addItem } = useCart();
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => { setIsMounted(true); }, []);

  const storeRef = useMemoFirebase(() => firestore ? doc(firestore, 'stores', storeId) : null, [firestore, storeId]);
  const { data: store, isLoading: storeLoading } = useDoc<Store>(storeRef);

  const menuQuery = useMemoFirebase(() => firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null, [firestore, storeId]);
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);
  const menu = menus?.[0];

  useEffect(() => {
      const table = searchParams.get('table');
      if (table) setTableNumber(table);
  }, [searchParams]);

  const stableSessionId = useMemo(() => {
    if (!deviceId || deviceId === 'server' || !isMounted) return 'loading';
    const dS = format(new Date(), 'yyyy-MM-dd');
    return tableNumber ? `table-${tableNumber}-${dS}-${storeId}` : `home-${deviceId}-${dS}-${storeId}`;
  }, [tableNumber, storeId, deviceId, isMounted]);

  useEffect(() => {
      if (stableSessionId !== 'loading' && isMounted) {
          setSessionId(stableSessionId);
      }
  }, [stableSessionId, setSessionId, isMounted]);

  // Query only if signed in to prevent rules crash during hydration
  const ordersQuery = useMemoFirebase(() => 
    (isMounted && firestore && user && stableSessionId !== 'loading' 
        ? query(collection(firestore, 'orders'), where('sessionId', '==', stableSessionId), where('isActive', '==', true)) 
        : null
    ), [firestore, stableSessionId, isMounted, user]);
  const { data: placedOrders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

  const bookingsQuery = useMemoFirebase(() => {
      if (!isMounted || !firestore || !storeId || !user) return null;
      return query(collection(firestore, 'bookings'), where('storeId', '==', storeId), where('userId', '==', user.uid), orderBy('date', 'desc'), limit(10));
  }, [isMounted, firestore, storeId, user]);

  const { data: customerBookings, isLoading: bookingsLoading } = useCollection<Booking>(bookingsQuery);

  const isSalon = useMemo(() => !!(store?.businessType === 'salon'), [store]);
  const availableCategories = useMemo(() => {
      if (!menu?.items) return [];
      const cats = Array.from(new Set(menu.items.map(i => i.category))).sort();
      return ['All', ...cats];
  }, [menu]);
  
  useEffect(() => { if (!selectedCategory && availableCategories.length > 0) setSelectedCategory('All'); }, [availableCategories, selectedCategory]);

  const groupedMenu = useMemo(() => {
    if (!menu?.items) return {};
    let filtered = menu.items.filter(i => i.name.toLowerCase().includes(searchTerm.toLowerCase()));
    if (selectedCategory && selectedCategory !== 'All') filtered = filtered.filter(i => i.category === selectedCategory);
    return filtered.reduce((acc, i) => { const c = i.category || 'Other'; if(!acc[c]) acc[c] = []; acc[c].push(i); return acc; }, {} as Record<string, MenuItem[]>);
  }, [menu, searchTerm, selectedCategory]);

  const handleShowIngredients = (item: MenuItem) => {
    setIngredientsData(null); setSelectedItemForIngredients(item);
    startFetchingIngredients(async () => {
      const res = await getIngredientsForDish({ dishName: item.name, language: (language || 'en') as 'en' | 'te' });
      if (res && res.isSuccess) setIngredientsData(res);
    });
  };

  const handleAddToCart = (item: MenuItem, customs: any) => {
      const product = { 
          id: item.id, 
          name: item.name, 
          storeId, 
          imageId: 'cat-restaurant', 
          isMenuItem: true,
          imageUrl: item.imageUrl,
          price: item.price,
          description: item.description || ''
      };
      
      const variant = { sku: `${item.id}-default`, weight: '1 pc', price: item.price, stock: 999 };
      addItem(product, variant, 1, tableNumber || undefined, stableSessionId, customs);
  };

  if (!isMounted || storeLoading || menuLoading) return <div className="p-12 flex items-center justify-center bg-[#FDFCF7] min-h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>;
  if (!store) return <div className="p-12 text-center bg-[#FDFCF7] min-h-screen text-gray-900 font-black uppercase tracking-widest text-xs">Store Profile Not Found</div>;

  return (
    <>
      {selectedItemForIngredients && (
        <IngredientsDialog 
            open={!!selectedItemForIngredients} onClose={() => setSelectedItemForIngredients(null)} item={selectedItemForIngredients} 
            isLoading={isFetchingIngredients} ingredients={(ingredientsData?.components as any) || []} recommendations={[]} 
            itemType={ingredientsData?.itemType} onAdd={(customs) => { setSelectedItemForIngredients(null); if(isSalon) setBookingService(selectedItemForIngredients); else handleAddToCart(selectedItemForIngredients, customs); }} onShowRecommendation={(rec) => { setSelectedItemForIngredients(rec); handleShowIngredients(rec); }} 
        />
      )}
      
      {bookingService && (
          <Sheet open={!!bookingService} onOpenChange={() => setBookingService(null)}>
              <BookingSheet store={store} service={bookingService} onComplete={() => setBookingService(null)} />
          </Sheet>
      )}
      
      <div className="min-h-screen pb-40 bg-[#FDFCF7]">
          <header className="sticky top-0 z-50 bg-[#FDFCF7]/90 backdrop-blur-xl px-5 pt-4 pb-2 border-b border-black/5">
              <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex justify-between items-center">
                      <div className="flex items-center gap-3">
                          <div className="relative h-9 w-9 rounded-full overflow-hidden border-2 border-primary shadow-sm bg-white">
                              <Image src={store.imageUrl || ADIRES_LOGO} alt={store.name} fill className="object-cover" />
                          </div>
                          <div className="min-w-0">
                              <div className="font-black text-xs uppercase tracking-tight text-gray-950 truncate leading-none max-w-[150px]">{store.name}</div>
                              <div className="text-[7px] font-black uppercase tracking-widest text-primary opacity-60 mt-1">{isSalon ? 'Verified Salon' : 'Verified Hub'}</div>
                          </div>
                      </div>
                      {canInstall && (
                        <button onClick={triggerInstall} className="h-8 px-3 rounded-full bg-white shadow-sm border border-black/5 active:scale-90 transition-all font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5 text-gray-950">
                            <Download className="h-3 w-3 text-primary" /> Install
                        </button>
                      )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
                      {availableCategories.map(cat => (
                          <button key={cat} onClick={() => setSelectedCategory(cat)} className={cn("px-4 h-9 rounded-full font-black text-[9px] uppercase tracking-widest transition-all shrink-0 border-2", selectedCategory === cat ? "bg-primary border-primary text-white scale-105 shadow-lg" : "bg-white border-black/5 text-gray-500")}>
                              {cat}
                          </button>
                      ))}
                  </div>
              </div>
          </header>

          <div className="container mx-auto px-5 max-w-2xl mt-6 space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-700">
                {Object.entries(groupedMenu).map(([category, items]) => (
                    <section key={category} className="space-y-3">
                        <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400 px-1">{category}</h2>
                        <div className="grid grid-cols-1 gap-3">
                            {items.map((item) => (
                                isSalon ? (
                                    <ServiceCard key={item.id} item={item} onBook={setBookingService} onShowDetails={handleShowIngredients} />
                                ) : (
                                    <Card key={item.id} className="p-4 rounded-[2rem] border-0 shadow-lg bg-white flex justify-between items-center group active:scale-[0.98] transition-all">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative h-16 w-16 rounded-2xl overflow-hidden border-2 bg-muted shrink-0 shadow-inner">
                                                <Image src={item.imageUrl || ADIRES_LOGO} alt={item.name} fill className="object-cover" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="font-black text-[11px] uppercase tracking-tight text-gray-950 truncate leading-tight">{item.name}</div>
                                                <div className="font-black text-primary text-sm mt-0.5 italic">₹{item.price.toFixed(0)}</div>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" className="rounded-xl font-black text-[9px] uppercase h-9 px-4 border-2 shrink-0 bg-white" onClick={() => handleShowIngredients(item)}>View</Button>
                                    </Card>
                                )
                            ))}
                        </div>
                    </section>
                ))}
          </div>

          <div className="fixed bottom-6 left-0 right-0 z-50 px-5">
              <div className="max-w-md mx-auto">
                  <div className="bg-[#FDD835] rounded-full h-14 flex items-center justify-between pl-6 pr-1.5 shadow-2xl border-4 border-white ring-1 ring-black/5 animate-in slide-in-from-bottom-10 duration-500">
                      <div className="flex items-center gap-3">
                          <div className="text-sm font-black text-gray-950 leading-none uppercase tracking-tighter flex items-center">
                              {isSalon ? (
                                  <div className="flex items-center gap-2">
                                      {bookingsLoading ? (
                                          <div className="flex items-center gap-2"><span>Syncing</span> <span className="h-3.5 w-3.5 flex items-center justify-center"><RefreshCw className="h-3.5 w-3.5 animate-spin opacity-40" /></span></div>
                                      ) : (
                                          <span>{customerBookings?.length || 0} Sessions Active</span>
                                      )}
                                  </div>
                              ) : <span>₹{cartTotal.toFixed(0)} Manifested</span>}
                          </div>
                      </div>
                      <Sheet open={isLiveBillOpen} onOpenChange={setIsLiveBillOpen}>
                          <SheetTrigger asChild>
                              <Button className="h-10 rounded-full bg-gray-950 text-white font-black uppercase text-[9px] tracking-widest px-6 shadow-xl hover:bg-gray-900 transition-colors">
                                  {isSalon ? 'My Sessions' : 'Finalize'}
                              </Button>
                          </SheetTrigger>
                          <SheetContent side="bottom" className="h-[85vh] rounded-t-[3.5rem] p-0 border-0 overflow-hidden shadow-2xl ring-1 ring-black/5">
                              <LiveBillSheet isSalon={isSalon} placedOrders={placedOrders || []} isLoadingOrders={ordersLoading} onFinalizeBill={() => {}} customerBookings={customerBookings ?? []} user={user}/>
                          </SheetContent>
                      </Sheet>
                  </div>
              </div>
          </div>
      </div>
    </>
  );
}

export default function PublicMenuPage() {
    return (
        <Suspense fallback={<div className="p-12 flex items-center justify-center min-h-screen bg-[#FDFCF7]"><Loader2 className="animate-spin h-8 w-8 text-primary opacity-20" /></div>}>
            <MenuContent />
        </Suspense>
    );
}
