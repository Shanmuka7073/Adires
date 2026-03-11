
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  setDoc,
  limit,
} from 'firebase/firestore';

import type {
  Store,
  Menu,
  MenuItem,
  Order,
  MenuTheme,
} from '@/lib/types';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';

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

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { addRestaurantOrderItem, getIngredientsForDish } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import IngredientsDialog from '@/components/IngredientsDialog';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import type { GetIngredientsOutput } from '@/lib/types';


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
    if (!firestore || !order) return;
    startClose(async () => {
      const orderRef = doc(firestore, 'orders', order.id);
      try {
        await setDoc(orderRef, { status: 'Billed' }, { merge: true });
        toast({ title: 'Bill closed. Please proceed to the counter to pay.' });
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Failed to close bill.' });
      }
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }
  
  if (!order || !order.items?.length) {
      return (
          <div className="p-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Receipt className="h-8 w-8 text-muted-foreground opacity-20" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">Your bill is currently empty.</p>
          </div>
      )
  }

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
                <div className="flex-1 pr-4">
                    <span className="font-bold leading-tight block">{it.productName}</span>
                    <span className="text-[10px] opacity-60 font-bold uppercase tracking-wider">Qty: {it.quantity}</span>
                </div>
                <div className="text-right font-bold">
                    ₹{(it.price * it.quantity).toFixed(2)}
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
              {order.status === 'Completed' ? (
                 <div className="text-center p-5 bg-green-500/10 border border-green-500/20 rounded-2xl shadow-sm">
                    <Check className="mx-auto h-8 w-8 text-green-500 mb-2" />
                    <p className="font-bold text-green-500">Paid & Completed</p>
                    <p className="text-xs text-green-500/80">Thank you for visiting!</p>
                </div>
              ) : order.status === 'Billed' ? (
                <div className="text-center p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl shadow-sm">
                    <Clock className="mx-auto h-8 w-8 text-amber-500 mb-2" />
                    <p className="font-bold text-amber-500 uppercase tracking-wide">Pending Payment</p>
                    <p className="text-xs text-amber-500/80">Please pay at the counter.</p>
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full h-14 rounded-2xl text-base font-bold shadow-lg" variant="destructive" disabled={closing}>
                      {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                      Close Bill & Pay
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-3xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle>Finalize your order?</AlertDialogTitle>
                      <AlertDialogDescription>This will signal the staff that you're ready to pay. You won't be able to add more items to this bill.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                      <AlertDialogCancel className="rounded-xl font-bold">Not yet</AlertDialogCancel>
                      <AlertDialogAction onClick={closeBill} className="rounded-xl font-bold">
                        Yes, Close Bill
                      </AlertDialogAction>
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
  const tableNumber = useSearchParams().get('table');
  const { firestore } = useFirebase();

  const { toast } = useToast();
  const [isAdding, startAdding] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  
  const { canInstall, triggerInstall } = useInstall();
  const [selectedItemForIngredients, setSelectedItemForIngredients] = useState<MenuItem | null>(null);
  const [ingredientsData, setIngredientsData] = useState<GetIngredientsOutput | null>(null);
  const [isFetchingIngredients, startFetchingIngredients] = useTransition();
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  // Dynamic Session Query
  const activeOrderQuery = useMemoFirebase(() => {
    if (!firestore || !storeId || !tableNumber) return null;
    return query(
      collection(firestore, 'orders'),
      where('storeId', '==', storeId),
      where('tableNumber', '==', tableNumber),
      where('status', 'in', ['Pending', 'Processing', 'Billed', 'Out for Delivery']),
      limit(1)
    );
  }, [firestore, storeId, tableNumber]);

  const { data: activeOrders, isLoading: orderLoading } = useCollection<Order>(activeOrderQuery);
  const order = activeOrders?.[0];
  const itemCount = order?.items?.length || 0;

  const storeRef = useMemoFirebase(() =>
    firestore ? doc(firestore, 'stores', storeId) : null,
  [firestore, storeId]);

  const menuQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null,
  [firestore, storeId]);

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

    if (selectedCategory) {
        filteredItems = filteredItems.filter(item => item.category === selectedCategory);
    }

    return filteredItems.reduce((acc, item) => {
        const cat = item.category || 'Other';
        if(!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, MenuItem[]>)
  }, [menu, searchTerm, selectedCategory]);

  const handleAddItem = (item: MenuItem) => {
    startAdding(async () => {
      const result = await addRestaurantOrderItem({
        storeId,
        tableNumber: tableNumber || null,
        item,
        quantity: 1,
      });

      if (result.success) {
        toast({
          title: "Dish Added",
          description: `${item.name} is on the way.`,
        });
         setRecentlyAdded(prev => new Set(prev).add(item.id));
        setTimeout(() => {
            setRecentlyAdded(prev => {
                const newSet = new Set(prev);
                newSet.delete(item.id);
                return newSet;
            });
        }, 2000);
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Add",
          description: result.error || "Please try again.",
        });
      }
    });
  };
  
   const handleShowIngredients = (item: MenuItem) => {
    setSelectedItemForIngredients(item);
    startFetchingIngredients(async () => {
      const response = await getIngredientsForDish({
        dishName: item.name,
        language: 'en',
      });
      
      if (response && response.isSuccess) {
        setIngredientsData(response);
      } else {
        setIngredientsData(null);
        toast({
          variant: 'destructive',
          title: 'Ingredients Not Available',
          description: `Could not load details for ${item.name}.`,
        });
      }
    });
  };


  if (storeLoading || menuLoading || orderLoading) return (
      <div className="p-6 space-y-6">
        <div className="flex gap-4 items-center">
            <Skeleton className="h-16 w-16 rounded-2xl shrink-0" />
            <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-20" />
            </div>
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-40 w-full rounded-2xl" />
            <Skeleton className="h-40 w-full rounded-2xl" />
        </div>
      </div>
  );
  if (!store || !menu) return <div className="p-12 text-center font-medium opacity-50">Menu unavailable.</div>;
  
  const isBillFinalized = order?.status === 'Completed';
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
          onAdd={() => {
            handleAddItem(selectedItemForIngredients);
            setSelectedItemForIngredients(null);
          }}
        />
      )}
      <div className="min-h-screen pb-24" style={{ backgroundColor: theme?.backgroundColor }}>
          <div className="container mx-auto py-6 px-4 md:px-6 max-w-2xl">
            <div className="space-y-6">
              
              {/* COMPACT HEADER */}
              <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {store.imageUrl && (
                        <div className="relative h-12 w-12 md:h-14 md:w-14 rounded-2xl overflow-hidden border shrink-0 shadow-sm" style={{ borderColor: theme?.primaryColor + '20' }}>
                            <Image
                                src={store.imageUrl}
                                alt={store.name}
                                fill
                                className="object-cover"
                            />
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-base md:text-lg font-black font-headline truncate leading-tight" style={{ color: theme?.primaryColor }}>
                            {store.name}
                        </h1>
                        {tableNumber && (
                            <Badge 
                                className="mt-0.5 px-1.5 py-0 text-[8px] font-black rounded-sm shadow-sm uppercase tracking-widest" 
                                style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}
                            >
                                Table {tableNumber}
                            </Badge>
                        )}
                    </div>
                  </div>

                  {/* MINI SEARCH / TOOLS */}
                  <div className="flex items-center gap-2 shrink-0">
                    {isSearchOpen ? (
                        <div className="relative flex items-center">
                            <Input 
                                autoFocus
                                placeholder="Search..."
                                className="h-8 w-28 md:w-40 pr-8 rounded-xl text-[10px] font-bold border-2 focus-visible:ring-0"
                                style={{ borderColor: theme?.primaryColor + '30', backgroundColor: 'rgba(255,255,255,0.1)', color: theme?.textColor }}
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button 
                                className="absolute right-2 hover:opacity-70"
                                style={{ color: theme?.textColor }}
                                onClick={() => { setIsSearchOpen(false); setSearchTerm(''); }}
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                    ) : (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full bg-white/5 shadow-sm border border-white/5"
                            onClick={() => setIsSearchOpen(true)}
                        >
                            <Search className="h-3.5 w-3.5" style={{ color: theme?.primaryColor }} />
                        </Button>
                    )}
                    {canInstall && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 rounded-full bg-white/5 shadow-sm border border-white/5"
                            onClick={triggerInstall}
                        >
                            <Download className="h-3.5 w-3.5" style={{ color: theme?.primaryColor }} />
                        </Button>
                    )}
                  </div>
              </div>

              {/* CATEGORY BAR */}
              {!isBillFinalized && (
                <ScrollArea className="w-full whitespace-nowrap -mx-4 px-4 pb-2">
                    <div className="flex gap-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className={cn(
                                "rounded-lg px-3 h-7 font-black text-[9px] uppercase tracking-widest border transition-all active:scale-95",
                                !selectedCategory ? "shadow-md border-transparent" : "opacity-40 border-white/10"
                            )}
                            style={{ 
                                backgroundColor: !selectedCategory ? theme?.primaryColor : 'transparent',
                                color: !selectedCategory ? theme?.backgroundColor : theme?.primaryColor,
                            }}
                            onClick={() => setSelectedCategory(null)}
                        >
                            All
                        </Button>
                        {availableCategories.map(cat => (
                            <Button
                                key={cat}
                                variant="ghost"
                                size="sm"
                                className={cn(
                                    "rounded-lg px-3 h-7 font-black text-[9px] uppercase tracking-widest border transition-all active:scale-95",
                                    selectedCategory === cat ? "shadow-md border-transparent" : "opacity-40 border-white/10"
                                )}
                                style={{ 
                                    backgroundColor: selectedCategory === cat ? theme?.primaryColor : 'transparent',
                                    color: selectedCategory === cat ? theme?.backgroundColor : theme?.primaryColor,
                                }}
                                onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
                            >
                                {cat}
                            </Button>
                        ))}
                    </div>
                    <ScrollBar orientation="horizontal" className="hidden" />
                </ScrollArea>
              )}

              {/* MENU CONTENT */}
              <div className="space-y-6">
                {order?.status === 'Billed' ? (
                    <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden" style={{ backgroundColor: theme?.primaryColor + '05' }}>
                        <CardContent className="text-center py-16 px-8">
                            <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full mb-6 bg-white/5 border border-white/10 shadow-xl">
                                <Check className="h-10 w-10" style={{ color: theme?.primaryColor }} />
                            </div>
                            <h2 className="text-2xl font-black mb-3" style={{color: theme?.textColor}}>Thank You!</h2>
                            <p className="text-sm font-bold opacity-60 leading-relaxed" style={{color: theme?.textColor}}>Your bill is closed. Please visit the counter to finalize payment.</p>
                        </CardContent>
                    </Card>
                ) : Object.entries(groupedMenu).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                    <div key={category} className="space-y-2">
                        <h2 className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 px-1" style={{ color: theme?.textColor }}>
                            {category}
                        </h2>
                        <div className="grid gap-2">
                            {items.map((item, index) => {
                                const isRecentlyAdded = recentlyAdded.has(item.id);
                                return (
                                <Card
                                    key={item.id || index}
                                    className="flex justify-between items-center p-3 shadow-sm rounded-xl transition-all active:scale-[0.98] border"
                                    style={{ backgroundColor: 'transparent', borderColor: theme?.primaryColor + '15' }}
                                >
                                    <div className="flex-1 pr-4 min-w-0" onClick={() => handleShowIngredients(item)}>
                                        <p className="font-bold text-xs leading-tight truncate mb-0.5" style={{ color: theme?.textColor }}>{item.name}</p>
                                        <p className="text-[10px] font-black" style={{color: theme?.primaryColor}}>₹{item.price.toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                         <Button 
                                            onClick={() => handleAddItem(item)} 
                                            disabled={isAdding || isRecentlyAdded}
                                            className={cn(
                                                "w-16 h-8 rounded-lg text-[9px] uppercase tracking-widest font-black shadow-sm transition-all",
                                                isRecentlyAdded ? "bg-green-600 border-0" : ""
                                            )}
                                            style={{ 
                                                backgroundColor: isRecentlyAdded ? '' : theme?.primaryColor, 
                                                color: theme?.backgroundColor 
                                            }}
                                        >
                                            {isRecentlyAdded ? <Check className="h-3 w-3" /> : (isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add') }
                                        </Button>
                                    </div>
                                </Card>
                            )})}
                        </div>
                    </div>
                ))}
                
                {Object.keys(groupedMenu).length === 0 && !orderLoading && (
                    <div className="text-center py-24 space-y-4">
                        <Utensils className="mx-auto h-10 w-10 opacity-10" style={{ color: theme?.textColor }} />
                        <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest" style={{ color: theme?.textColor }}>No dishes found</p>
                    </div>
                )}
              </div>
            </div>
          </div>
          
          {itemCount > 0 && order?.status !== 'Billed' && !isBillFinalized && (
               <Sheet>
                  <SheetTrigger asChild>
                      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[200px] px-4">
                          <Button className="h-12 w-full rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.3)] text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95 border-0" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>
                              <Receipt className="mr-2 h-4 w-4" />
                              View Bill 
                              <Badge className="ml-2 h-5 min-w-[20px] rounded-md text-[9px] font-black flex items-center justify-center shadow-inner" style={{ backgroundColor: theme?.backgroundColor, color: theme?.primaryColor }}>{itemCount}</Badge>
                          </Button>
                      </div>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[70vh] rounded-t-[2.5rem] p-0 border-0 overflow-hidden shadow-[0_-15px_50px_rgba(0,0,0,0.25)]">
                      <LiveBillSheet orderId={order.id} theme={theme} />
                  </SheetContent>
              </Sheet>
          )}
        </div>
    </>
  );
}
