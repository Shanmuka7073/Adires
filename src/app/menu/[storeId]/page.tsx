
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  doc,
  setDoc,
} from 'firebase/firestore';

import type { Store, Menu, MenuItem, Order } from '@/lib/types';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';
import { format } from 'date-fns';

import {
  Utensils,
  Receipt,
  Loader2,
  Plus,
  Clock,
  Check
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
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { addRestaurantOrderItem } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import type { Timestamp } from 'firebase/firestore';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetFooter } from '@/components/ui/sheet';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/* -------------------------------------------------------------------------- */
/*                               LIVE BILL SHEET                              */
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

  if (isLoading) {
    return <div className="p-4"><Loader2 className="animate-spin mx-auto" /></div>;
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
        <SheetHeader className="px-4 pt-4">
            <SheetTitle className="flex items-center gap-2">
                <Receipt /> Live Bill
            </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {order.items.map((it, idx) => (
                <div key={idx} className="border-b py-2 flex justify-between text-sm">
                <span className="font-medium">{it.productName} <span className="text-muted-foreground">x{it.quantity}</span></span>
                <span>₹{(it.price * it.quantity).toFixed(2)}</span>
                </div>
            ))}
        </div>

        <SheetFooter className="p-4 border-t bg-background">
            <div className="w-full space-y-4">
                <div className="flex justify-between font-bold text-xl">
                <span>Total</span>
                <span>₹{order.totalAmount.toFixed(2)}</span>
                </div>
                
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
        </SheetFooter>
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
  const { canInstall, triggerInstall } = useInstall();

  const [sessionId, setSessionId] = useState('');
  const [isAdding, startAdding] = useTransition();

  /* ---------------- SESSION ---------------- */
  useEffect(() => {
    const key = `session_${storeId}_${tableNumber}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = uuidv4();
      sessionStorage.setItem(key, id);
    }
    setSessionId(id);
  }, [storeId, tableNumber]);

  /* ---------------- DATA ---------------- */
  const storeRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'stores', storeId) : null),
  [firestore, storeId]);

  const menuQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null),
  [firestore, storeId]);
  
  const orderRef = useMemoFirebase(
    () => (firestore && sessionId ? doc(firestore, 'orders', `${storeId}_${sessionId}`) : null),
    [firestore, storeId, sessionId]
  );

  const { data: store, isLoading: storeLoading } = useDoc<Store>(storeRef);
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);
  const { data: order } = useDoc<Order>(orderRef);
  
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

  /* ---------------- ACTION ---------------- */
  const addItem = (item: MenuItem) => {
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

  if (storeLoading || menuLoading) return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
  );
  if (!store || !menu) return <div className="p-4 text-center">Menu not found.</div>;

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
      <header className="sticky top-0 bg-white shadow z-40">
        <div className="flex items-center gap-3 p-4">
          {store.imageUrl && (
            <Image
              src={store.imageUrl}
              alt={store.name}
              width={48}
              height={48}
              className="rounded-full"
            />
          )}
          <div className="flex-1">
            <h1 className="font-bold text-lg">{store.name}</h1>
            {tableNumber && (
              <p className="text-xs text-muted-foreground">
                Table {tableNumber}
              </p>
            )}
          </div>
          <Utensils className="text-primary" />
        </div>

        {canInstall && (
          <div className="px-4 pb-3">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={triggerInstall}
            >
              Add to Home Screen
            </Button>
          </div>
        )}
      </header>

      <main className="p-4 space-y-6">
        {Object.entries(groupedMenu).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
            <div key={category}>
                <h2 className="text-sm font-bold uppercase text-muted-foreground mb-2">{category}</h2>
                <div className="space-y-3">
                    {items.map((item, index) => (
                        <div key={index} className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center">
                          <div>
                            <p className="font-semibold">{item.name}</p>
                            <p className="text-sm text-gray-500">₹{item.price.toFixed(2)}</p>
                          </div>
                          <Button
                            size="sm"
                            disabled={isAdding}
                            onClick={() => addItem(item)}
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add
                          </Button>
                        </div>
                    ))}
                </div>
            </div>
        ))}
      </main>

       {order && order.items?.length > 0 && sessionId && (
         <Sheet>
            <SheetTrigger asChild>
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
                    <div className="flex justify-between items-center px-4 py-3 cursor-pointer">
                        <div>
                        <p className="font-bold text-lg">₹{order.totalAmount.toFixed(0)}</p>
                        <p className="text-xs text-muted-foreground">
                            {order.items.length} items
                        </p>
                        </div>
                        <Button className="rounded-full px-6">
                        <Receipt className="mr-2 h-4 w-4" />
                        View Bill
                        </Button>
                    </div>
                </div>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] flex flex-col">
                <LiveBillSheet storeId={storeId} sessionId={sessionId} />
            </SheetContent>
         </Sheet>
       )}
      </div>
  );
}
