
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  writeBatch,
  doc,
  orderBy,
  Timestamp,
} from 'firebase/firestore';

import type {
  Store,
  Menu,
  MenuItem,
  Order,
  OrderItem,
} from '@/lib/types';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
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
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

/* -------------------------------------------------------------------------- */
/*                               MENU ITEM DIALOG                             */
/* -------------------------------------------------------------------------- */

function MenuItemDialog({
  item,
  storeId,
  tableNumber,
  sessionId,
  onClose,
}: {
  item: MenuItem;
  storeId: string;
  tableNumber: string | null;
  sessionId: string;
  onClose: () => void;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [qty, setQty] = useState(1);
  const [saving, startSaving] = useTransition();

  const placeOrder = () => {
    if (!firestore) return;

    startSaving(async () => {
      const orderId = uuidv4();

      const orderItem: OrderItem = {
        productId: `${storeId}-${item.name.replace(/\s+/g, '-')}`,
        productName: item.name,
        quantity: qty,
        price: item.price,
        variantSku: `${item.name.replace(/\s+/g, '-')}-default`,
        variantWeight: '1 serving',
      };

      const order: Omit<Order, 'id'> & { id: string } = {
        id: orderId,
        storeId,
        sessionId,
        tableNumber: tableNumber ?? undefined,
        userId: 'guest',
        customerName: `Table ${tableNumber || 'Guest'}`,
        orderDate: Timestamp.now(),
        status: 'Pending',
        totalAmount: item.price * qty,
        items: [orderItem],
        deliveryAddress: '',
        deliveryLat: 0,
        deliveryLng: 0,
        phone: '',
        email: '',
      };

      try {
        await setDoc(doc(firestore, 'orders', orderId), order);

        toast({
          title: 'Order sent to kitchen!',
          description: `${qty} × ${item.name}`,
        });

        onClose();
      } catch (e) {
        console.error(e);
        toast({
          variant: 'destructive',
          title: 'Failed to add order',
          description: 'Could not send order to the kitchen.',
        });
      }
    });
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{item.name}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <Button size="icon" variant="outline" onClick={() => setQty(Math.max(1, qty - 1))}>
              <Minus />
            </Button>
            <Input value={qty} className="w-16 text-center" readOnly />
            <Button size="icon" variant="outline" onClick={() => setQty(qty + 1)}>
              <Plus />
            </Button>
          </div>

          <p className="text-2xl font-bold">₹{(item.price * qty).toFixed(2)}</p>
        </div>

        <Button className="w-full mt-4" onClick={placeOrder} disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Place Order
        </Button>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   LIVE BILL                                */
/* -------------------------------------------------------------------------- */

function LiveBill({ storeId, sessionId }: { storeId: string; sessionId: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [closing, startClose] = useTransition();

  const ordersQuery = useMemoFirebase(() =>
    firestore
      ? query(
          collection(firestore, 'orders'),
          where('storeId', '==', storeId),
          where('sessionId', '==', sessionId),
          orderBy('orderDate', 'asc')
        )
      : null,
  [firestore, storeId, sessionId]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const total = useMemo(
    () => orders?.reduce((s, o) => s + o.totalAmount, 0) ?? 0,
    [orders]
  );
  
  const isBilled = useMemo(() => orders?.some(o => o.status === 'Billed'), [orders]);
  const isCompleted = useMemo(() => orders?.every(o => o.status === 'Completed'), [orders]);

  const closeBill = () => {
    if (!firestore || !orders?.length) return;

    startClose(async () => {
      const batch = writeBatch(firestore);
      orders.forEach(o => {
        batch.update(doc(firestore, 'orders', o.id), { status: 'Billed' });
      });

      await batch.commit();
      toast({ title: 'Bill Closed', description: 'Notifying cashier. Please wait for payment confirmation.' });
    });
  };

  if (isCompleted) {
    return (
        <Card className="mt-6 bg-green-50 border-green-200">
            <CardHeader className="text-center">
                <Check className="mx-auto h-12 w-12 text-green-500" />
                <CardTitle className="text-green-700">Thank You!</CardTitle>
                 <p className="text-sm text-green-600">Your payment has been confirmed. Please visit again!</p>
            </CardHeader>
        </Card>
    )
  }

  if (isLoading && (!orders || orders.length === 0)) {
    return <div className="text-center text-muted-foreground py-4">Loading your bill...</div>;
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt /> Live Bill
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!orders?.length ? (
          <p className="text-muted-foreground text-center">No orders yet. Add an item to start a bill.</p>
        ) : (
          <>
            {orders.map((o, i) => (
              <div key={o.id} className="border-b py-2">
                <p className="text-sm font-semibold text-muted-foreground">Order {i + 1} at {format(new Date(o.orderDate.seconds * 1000), 'p')}</p>
                {o.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{it.productName} × {it.quantity}</span>
                    <span>₹{(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ))}

            <div className="flex justify-between font-bold mt-3 text-lg">
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
            
            <div className="mt-4">
              {isBilled ? (
                <Button className="w-full" disabled>
                  <Clock className="mr-2 h-4 w-4 animate-spin"/>
                  Waiting for payment confirmation...
                </Button>
              ) : (
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" variant="destructive">
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
          </>
        )}
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

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const key = `session_${storeId}_${tableNumber}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = uuidv4();
      sessionStorage.setItem(key, id);
    }
    setSessionId(id);
  }, [storeId, tableNumber]);

  const storeQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'stores'), where('__name__', '==', storeId)) : null,
  [firestore, storeId]);

  const menuQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null,
  [firestore, storeId]);

  const { data: stores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);

  const store = stores?.[0];
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
    <>
      {selectedItem && (
        <MenuItemDialog
          item={selectedItem}
          storeId={storeId}
          tableNumber={tableNumber}
          sessionId={sessionId}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <div className="p-4 space-y-6">
        <h1 className="text-3xl font-bold">{store.name}</h1>
        {tableNumber && <Badge>Table {tableNumber}</Badge>}

        {sessionId && <LiveBill storeId={storeId} sessionId={sessionId} />}

        {Object.entries(groupedMenu).map(([category, items]) => (
            <div key={category}>
                <h2 className="font-bold text-xl mt-4 mb-2 flex items-center gap-2">
                    <Utensils className="h-5 w-5 text-muted-foreground"/> 
                    {category}
                </h2>
                <div className="space-y-2">
                    {items.map(item => (
                        <Button
                            key={item.name}
                            className="w-full flex justify-between h-auto py-3"
                            variant="outline"
                            onClick={() => setSelectedItem(item)}
                        >
                            <span className="text-left">{item.name}</span>
                            <span className="font-semibold">₹{item.price}</span>
                        </Button>
                    ))}
                </div>
            </div>
        ))}
      </div>
    </>
  );
}
