
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

import {
  Utensils,
  Receipt,
  Loader2,
  Plus,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { addRestaurantOrderItem } from '@/app/actions';
import { useInstall } from '@/components/install-provider';

/* -------------------------------------------------------------------------- */
/*                               LIVE BILL BAR                                */
/* -------------------------------------------------------------------------- */

function LiveBillBar({ storeId, sessionId }: { storeId: string; sessionId: string }) {
  const { firestore } = useFirebase();
  const orderId = `${storeId}_${sessionId}`;

  const orderRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'orders', orderId) : null),
    [firestore, orderId]
  );

  const { data: order } = useDoc<Order>(orderRef);

  if (!order || !order.items?.length) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
      <div className="flex justify-between items-center px-4 py-3">
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
    [firestore, storeId]
  );

  const menuQuery = useMemoFirebase(
    () => (firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null),
    [firestore, storeId]
  );

  const { data: store, isLoading: storeLoading } = useDoc<Store>(storeRef);
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);

  const menu = menus?.[0];

  const groupedMenu = useMemo(() => {
    if (!menu?.items) return {};
    return menu.items.reduce((acc, item) => {
      const cat = item.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menu]);

  /* ---------------- ACTION ---------------- */
  const addItem = (item: MenuItem) => {
    startAdding(async () => {
      const res = await addRestaurantOrderItem({
        storeId,
        sessionId,
        tableNumber: tableNumber || null,
        item,
        quantity: 1,
      });

      if (res.success) {
        toast({ title: `${item.name} added` });
      } else {
        toast({ variant: 'destructive', title: 'Failed to add item' });
      }
    });
  };

  /* ---------------- LOADING ---------------- */
  if (storeLoading || menuLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!store || !menu) {
    return <div className="p-4 text-center">Menu not available</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">

      {/* ---------------- HEADER ---------------- */}
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

      {/* ---------------- MENU ---------------- */}
      <main className="p-4 space-y-6">
        {Object.entries(groupedMenu).map(([category, items]) => (
          <section key={category}>
            <h2 className="text-sm font-bold uppercase text-muted-foreground mb-2">
              {category}
            </h2>

            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.name}
                  className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center"
                >
                  <div>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ₹{item.price}
                    </p>
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
          </section>
        ))}
      </main>

      {/* ---------------- LIVE BILL ---------------- */}
      {sessionId && (
        <LiveBillBar storeId={storeId} sessionId={sessionId} />
      )}
    </div>
  );
}
