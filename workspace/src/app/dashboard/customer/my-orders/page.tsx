'use client';

import { useFirebase, errorEmitter, useCollection, useMemoFirebase } from '@/firebase';
import { Order, Store } from '@/lib/types';
import {
  Card, CardContent, CardHeader, CardTitle, CardDescription
} from '@/components/ui/card';
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import {
  Store as StoreIcon,
  CheckCircle,
  AlertTriangle,
  Truck,
  CookingPot,
  Receipt,
  Package,
  Check,
  Loader2,
  ShoppingBag,
  History
} from 'lucide-react';
import Link from 'next/link';
import {
  collection, query, where, orderBy, Timestamp,
  limit
} from 'firebase/firestore';
import { useEffect, useMemo, useState } from 'react';
import { getStores } from '@/lib/data';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/lib/store';

const statusMeta: Record<string, any> = {
  Pending: { color: 'secondary', icon: CookingPot, step: 1, label: 'Received' },
  Processing: { color: 'secondary', icon: CookingPot, step: 2, label: 'Kitchen' },
  'Out for Delivery': { color: 'outline', icon: Truck, step: 3, label: 'On the way' },
  Billed: { color: 'default', icon: Receipt, step: 3, label: 'Ready' },
  Delivered: { color: 'default', icon: CheckCircle, step: 4, label: 'Delivered' },
  Completed: { color: 'default', icon: CheckCircle, step: 4, label: 'Completed' },
  Cancelled: { color: 'destructive', icon: AlertTriangle, step: 0, label: 'Cancelled' },
};

function OrderStatusTimeline({ status, theme }: { status: Order['status'], theme?: any }) {
    const meta = statusMeta[status] || statusMeta.Pending;
    const currentStep = meta.step;

    if (status === 'Cancelled') return (
        <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-xl border border-red-100 text-xs font-bold uppercase">
            <AlertTriangle className="h-4 w-4" /> This order was cancelled
        </div>
    );

    const steps = [
        { label: 'Received', icon: Package, s: 1 },
        { label: 'Kitchen', icon: CookingPot, s: 2 },
        { label: 'Ready', icon: Receipt, s: 3 },
        { label: 'Served', icon: Check, s: 4 },
    ];

    return (
        <div className="relative pt-2 pb-6 px-2">
            <div className="flex justify-between items-center relative z-10">
                {steps.map((step, idx) => {
                    const isActive = currentStep >= step.s;
                    const isNext = currentStep + 1 === step.s;
                    return (
                        <div key={idx} className="flex flex-col items-center gap-2">
                            <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center border-2 transition-all duration-500",
                                isActive ? "bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-110" : "bg-white border-gray-200 text-gray-300",
                                isNext && "animate-pulse border-primary text-primary"
                            )}>
                                <step.icon className="h-5 w-5" />
                            </div>
                            <span className={cn("text-[9px] font-black uppercase tracking-widest transition-colors", isActive ? "text-primary" : "text-gray-300")}>{step.label}</span>
                        </div>
                    )
                })}
            </div>
            <div className="absolute top-[28px] left-[10%] right-[10%] h-0.5 bg-gray-100 -z-0">
                <div 
                    className="h-full bg-primary transition-all duration-1000 ease-in-out" 
                    style={{ width: `${Math.min(100, Math.max(0, (currentStep - 1) * 33.33))}%` }}
                />
            </div>
        </div>
    );
}

export default function MyOrdersPage() {
  const { user, isUserLoading, firestore } = useFirebase();
  const { deviceId, stores, fetchInitialData } = useAppStore();
  const { toast } = useToast();
  
  // 1. DUAL QUERY STRATEGY: User ID or Device ID
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore) return null;
    const identifier = user?.uid || deviceId;
    if (!identifier) return null;

    return query(
        collection(firestore, 'orders'),
        // If logged in, filter by userId. If guest, filter by deviceId.
        where(user?.uid ? 'userId' : 'deviceId', '==', identifier),
        orderBy('orderDate', 'desc'),
        limit(50)
    );
  }, [firestore, user?.uid, deviceId]);

  const { data: allOrders, isLoading: ordersLoading, error: ordersError } = useCollection<Order>(ordersQuery);

  useEffect(() => {
    if(firestore) fetchInitialData(firestore, user?.uid);
  }, [firestore, fetchInitialData, user?.uid]);
  
  const ordersWithStores = useMemo(() => {
    if (!allOrders || stores.length === 0) return [];
    const storeMap = new Map(stores.map(s => [s.id, s.name]));
    return allOrders.map(order => ({
        ...order,
        storeName: storeMap.get(order.storeId) || 'Verified Store'
    }));
  }, [allOrders, stores]);

  const formatDate = (date: any) => {
    if (!date) return '—';
    const jsDate = date instanceof Timestamp ? date.toDate() : new Date(date);
    return format(jsDate, 'p, PPP');
  }

  if (isUserLoading || ordersLoading) return <div className="p-12 text-center"><Loader2 className="animate-spin mx-auto h-8 w-8 opacity-20" /></div>;

  return (
    <div className="container mx-auto py-12 px-4 md:px-6 max-w-2xl">
      <div className="mb-10 flex justify-between items-end">
        <div>
            <h1 className="text-4xl font-black font-headline tracking-tighter">My Activity</h1>
            <p className="text-muted-foreground font-bold text-xs uppercase tracking-widest opacity-60">
                {user ? 'Cloud History Secured' : 'Device History (Guest)'}
            </p>
        </div>
        {!user && (
            <Badge variant="outline" className="rounded-full border-primary/20 text-primary font-black uppercase text-[8px] tracking-widest px-3 py-1">
                <History className="h-3 w-3 mr-1.5" /> Local Access
            </Badge>
        )}
      </div>

      {ordersWithStores.length === 0 ? (
          <Card className="rounded-[2.5rem] border-0 shadow-xl p-12 text-center opacity-40">
              <ShoppingBag className="h-16 w-16 mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-sm">No orders yet</p>
              <Button asChild variant="link" className="mt-4"><Link href="/stores">Find a Hub</Link></Button>
          </Card>
      ) : (
        <div className="space-y-6">
            {ordersWithStores.map((order) => {
                const meta = statusMeta[order.status] || statusMeta.Pending;
                return (
                    <Card key={order.id} className="rounded-[2rem] border-0 shadow-lg overflow-hidden bg-white">
                        <div className="p-6 space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="flex items-center gap-2 text-primary">
                                        <StoreIcon className="h-4 w-4" />
                                        <h3 className="font-black uppercase text-sm tracking-tight">{order.storeName}</h3>
                                    </div>
                                    <p className="text-[10px] font-bold opacity-40 uppercase tracking-widest">{formatDate(order.orderDate)}</p>
                                </div>
                                <Badge variant={meta.color} className="rounded-md font-black uppercase text-[9px] tracking-widest px-2 py-0.5">{meta.label}</Badge>
                            </div>

                            {!['Completed', 'Delivered', 'Cancelled'].includes(order.status) && (
                                <OrderStatusTimeline status={order.status} />
                            )}

                            <Accordion type="single" collapsible className="w-full">
                                <AccordionItem value="items" className="border-0">
                                    <AccordionTrigger className="p-0 font-black uppercase text-[10px] tracking-widest opacity-40 hover:no-underline">View Details</AccordionTrigger>
                                    <AccordionContent className="pt-4">
                                        <div className="space-y-3">
                                            {order.items.map((it, idx) => (
                                                <div key={idx} className="flex justify-between text-xs font-bold text-gray-700">
                                                    <span>{it.productName} x{it.quantity}</span>
                                                    <span>₹{(it.price * it.quantity).toFixed(0)}</span>
                                                </div>
                                            ))}
                                            <div className="pt-3 border-t border-dashed space-y-3">
                                                <div className="flex justify-between items-baseline">
                                                    <span className="text-[9px] font-black uppercase opacity-40">Total</span>
                                                    <span className="text-lg font-black text-primary">₹{order.totalAmount.toFixed(2)}</span>
                                                </div>
                                                <div className="p-3 rounded-xl bg-muted/30 text-[10px] space-y-1">
                                                    <p className="font-black uppercase opacity-40">Delivery To:</p>
                                                    <p className="font-bold text-gray-600 leading-tight">{order.deliveryAddress}</p>
                                                </div>
                                            </div>
                                        </div>
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </Card>
                )
            })}
        </div>
      )}
    </div>
  );
}