
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  setDoc,
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { addRestaurantOrderItem } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import type { Timestamp } from 'firebase/firestore';

/* -------------------------------------------------------------------------- */
/*                                   LIVE BILL                                */
/* -------------------------------------------------------------------------- */

function LiveBill({ storeId, sessionId }: { storeId: string; sessionId: string }) {
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
    return <Loader2 className="animate-spin mx-auto" />;
  }
  
  if (!order || !order.items?.length) {
      return (
          <Card className="mt-6 bg-muted/50">
              <CardHeader>
                   <CardTitle className="flex items-center gap-2 text-lg">
                      <Receipt /> Live Bill
                    </CardTitle>
              </CardHeader>
              <CardContent>
                  <p className="text-muted-foreground text-center py-4">No items added to your bill yet.</p>
              </CardContent>
          </Card>
      )
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt /> Live Bill
        </CardTitle>
      </CardHeader>

      <CardContent>
            {order.items.map((it, idx) => (
              <div key={idx} className="border-b py-2 flex justify-between text-sm">
                <span className="font-medium">{it.productName} <span className="text-muted-foreground">x{it.quantity}</span></span>
                <span>₹{(it.price * it.quantity).toFixed(2)}</span>
              </div>
            ))}

            <div className="flex justify-between font-bold mt-3 text-xl">
              <span>Total</span>
              <span>₹{order.totalAmount.toFixed(2)}</span>
            </div>
            
            <div className="mt-4">
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
      </CardContent>
    </Card>
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
  const { canInstall, triggerInstall } = useInstall();

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

  return (
    <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto py-8 px-4 md:px-6">
          <Card className="max-w-2xl mx-auto shadow-lg">
            <CardHeader className="text-center">
                 {store.imageUrl && (
                    <Image
                      src={store.imageUrl}
                      alt={store.name}
                      width={128}
                      height={128}
                      className="mx-auto rounded-full border-4 border-white shadow-md -mt-16"
                    />
                  )}
                <div className="flex items-center justify-center gap-2 mt-4">
                    <Utensils className="h-8 w-8 text-primary" />
                    <CardTitle className="text-3xl font-bold font-headline">{store.name}</CardTitle>
                </div>
                {tableNumber && <Badge className="mx-auto mt-2">Table {tableNumber}</Badge>}
                 {canInstall && (
                  <div className="pt-4">
                    <Button onClick={triggerInstall} size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Add {store.name} to Home Screen
                    </Button>
                  </div>
                 )}
            </CardHeader>
            <CardContent className="space-y-6">
                {sessionId && <LiveBill storeId={storeId} sessionId={sessionId} />}

                {Object.entries(groupedMenu).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                    <div key={category}>
                        <h2 className="text-xl font-semibold mb-3 border-b pb-2 tracking-widest uppercase text-muted-foreground">{category}</h2>
                        <div className="space-y-2">
                            {items.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => handleAddItem(item)}
                                    disabled={isAdding}
                                    className="w-full flex justify-between items-center py-2 text-left hover:bg-muted/50 rounded-md px-2 transition-colors disabled:opacity-50"
                                >
                                    <p className="font-medium text-gray-800">{item.name}</p>
                                    <p className="font-semibold text-gray-600">₹{item.price.toFixed(2)}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
