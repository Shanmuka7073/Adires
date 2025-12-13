'use client';

export const storeOrdersCodeText = [
    {
        path: 'src/app/dashboard/owner/orders/page.tsx',
        content: `
'use client';

import { Order, Store } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader,
  AlertDialogTitle, AlertDialogDescription, AlertDialogFooter
} from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';

import {
  CookingPot,
  Truck,
  CheckCircle,
  AlertTriangle,
  Store as StoreIcon
} from 'lucide-react';

import {
  collection, query, where, orderBy, doc, writeBatch
} from 'firebase/firestore';

import { useFirebase, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { format } from 'date-fns';
import { getStores } from '@/lib/data';

const STATUS_META: Record<string, any> = {
  Pending: { icon: AlertTriangle, variant: 'secondary' },
  Processing: { icon: CookingPot, variant: 'secondary' },
  'Out for Delivery': { icon: Truck, variant: 'outline' },
  Delivered: { icon: 'default', icon: CheckCircle },
  Cancelled: { icon: 'destructive', icon: AlertTriangle },
};

/* ---------------- ORDER DETAILS DIALOG ---------------- */

function OrderDetailsDialog({ order, onClose }: { order: Order | null; onClose: () => void }) {
  if (!order) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Order #\\${order.id.slice(0, 6)}</DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4">
            {order.items?.map((item, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>\\${item.productName} × \\${item.quantity}</span>
                <span>₹\\${item.price.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t pt-2 font-bold text-right">
              Total: ₹\\${order.totalAmount.toFixed(2)}
            </div>
            <div className="text-sm text-muted-foreground">
              \\${order.deliveryAddress}
            </div>
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- ORDER CARD ---------------- */

function OrderCard({
  order,
  onStatusChange,
  onView,
  isUpdating,
}: any) {
  const meta = STATUS_META[order.status];
  const Icon = meta.icon;

  return (
    <Card className="relative">
      <CardContent className="p-4 space-y-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-semibold">Order #\\${order.id.slice(0, 6)}</p>
            <p className="text-sm text-muted-foreground flex gap-1 items-center">
              <StoreIcon className="h-4 w-4" /> \\${order.storeName}
            </p>
            <p className="text-xs text-muted-foreground">
              \\${format(order.orderDate.seconds * 1000, 'PPP p')}
            </p>
          </div>

          <div className="text-right space-y-1">
            <Badge variant={meta.variant} className="flex gap-1 items-center">
              <Icon className="h-3 w-3" /> \\${order.status}
            </Badge>
            <p className="font-bold">₹\\${order.totalAmount.toFixed(2)}</p>
          </div>
        </div>

        <div className="flex gap-2 justify-between items-center">
          <Select
            defaultValue={order.status}
            onValueChange={(v) => onStatusChange(order.id, v)}
            disabled={isUpdating || ['Delivered', 'Cancelled'].includes(order.status)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.keys(STATUS_META).map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" size="sm" onClick={onView}>
            View Details
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/* ---------------- MAIN PAGE ---------------- */

export default function LiveOrdersPage() {
  const { firestore, user } = useFirebase();
  const { toast } = useToast();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isUpdating, startTransition] = useTransition();
  const prevOrders = useRef<Map<string, Order>>(new Map());

  const storeQuery = useMemoFirebase(() =>
    firestore && user
      ? query(collection(firestore, 'stores'), where('ownerId', '==', user.uid))
      : null,
    [firestore, user]
  );

  const { data: myStores } = useCollection<Store>(storeQuery);
  const myStore = myStores?.[0];

  const ordersQuery = useMemoFirebase(() =>
    firestore && myStore
      ? query(
          collection(firestore, 'orders'),
          where('storeId', '==', myStore.id),
          orderBy('orderDate', 'desc')
        )
      : null,
    [firestore, myStore]
  );

  const { data: orders } = useCollection<Order>(ordersQuery);

  useEffect(() => {
    if (firestore) getStores(firestore).then(setStores);
  }, [firestore]);

  const ordersWithStores = useMemo(() => {
    if (!orders) return [];
    const map = new Map(stores.map(s => [s.id, s.name]));
    return orders.map(o => ({ ...o, storeName: map.get(o.storeId) || 'Store' }));
  }, [orders, stores]);

  const grouped = useMemo(() => ({
    pending: ordersWithStores.filter(o => o.status === 'Pending'),
    active: ordersWithStores.filter(o =>
      ['Processing', 'Out for Delivery'].includes(o.status)
    ),
    done: ordersWithStores.filter(o =>
      ['Delivered', 'Cancelled'].includes(o.status)
    ),
  }), [ordersWithStores]);

  const updateStatus = (id: string, status: Order['status']) => {
    if (!firestore) return;

    startTransition(async () => {
      try {
        await writeBatch(firestore)
          .update(doc(firestore, 'orders', id), { status })
          .commit();
        toast({ title: \`Order marked as \${status}\` });
      } catch (e) {
        errorEmitter.emit('permission-error',
          new FirestorePermissionError({
            path: \`orders/\${id}\`,
            operation: 'update',
            requestResourceData: { status },
          })
        );
      }
    });
  };

  return (
    <div className="container mx-auto max-w-5xl py-10 space-y-10">

      <h1 className="text-4xl font-bold">Live Orders</h1>

      {/* NEW ORDERS */}
      {grouped.pending.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-destructive">New Orders</h2>
          {grouped.pending.map(o => (
            <OrderCard
              key={o.id}
              order={o}
              onStatusChange={updateStatus}
              onView={() => setSelectedOrder(o)}
              isUpdating={isUpdating}
            />
          ))}
        </section>
      )}

      {/* ACTIVE */}
      {grouped.active.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold">In Progress</h2>
          {grouped.active.map(o => (
            <OrderCard
              key={o.id}
              order={o}
              onStatusChange={updateStatus}
              onView={() => setSelectedOrder(o)}
              isUpdating={isUpdating}
            />
          ))}
        </section>
      )}

      {/* COMPLETED */}
      {grouped.done.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold text-muted-foreground">Completed</h2>
          {grouped.done.map(o => (
            <OrderCard
              key={o.id}
              order={o}
              onStatusChange={updateStatus}
              onView={() => setSelectedOrder(o)}
              isUpdating
            />
          ))}
        </section>
      )}

      <OrderDetailsDialog
        order={selectedOrder}
        onClose={() => setSelectedOrder(null)}
      />
    </div>
  );
}
`,
    },
];
