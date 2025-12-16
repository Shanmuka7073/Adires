
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  doc,
  setDoc,
  updateDoc,
} from 'firebase/firestore';

import type {
  Store,
  Menu,
  MenuItem,
  Order,
  OrderItem,
  GetIngredientsOutput,
} from '@/lib/types';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition, useRef } from 'react';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

import {
  Plus,
  Receipt,
  Loader2,
  Check,
  Clock,
  Trash2,
  Eye,
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
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { addRestaurantOrderItem } from '@/app/actions';
import type { Timestamp } from 'firebase/firestore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import IngredientsDialog from '@/components/IngredientsDialog'; // Import the new dialog
import { getCachedRecipe } from '@/lib/recipe-cache';
import { FirestoreCounter } from '@/components/layout/firestore-counter';


/* -------------------------------------------------------------------------- */
/*                                   LIVE BILL SHEET                          */
/* -------------------------------------------------------------------------- */

function LiveBillSheet({ storeId, sessionId }: { storeId: string; sessionId: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [closing, startClose] = useTransition();
  const orderId = `${storeId}_${sessionId}`;

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
      const updatedItems = order.items.filter(item => item.id !== itemToRemove.id);
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
    <div className="flex flex-col h-full">
        <SheetHeader className='p-4 border-b'>
            <SheetTitle className="flex items-center gap-2">
              <Receipt /> Live Bill
            </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
             {order.items.map((it, idx) => (
              <div key={idx} className="border-b py-2 flex justify-between items-center text-sm">
                <div>
                    <span className="font-medium">{it.productName} <span className="text-muted-foreground">x{it.quantity}</span></span>
                    <p>₹{(it.price * it.quantity).toFixed(2)}</p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => handleRemoveItem(it)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
        </div>

        <div className="p-4 border-t space-y-4">
            <div className="flex justify-between font-bold text-xl">
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


/* -------------------------------------------------------------------------- */
/*                                MAIN PAGE                                   */
/* -------------------------------------------------------------------------- */

export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const tableNumber = useSearchParams().get('table');
  const { firestore } = useFirebase();

  const { toast } = useToast();
  const [isAdding, startAdding] = useTransition();
  const [sessionId, setSessionId] = useState('');
  
  const [selectedItemForIngredients, setSelectedItemForIngredients] = useState<MenuItem | null>(null);
  const [ingredientsData, setIngredientsData] = useState<GetIngredientsOutput | null>(null);
  const [isFetchingIngredients, startFetchingIngredients] = useTransition();

  const orderId = `${storeId}_${sessionId}`;
  const orderQuery = useMemoFirebase(
    () => (firestore && sessionId ? doc(firestore, 'orders', orderId) : null),
    [firestore, orderId, sessionId]
  );
  const { data: order } = useDoc<Order>(orderQuery);
  const itemCount = order?.items?.length || 0;


  useEffect(() => {
    const key = `session_${storeId}_${tableNumber}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = uuidv4();
      sessionStorage.setItem(key, id);
    }
    setSessionId(id);
  }, [storeId, tableNumber]);

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
    return menu.items.reduce((acc, item) => {
        const cat = item.category || 'Other';
        if(!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, MenuItem[]>)
  }, [menu]);

  const handleAddItem = (item: MenuItem) => {
    startAdding(async () => {
      const result = await addRestaurantOrderItem({
        storeId,
        sessionId,
        tableNumber: tableNumber || null,
        item,
        quantity: 1,
      });

      if (result.success) {
        toast({
          title: "Added to Bill",
          description: `${item.name} has been added to your live bill.`,
        });
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
    if (!firestore) return;
    setSelectedItemForIngredients(item);
    startFetchingIngredients(async () => {
        const cachedData = await getCachedRecipe(firestore, item.name, 'en');
        if (cachedData) {
            setIngredientsData(cachedData);
        } else {
            // If not found in cache, show empty state in dialog
            setIngredientsData({
                isSuccess: false,
                title: item.name,
                ingredients: [],
                instructions: [],
                nutrition: { calories: 0, protein: 0 }
            });
            toast({
                variant: "destructive",
                title: "Ingredients Not Available",
                description: `Ingredients for "${item.name}" are not in the database.`,
            });
        }
    });
  };

  if (storeLoading || menuLoading) return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
  );
  if (!store || !menu) return <div className="p-4 text-center">Menu not found.</div>;
  
  const isBillFinalized = order?.status === 'Completed';


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
      <div className="min-h-screen bg-white">
          <div className="container mx-auto py-8 px-4 md:px-6 max-w-2xl">
            <header className="mb-8">
                <div className="flex items-center gap-4">
                    {store.imageUrl && (
                        <Image
                        src={store.imageUrl}
                        alt={store.name}
                        width={48}
                        height={48}
                        className="rounded-full border-2 border-white shadow-md"
                        />
                    )}
                    <div>
                        <h1 className="text-2xl font-bold font-headline">{store.name}</h1>
                        {tableNumber && <p className="text-muted-foreground">Table {tableNumber}</p>}
                    </div>
                </div>
            </header>

              {isBillFinalized ? (
                  <Card className="text-center py-16 px-6">
                      <CardHeader>
                          <Check className="mx-auto h-16 w-16 text-green-500 bg-green-100 rounded-full p-2" />
                          <CardTitle className="text-2xl font-bold mt-4">Thank You!</CardTitle>
                          <CardDescription className="text-base text-muted-foreground">Your bill has been finalized. Please proceed to the counter for payment.</CardDescription>
                      </CardHeader>
                  </Card>
              ) : (
                  <main className="space-y-8 pb-24">
                      {Object.entries(groupedMenu).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                          <div key={category}>
                              <h2 className="text-sm font-bold mb-4 tracking-widest uppercase text-muted-foreground">{category}</h2>
                              <div className="space-y-3">
                                  {items.map((item, index) => (
                                      <div
                                          key={index}
                                          className="flex justify-between items-center bg-gray-50 p-4 rounded-xl"
                                      >
                                          <div>
                                              <p className="font-semibold text-gray-800">{item.name}</p>
                                              <p className="text-sm text-gray-600">₹{item.price.toFixed(2)}</p>
                                          </div>
                                          <div className="flex gap-2">
                                            <Button variant="ghost" size="sm" onClick={() => handleShowIngredients(item)}>
                                                <Eye className="mr-2 h-4 w-4" /> Ingredients
                                            </Button>
                                            <Button 
                                                onClick={() => handleAddItem(item)} 
                                                disabled={isAdding}
                                                className="bg-green-500 hover:bg-green-600 text-white rounded-lg"
                                            >
                                                <Plus className="mr-2 h-4 w-4" /> Add
                                            </Button>
                                          </div>
                                      </div>
                                  ))}
                              </div>
                          </div>
                      ))}
                  </main>
              )}
          </div>
          
          {itemCount > 0 && !isBillFinalized && (
               <Sheet>
                  <SheetTrigger asChild>
                      <div className="fixed bottom-4 right-4 z-50">
                          <Button className="h-14 rounded-full shadow-lg bg-green-600 hover:bg-green-700 text-lg pl-6 pr-8">
                              <Receipt className="mr-3 h-5 w-5" />
                              View Bill 
                              <Badge className="ml-3">{itemCount} items</Badge>
                          </Button>
                      </div>
                  </SheetTrigger>
                  <SheetContent>
                      <LiveBillSheet storeId={storeId} sessionId={sessionId} />
                  </SheetContent>
              </Sheet>
          )}
          <FirestoreCounter />
        </div>
    </>
  );
}
