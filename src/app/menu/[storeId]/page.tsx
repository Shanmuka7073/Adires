
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
import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';

import {
  Receipt,
  Loader2,
  Clock,
  Download,
  ShoppingBag,
  Trash2,
  Sparkles,
  CalendarCheck,
  X
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

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

function LiveBillSheet({ 
    isSalon,
    placedOrders,
    isLoadingOrders,
    onFinalizeBill,
    customerBookings
}: { 
    isSalon: boolean;
    placedOrders: Order[];
    historyOrders: Order[];
    isLoadingOrders: boolean;
    onFinalizeBill: () => void;
    customerBookings?: Booking[];
}) {
  const { cartItems, removeItem, cartTotal } = useCart();
  
  if (isSalon) {
      return (
          <div className="flex flex-col h-full bg-[#FDFCF7]">
              <SheetHeader className='p-5 border-b bg-white'>
                  <SheetTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight">
                      <CalendarCheck className="h-5 w-5 text-primary" /> My Beauty Sessions
                  </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                  {customerBookings && customerBookings.length > 0 ? (
                      customerBookings.map(b => (
                          <Card key={b.id} className="p-4 rounded-2xl border-2 bg-white shadow-sm flex justify-between items-center">
                              <div>
                                  <p className="text-[10px] font-black uppercase text-primary">{b.serviceName}</p>
                                  <p className="text-xs font-bold">{format(new Date(b.date), 'dd MMM')} • {b.time}</p>
                              </div>
                              <Badge className={cn(
                                  "text-[8px] font-black uppercase",
                                  b.status === 'Completed' ? 'bg-green-500' : 
                                  b.status === 'Booked' ? 'bg-blue-500' : 'bg-gray-400'
                              )}>{b.status}</Badge>
                          </Card>
                      ))
                  ) : (
                      <div className="py-20 text-center opacity-20">
                          <Clock className="h-12 w-12 mx-auto mb-4" />
                          <p className="font-black uppercase text-xs">No active bookings</p>
                      </div>
                  )}
              </div>
          </div>
      );
  }

  const placedTotal = useMemo(() => placedOrders.reduce((acc, order) => acc + order.totalAmount, 0), [placedOrders]);
  const sessionTotal = placedTotal + cartTotal;
  const isFinalized = placedOrders.length > 0 && placedOrders.every(o => ['Completed', 'Delivered'].includes(o.status));

  if (isLoadingOrders) return <div className="flex justify-center p-12 bg-white"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  
  return (
    <div className="flex flex-col h-full bg-[#FDFCF7]">
        <SheetHeader className='p-5 border-b shrink-0 bg-white'>
            <SheetTitle className="flex items-center gap-2 text-lg font-black uppercase tracking-tight text-gray-950">
                <Receipt className="h-5 w-5 text-primary" /> Live Order Progress
            </SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-y-auto p-5 space-y-10 min-h-0">
             {placedOrders.length > 0 && (
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 px-1">
                        <Sparkles className="h-3 w-3" /> Current Session
                    </h4>
                    {placedOrders.map((order, idx) => (
                        <div key={order.id} className="space-y-3 p-5 rounded-[2.5rem] border-2 bg-white shadow-md">
                            <div className="flex justify-between items-center">
                                <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40">Batch #{idx + 1}</h4>
                                <Badge variant="outline" className="text-[8px] font-black uppercase border-primary/20 text-primary">{order.status}</Badge>
                            </div>
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

             {cartItems.length > 0 && (
                 <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-widest opacity-40 px-1">Selection</h4>
                    <div className="p-5 rounded-[2.5rem] border-2 border-dashed bg-white space-y-3 shadow-inner">
                        {cartItems.map((it, idx) => (
                            <div key={idx} className="flex justify-between items-center text-xs font-bold text-gray-800">
                                <div className="flex items-center gap-3">
                                    <button onClick={() => removeItem(it.variant.sku)} className="text-red-500 p-1.5 bg-red-50 rounded-lg"><Trash2 className="h-3.5 w-3.5" /></button>
                                    <span className="opacity-80 uppercase tracking-tight">{it.product.name} x{it.quantity}</span>
                                </div>
                                <span className="font-black text-primary">₹{(it.variant.price * it.quantity).toFixed(0)}</span>
                            </div>
                        ))}
                    </div>
                 </div>
             )}
        </div>

        <div className="p-6 border-t space-y-4 bg-white shrink-0 pb-10">
            <div className="flex justify-between items-baseline mb-2 px-1">
                <span className="text-xs font-black uppercase tracking-widest opacity-40">Total</span>
                <span className="text-3xl font-black text-gray-950 tracking-tighter">₹{sessionTotal.toFixed(2)}</span>
            </div>
            {placedOrders.length > 0 && !isFinalized && (
                <Button className="w-full h-14 rounded-2xl" variant="destructive" onClick={onFinalizeBill}>Finalize Bill</Button>
            )}
        </div>
    </div>
  );
}

function ServiceCard({ item, onBook, onShowDetails }: { item: MenuItem, onBook: (item: MenuItem) => void, onShowDetails: (item: MenuItem) => void }) {
    const isOutOfStock = item.isAvailable === false;
    return (
        <Card className={cn("rounded-3xl border-0 shadow-lg overflow-hidden bg-white hover:shadow-2xl transition-all", isOutOfStock && "opacity-50 grayscale")}>
            <div className="p-3 flex items-center gap-3">
                <div className="relative h-20 w-20 rounded-[1.5rem] overflow-hidden border-4 border-black/5 bg-muted shrink-0 shadow-inner cursor-pointer" onClick={() => onShowDetails(item)}>
                    <Image src={item.imageUrl || ADIRES_LOGO} alt={item.name} fill className="object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-black text-[11px] uppercase tracking-tight text-gray-950 leading-tight mb-0.5">{item.name}</h3>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter mb-1.5">{item.duration || 30} minutes</p>
                    <p className="text-lg font-black text-gray-900 tracking-tighter italic leading-none">₹{item.price.toFixed(0)}</p>
                </div>
                <Button 
                    onClick={() => onBook(item)} 
                    disabled={isOutOfStock}
                    className="h-10 rounded-xl px-4 font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95"
                >
                    Book Now
                </Button>
            </div>
        </Card>
    );
}

export default function PublicMenuPage() {
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
  const { cartTotal } = useCart();

  const { data: store, isLoading: storeLoading } = useDoc<Store>(useMemoFirebase(() => firestore ? doc(firestore, 'stores', storeId) : null, [firestore, storeId]));
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(useMemoFirebase(() => firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null, [firestore, storeId]));
  const menu = menus?.[0];

  useEffect(() => {
      const table = searchParams.get('table');
      if (table) setTableNumber(table);
  }, [searchParams]);

  const sessionId = useMemo(() => {
    if (!deviceId) return 'loading';
    const dS = format(new Date(), 'yyyy-MM-dd');
    return tableNumber ? `table-${tableNumber}-${dS}-${storeId}` : `home-${deviceId}-${dS}`;
  }, [tableNumber, storeId, deviceId]);

  const ordersQuery = useMemoFirebase(() => (firestore && sessionId !== 'loading' ? query(collection(firestore, 'orders'), where('sessionId', '==', sessionId), where('isActive', '==', true)) : null), [firestore, sessionId]);
  const { data: placedOrders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

  const bookingsQuery = useMemoFirebase(() => {
      if (!firestore || !deviceId || !storeId) return null;
      // Dual-identifier query: check deviceId or userId if logged in
      const baseCol = collection(firestore, 'bookings');
      if (user?.uid) {
          return query(baseCol, where('userId', '==', user.uid), where('storeId', '==', storeId), orderBy('date', 'desc'), limit(10));
      }
      return query(baseCol, where('deviceId', '==', deviceId), where('storeId', '==', storeId), orderBy('date', 'desc'), limit(10));
  }, [firestore, deviceId, storeId, user?.uid]);

  const { data: customerBookings } = useCollection<Booking>(bookingsQuery);

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

  if (storeLoading || menuLoading || ordersLoading) return <div className="p-12 flex items-center justify-center bg-[#FDFCF7] min-h-screen"><Loader2 className="animate-spin h-8 w-8 text-primary" /></div>;
  if (!store) return <div className="p-12 text-center bg-[#FDFCF7] min-h-screen text-gray-900">Store not found.</div>;

  return (
    <>
      {selectedItemForIngredients && (
        <IngredientsDialog 
            open={!!selectedItemForIngredients} onClose={() => setSelectedItemForIngredients(null)} item={selectedItemForIngredients} 
            isLoading={isFetchingIngredients} ingredients={(ingredientsData?.components as any) || []} recommendations={[]} 
            itemType={ingredientsData?.itemType} onAdd={() => { setSelectedItemForIngredients(null); if(isSalon) setBookingService(selectedItemForIngredients); }} onShowRecommendation={(rec) => { setSelectedItemForIngredients(rec); handleShowIngredients(rec); }} 
        />
      )}
      
      {bookingService && (
          <Sheet open={!!bookingService} onOpenChange={() => setBookingService(null)}>
              <BookingSheet store={store} service={bookingService} onComplete={() => setBookingService(null)} />
          </Sheet>
      )}
      
      <div className="min-h-screen pb-40 bg-[#FDFCF7]">
          <header className="sticky top-0 z-50 bg-[#FDFCF7]/90 backdrop-blur-xl px-5 pt-4 pb-2 border-b">
              <div className="max-w-2xl mx-auto space-y-4">
                  <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                          <div className="relative h-8 w-8 rounded-full overflow-hidden border-2 border-primary">
                              <Image src={store.imageUrl || ADIRES_LOGO} alt={store.name} fill className="object-cover" />
                          </div>
                          <div>
                              <h1 className="font-black text-xs uppercase tracking-tight text-gray-950 truncate leading-none">{store.name}</h1>
                              <p className="text-[7px] font-black uppercase tracking-widest text-primary opacity-60 mt-0.5">{isSalon ? 'Salon & Spa' : 'Restaurant Hub'}</p>
                          </div>
                      </div>
                      {canInstall && (
                        <button onClick={triggerInstall} className="h-8 px-3 rounded-full bg-white shadow-sm border border-black/5 active:scale-90 transition-all font-black text-[8px] uppercase tracking-widest flex items-center gap-1.5">
                            <Download className="h-3 w-3 text-primary" /> Install
                        </button>
                      )}
                  </div>
                  <div className="flex gap-2 overflow-x-auto no-scrollbar py-0.5">
                      {availableCategories.map(cat => (
                          <button key={cat} onClick={() => setSelectedCategory(cat)} className={cn("px-4 h-9 rounded-full font-black text-[9px] uppercase tracking-widest transition-all shrink-0 border", selectedCategory === cat ? "bg-primary border-primary text-white scale-105 shadow-md" : "bg-white border-black/5 text-gray-500")}>
                              {cat}
                          </button>
                      ))}
                  </div>
              </div>
          </header>

          <div className="container mx-auto px-5 max-w-2xl mt-6 space-y-8">
                {Object.entries(groupedMenu).map(([category, items]) => (
                    <section key={category} className="space-y-3">
                        <h2 className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400 px-1">{category}</h2>
                        <div className="grid grid-cols-1 gap-3">
                            {items.map((item) => (
                                isSalon ? (
                                    <ServiceCard key={item.id} item={item} onBook={setBookingService} onShowDetails={handleShowIngredients} />
                                ) : (
                                    <Card key={item.id} className="p-4 rounded-3xl border-0 shadow-lg bg-white flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="relative h-16 w-16 rounded-2xl overflow-hidden border-2 bg-muted">
                                                <Image src={item.imageUrl || ADIRES_LOGO} alt={item.name} fill className="object-cover" />
                                            </div>
                                            <div>
                                                <p className="font-black text-[11px] uppercase tracking-tight">{item.name}</p>
                                                <p className="font-black text-primary text-sm">₹{item.price}</p>
                                            </div>
                                        </div>
                                        <Button size="sm" variant="outline" className="rounded-xl font-black text-[10px] uppercase h-9">View</Button>
                                    </Card>
                                )
                            ))}
                        </div>
                    </section>
                ))}
          </div>

          <div className="fixed bottom-6 left-0 right-0 z-50 px-5">
              <div className="max-w-md mx-auto">
                  <div className="bg-[#FDD835] rounded-full h-14 flex items-center justify-between pl-6 pr-1.5 shadow-2xl border-4 border-white">
                      <div className="flex items-center gap-3">
                          <p className="text-base font-black text-gray-950 leading-none">
                              {isSalon ? `${customerBookings?.length || 0} Sessions` : `₹${cartTotal.toFixed(0)} Selected`}
                          </p>
                      </div>
                      <Sheet open={isLiveBillOpen} onOpenChange={setIsLiveBillOpen}>
                          <SheetTrigger asChild>
                              <Button className="h-10 rounded-full bg-gray-950 text-white font-black uppercase text-[9px] tracking-widest px-5 shadow-lg">
                                  {isSalon ? 'My Bookings' : 'View Bill'}
                              </Button>
                          </SheetTrigger>
                          <SheetContent side="bottom" className="h-[85vh] rounded-t-[3rem] p-0 border-0 overflow-hidden shadow-2xl">
                              <LiveBillSheet isSalon={isSalon} placedOrders={placedOrders || []} historyOrders={[]} isLoadingOrders={ordersLoading} onFinalizeBill={() => {}} customerBookings={customerBookings ?? []}/>
                          </SheetContent>
                      </Sheet>
                  </div>
              </div>
          </div>
      </div>
    </>
  );
}
