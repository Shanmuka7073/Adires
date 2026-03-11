
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  setDoc,
  updateDoc,
  limit,
} from 'firebase/firestore';

import type {
  Store,
  Menu,
  MenuItem,
  Order,
  OrderItem,
  GetIngredientsOutput,
  Ingredient,
} from '@/lib/types';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, useRef } from 'react';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

import {
  Utensils,
  Plus,
  Minus,
  Receipt,
  Loader2,
  Check,
  Clock,
  Zap,
  Flame,
  Info,
  ShoppingCart,
  Salad,
  Mic,
  Eye,
  Download,
  Search,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { addRestaurantOrderItem, getIngredientsForDish } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import type { Timestamp } from 'firebase/firestore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import IngredientsDialog from '@/components/IngredientsDialog';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';


function LiveBillSheet({ orderId, theme }: { orderId: string; theme: Menu['theme'] }) {
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

   const handleRemoveItem = async (itemToRemove: OrderItem) => {
      if (!firestore || !order) return;

      const orderRef = doc(firestore, 'orders', order.id);
      const updatedItems = (order.items || []).filter(item => item.id !== itemToRemove.id);
      const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

      try {
          await updateDoc(orderRef, {
              items: updatedItems,
              totalAmount: newTotal
          });
          toast({ description: `${itemToRemove.productName} removed from your bill.` });
      } catch (e) {
          console.error("Failed to remove item:", e);
          toast({ variant: 'destructive', title: 'Failed to remove item.' });
      }
  };


  if (isLoading) {
    return <Loader2 className="animate-spin mx-auto" />;
  }
  
  if (!order || !order.items?.length) {
      return (
          <div className="p-4">
              <p className="text-muted-foreground text-center py-4">No items added to your bill yet.</p>
          </div>
      )
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: theme?.backgroundColor }}>
        <SheetHeader className='p-4 border-b' style={{ borderColor: theme?.primaryColor }}>
            <SheetTitle className="flex items-center gap-2" style={{ color: theme?.primaryColor }}>
              <Receipt /> Live Bill
            </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {order.items.map((it, idx) => (
              <div key={idx} className="border-b py-2 flex justify-between items-center text-sm" style={{borderColor: theme?.primaryColor + '30', color: theme?.textColor}}>
                <div>
                    <span className="font-medium">{it.productName} <span className="opacity-70">x{it.quantity}</span></span>
                    <p>₹{(it.price * it.quantity).toFixed(2)}</p>
                </div>
              </div>
            ))}
        </div>

        <div className="p-4 border-t space-y-4" style={{ borderColor: theme?.primaryColor + '30' }}>
            <div className="flex justify-between font-bold text-xl" style={{ color: theme?.primaryColor }}>
              <span>Total</span>
              <span>₹{order.totalAmount.toFixed(2)}</span>
            </div>
            
            <div>
              {order.status === 'Completed' ? (
                 <div className="text-center p-4 bg-blue-100 rounded-md">
                    <Check className="mx-auto h-6 w-6 text-blue-600 mb-2" />
                    <p className="font-semibold text-blue-800">Thank you! Visit Again.</p>
                </div>
              ) : order.status === 'Billed' ? (
                <div className="text-center p-4 bg-green-100 rounded-md">
                    <Clock className="mx-auto h-6 w-6 text-green-600 mb-2" />
                    <p className="font-semibold text-green-800">Bill Closed. Please pay at the counter.</p>
                    {order.orderDate && <p className="text-xs text-green-700">Started at {format(new Date((order.orderDate as Timestamp).seconds * 1000), 'p')}</p>}
                </div>
              ) : (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" variant="destructive" disabled={closing}>
                      {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                      Close Bill & Pay
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Ready to Pay?</AlertDialogTitle>
                      <AlertDialogDescription>This will notify the kitchen that you are done ordering and ready to pay your bill.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Not yet</AlertDialogCancel>
                      <AlertDialogAction onClick={closeBill}>
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
  
  const { canInstall, triggerInstall } = useInstall();
  const [selectedItemForIngredients, setSelectedItemForIngredients] = useState<MenuItem | null>(null);
  const [ingredientsData, setIngredientsData] = useState<GetIngredientsOutput | null>(null);
  const [isFetchingIngredients, startFetchingIngredients] = useTransition();
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  // Dynamic Session Query: Look for any order for this table that is NOT yet Completed
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
  
  const groupedMenu = useMemo(() => {
    if (!menu?.items) return {};
    
    const filteredItems = menu.items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return filteredItems.reduce((acc, item) => {
        const cat = item.category || 'Other';
        if(!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, MenuItem[]>)
  }, [menu, searchTerm]);

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
          title: "Added to Bill",
          description: `${item.name} has been added to your live bill.`,
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
          title: "Failed to Add Item",
          description: result.error || "An unknown error occurred.",
        });
      }
    });
  };
  
   const handleShowIngredients = (item: MenuItem) => {
    setSelectedItemForIngredients(item);
    startFetchingIngredients(async () => {
      const response = await getIngredientsForDish({
        dishName: item.name,
        language: 'en', // default language
      });
      
      if (response && response.isSuccess) {
        setIngredientsData(response);
      } else {
        setIngredientsData({
          isSuccess: false,
          title: item.name,
          ingredients: [],
          instructions: [],
          nutrition: { calories: 0, protein: 0 },
        });
        toast({
          variant: 'destructive',
          title: 'Ingredients Not Available',
          description: `The ingredients for "${item.name}" could not be generated at this time.`,
        });
      }
    });
  };


  if (storeLoading || menuLoading || orderLoading) return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
  );
  if (!store || !menu) return <div className="p-4 text-center">Menu not found.</div>;
  
  // Terminal state for showing "Thank You" is specifically 'Completed'
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
      <div className="min-h-screen" style={{ backgroundColor: theme?.backgroundColor }}>
          <div className="container mx-auto py-8 px-4 md:px-6 max-w-2xl">
            <Card className="shadow-xl overflow-hidden border-0 rounded-2xl" style={{ backgroundColor: theme?.backgroundColor }}>
              <CardHeader className="pb-4 p-6">
                  <div className="flex items-center gap-4">
                    {store.imageUrl && (
                        <div className="relative h-16 w-16 md:h-20 md:w-20 rounded-2xl overflow-hidden border-2 shrink-0 shadow-md" style={{ borderColor: theme?.primaryColor + '40' }}>
                            <Image
                                src={store.imageUrl}
                                alt={store.name}
                                fill
                                className="object-cover"
                            />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <CardTitle className="text-2xl md:text-3xl font-bold font-headline truncate" style={{ color: theme?.primaryColor }}>
                            {store.name}
                        </CardTitle>
                        {tableNumber && (
                            <Badge 
                                className="mt-1 px-3 py-0.5 text-xs font-bold rounded-full shadow-sm" 
                                style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}
                            >
                                Table {tableNumber}
                            </Badge>
                        )}
                    </div>
                  </div>
                  
                  {!isBillFinalized && (
                    <div className="mt-6 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-50" style={{ color: theme?.textColor }} />
                        <Input 
                            placeholder="Search dishes..." 
                            className="pl-10 border-2 h-12 rounded-xl text-base shadow-sm focus-visible:ring-offset-0" 
                            style={{ 
                                backgroundColor: theme?.backgroundColor, 
                                color: theme?.textColor,
                                borderColor: theme?.primaryColor + '20'
                            }}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                  )}

                  {canInstall && (
                    <div className="pt-2 text-right">
                        <Button onClick={triggerInstall} size="sm" variant="ghost" className="h-8 text-[10px] uppercase tracking-widest font-extrabold opacity-60 hover:bg-transparent" style={{ color: theme?.primaryColor }}>
                            <Download className="mr-1.5 h-3 w-3" />
                            Install App
                        </Button>
                    </div>
                  )}
              </CardHeader>
              <CardContent className="space-y-6 pt-0 px-6">

                {order?.status === 'Billed' ? (
                    <div className="text-center py-16 px-6">
                        <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full mb-4" style={{ backgroundColor: theme?.primaryColor + '20' }}>
                            <Check className="h-10 w-10" style={{ color: theme?.primaryColor }} />
                        </div>
                        <h2 className="text-2xl font-bold mt-4" style={{color: theme?.textColor}}>Thank You!</h2>
                        <p className="text-base opacity-80" style={{color: theme?.textColor}}>Your bill has been finalized. Please proceed to the counter for payment.</p>
                    </div>
                ) : Object.entries(groupedMenu).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                    <div key={category}>
                        <h2 className="text-lg font-bold mb-3 border-b-2 pb-2 uppercase tracking-wide opacity-80" style={{ borderColor: theme?.primaryColor + '20', color: theme?.primaryColor }}>{category}</h2>
                        <div className="space-y-3">
                            {items.map((item, index) => {
                                const isRecentlyAdded = recentlyAdded.has(item.id);
                                return (
                                <Card
                                    key={item.id || index}
                                    className="flex justify-between items-center p-4 border-0 shadow-sm rounded-xl transition-all"
                                    style={{ backgroundColor: theme?.primaryColor + '08' }}
                                >
                                    <div className="flex-1 pr-2">
                                        <p className="font-bold text-lg leading-tight" style={{color: theme?.textColor}}>{item.name}</p>
                                        <p className="text-sm font-extrabold mt-1" style={{color: theme?.textColor, opacity: 0.9}}>₹{item.price.toFixed(2)}</p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Button variant="ghost" size="sm" onClick={() => handleShowIngredients(item)} className="h-10 w-10 p-0 rounded-full hover:bg-black/5">
                                            <Eye className="h-5 w-5" style={{ color: theme?.textColor }}/>
                                        </Button>
                                         <Button 
                                            onClick={() => handleAddItem(item)} 
                                            disabled={isAdding || isRecentlyAdded}
                                            className={cn("w-24 h-10 rounded-full font-bold shadow-md transition-all active:scale-95", isRecentlyAdded ? "bg-green-600" : "")}
                                            style={{ backgroundColor: isRecentlyAdded ? '' : theme?.primaryColor, color: theme?.backgroundColor }}
                                        >
                                            {isRecentlyAdded ? <Check className="h-5 w-5" /> : (isAdding ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Add</>) }
                                        </Button>
                                    </div>
                                </Card>
                            )})}
                        </div>
                    </div>
                ))}
                
                {Object.keys(groupedMenu).length === 0 && !orderLoading && (
                    <div className="text-center py-16 opacity-40" style={{ color: theme?.textColor }}>
                        <Utensils className="mx-auto h-16 w-16 mb-4" />
                        <p className="text-lg font-medium">No dishes found</p>
                    </div>
                )}
              </CardContent>
            </Card>
          </div>
          
          {itemCount > 0 && order?.status !== 'Billed' && (
               <Sheet>
                  <SheetTrigger asChild>
                      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-xs px-4">
                          <Button className="h-14 w-full rounded-full shadow-2xl text-lg font-extrabold transition-transform active:scale-95 ring-4 ring-black/5" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>
                              <Receipt className="mr-3 h-6 w-6" />
                              View Bill 
                              <Badge className="ml-3 px-2 py-0.5 h-6 min-w-[24px] flex items-center justify-center rounded-full font-bold shadow-inner" style={{ backgroundColor: theme?.backgroundColor, color: theme?.primaryColor }}>{itemCount}</Badge>
                          </Button>
                      </div>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[75vh] rounded-t-[2.5rem] p-0 border-0 overflow-hidden shadow-[0_-20px_50px_rgba(0,0,0,0.2)]">
                      <LiveBillSheet orderId={order.id} theme={theme} />
                  </SheetContent>
              </Sheet>
          )}
        </div>
    </>
  );
}
