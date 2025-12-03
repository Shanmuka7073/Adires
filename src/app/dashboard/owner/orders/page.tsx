
'use client';

import { useFirebase, errorEmitter, FirestorePermissionError, useCollection, useMemoFirebase } from '@/firebase';
import { Order, Store } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format, parseISO } from 'date-fns';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { collection, query, where, orderBy, doc, writeBatch, increment } from 'firebase/firestore';
import { useState, useEffect, useMemo, useRef, useTransition } from 'react';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle, Store as StoreIcon, AlertTriangle } from 'lucide-react';
import { getStores } from '@/lib/data';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogAction, AlertDialogCancel } from '@/components/ui/alert-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const DELIVERY_FEE = 30;

const playAlarm = () => {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (!audioContext) return;
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(880, audioContext.currentTime); // A5 note
    gainNode.gain.setValueAtTime(0.5, audioContext.currentTime);
    
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 1); // Play for 1 second
};


function OrderRow({ order, onStatusChange, onShowDetails, isUpdating }: { order: Order; onStatusChange: (orderId: string, newStatus: Order['status']) => void; onShowDetails: () => void, isUpdating: boolean }) {
    
    const getStatusVariant = (status: string): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'Delivered': return 'default';
            case 'Processing': return 'secondary';
            case 'Out for Delivery': return 'outline';
            case 'Pending': return 'secondary';
            case 'Cancelled': return 'destructive';
            default: return 'secondary';
        }
    };
    
    const formatDate = (date: any) => {
        if (!date) return 'N/A';
        if (date.seconds) {
            return format(new Date(date.seconds * 1000), 'PPP p');
        }
        if (typeof date === 'string') {
            try {
                return format(parseISO(date), 'PPP p');
            } catch (e) {
                try {
                    return format(new Date(date), 'PPP p');
                } catch(e2) {
                    return 'Invalid Date';
                }
            }
        }
        if (date instanceof Date) {
            return format(date, 'PPP p');
        }
        return 'N/A';
    };

    return (
        <TableRow>
            <TableCell className="font-medium truncate max-w-[100px]">{order.id}</TableCell>
            <TableCell>{order.customerName}</TableCell>
            <TableCell>{formatDate(order.orderDate)}</TableCell>
            <TableCell>
                 <Select onValueChange={(newStatus) => onStatusChange(order.id, newStatus as Order['status'])} defaultValue={order.status} disabled={isUpdating || (order.status === 'Delivered' || order.status === 'Cancelled')}>
                    <SelectTrigger className="w-full md:w-[180px]">
                        <SelectValue placeholder="Update status" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Processing">Processing</SelectItem>
                        <SelectItem value="Out for Delivery">Out for Delivery</SelectItem>
                        <SelectItem value="Delivered">Delivered</SelectItem>
                        <SelectItem value="Cancelled">Cancelled</SelectItem>
                    </SelectContent>
                </Select>
            </TableCell>
            <TableCell className="text-right">₹{order.totalAmount.toFixed(2)}</TableCell>
            <TableCell className="text-right">
                <Button variant="outline" size="sm" onClick={onShowDetails}>
                    View Details
                </Button>
            </TableCell>
        </TableRow>
    );
}

export default function MyOrdersPage() {
  const { user, isUserLoading, firestore } = useFirebase();
  const { toast } = useToast();
  const [isUpdating, startUpdateTransition] = useTransition();
  const [stores, setStores] = useState<Store[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [newOrderAlert, setNewOrderAlert] = useState<Order | null>(null);
  
  const ownerStoreQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
        collection(firestore, 'stores'),
        where('ownerId', '==', user.uid),
    );
  }, [firestore, user?.uid]);
  const { data: myStores, isLoading: storesLoading } = useCollection<Store>(ownerStoreQuery);
  const myStore = myStores?.[0];
  
  const ordersQuery = useMemoFirebase(() => {
    if (!firestore || !myStore?.id) return null;
    return query(
        collection(firestore, 'orders'),
        where('storeId', '==', myStore.id),
        orderBy('orderDate', 'desc')
    );
  }, [firestore, myStore?.id]);

  const { data: allOrders, isLoading: ordersLoading, error: ordersError } = useCollection<Order>(ordersQuery);

  const prevOrdersRef = useRef<Map<string, Order>>(new Map());

  useEffect(() => {
    if(firestore) {
      getStores(firestore).then(setStores);
    }
  }, [firestore]);
  
  const ordersWithStores = useMemo(() => {
    if (!allOrders || stores.length === 0) return [];
    const storeMap = new Map(stores.map(s => [s.id, s.name]));
    return allOrders.map(order => ({
        ...order,
        storeName: storeMap.get(order.storeId) || 'Unknown Store'
    }));
  }, [allOrders, stores]);

  useEffect(() => {
    if (ordersWithStores && ordersWithStores.length > 0) {
      const currentOrdersMap = new Map(ordersWithStores.map(order => [order.id, order]));
      
      currentOrdersMap.forEach((currentOrder, orderId) => {
        const prevOrder = prevOrdersRef.current.get(orderId);
        
        if (!prevOrder && currentOrder.status === 'Pending') {
          if (currentOrder.storeId === myStore?.id) {
            setNewOrderAlert(currentOrder);
            playAlarm();
          }
        }
        else if (prevOrder && prevOrder.status !== currentOrder.status) {
          const toastMessage = `Your order #${currentOrder.id.substring(0, 7)} is now "${currentOrder.status}".`;
          toast({
            title: "Order Status Updated",
            description: toastMessage,
          });
          
          if (currentOrder.status === 'Out for Delivery' || currentOrder.status === 'Delivered') {
            playAlarm();
          }
        }
      });

      prevOrdersRef.current = currentOrdersMap;
    }
  }, [ordersWithStores, toast, myStore?.id]);

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    if (!firestore || !user?.uid) {
        toast({ variant: 'destructive', title: 'Error', description: 'Could not update status. Not authenticated.' });
        return;
    }

    startUpdateTransition(async () => {
        const orderRef = doc(firestore, 'orders', orderId);
        try {
            await writeBatch(firestore).update(orderRef, { status: newStatus }).commit();
            toast({
                title: "Status Updated",
                description: `Order #${orderId.substring(0, 7)} marked as ${newStatus}.`
            });
            if (newOrderAlert?.id === orderId) {
                setNewOrderAlert(null);
            }
        } catch (error) {
            console.error("Failed to update status:", error);
            const permissionError = new FirestorePermissionError({
                path: orderRef.path,
                operation: 'update',
                requestResourceData: { status: newStatus },
            });
            errorEmitter.emit('permission-error', permissionError);
        }
    });
  };

  const handleAlertAction = (action: 'accept' | 'reject') => {
    if (!newOrderAlert) return;
    const newStatus = action === 'accept' ? 'Processing' : 'Cancelled';
    handleStatusChange(newOrderAlert.id, newStatus);
  };
  
  const effectiveLoading = isUserLoading || storesLoading || ordersLoading;

  const renderContent = () => {
    if (effectiveLoading) {
      return <p>Loading your orders...</p>;
    }
    if (ordersError) {
        return (
             <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Could Not Load Orders</AlertTitle>
                <AlertDescription>
                    There was an error fetching your order history. This may be due to a temporary network issue or exceeded usage quotas. Please try again later.
                </AlertDescription>
            </Alert>
        )
    }
    if (!user) {
        return (
             <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">Please log in to see your orders.</p>
                <Button asChild>
                    <Link href="/login">Login</Link>
                </Button>
            </div>
        )
    }
     if (!myStore) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">You have not created a store yet.</p>
                <Button asChild>
                    <Link href="/dashboard/owner/my-store">Create Store</Link>
                </Button>
            </div>
        )
    }
     if (ordersWithStores.length === 0) {
        return (
            <div className="text-center py-12">
                <p className="text-muted-foreground mb-4">You haven't received any orders yet.</p>
            </div>
        )
    }
    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>Order ID</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {ordersWithStores.map(order => (
                    <OrderRow
                        key={order.id}
                        order={order}
                        onStatusChange={handleStatusChange}
                        onShowDetails={() => setSelectedOrder(order)}
                        isUpdating={isUpdating}
                    />
                ))}
            </TableBody>
        </Table>
    );
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
       <AlertDialog open={!!newOrderAlert}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>You Have a New Order!</AlertDialogTitle>
                  <AlertDialogDescription>
                      A new order has been placed by {newOrderAlert?.customerName}. Please review the details and accept or reject it.
                  </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="p-1">
                 {/* Simplified details for now */}
                 <p><strong>Customer:</strong> {newOrderAlert?.customerName}</p>
                 <p><strong>Total:</strong> ₹{newOrderAlert?.totalAmount.toFixed(2)}</p>
                 <p><strong>Address:</strong> {newOrderAlert?.deliveryAddress}</p>
              </div>
              <AlertDialogFooter>
                  <AlertDialogAction asChild>
                      <Button variant="destructive" onClick={() => handleAlertAction('reject')}>Reject Order</Button>
                  </AlertDialogAction>
                  <AlertDialogAction asChild>
                      <Button onClick={() => handleAlertAction('accept')}>Accept Order</Button>
                  </AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
       </AlertDialog>

       <OrderDetailsDialog order={selectedOrder} isOpen={!!selectedOrder} onClose={() => setSelectedOrder(null)} />

      <h1 className="text-4xl font-bold mb-8 font-headline">My Orders</h1>
      <Card>
        <CardHeader>
          <CardTitle>Your Store's Order History</CardTitle>
        </CardHeader>
        <CardContent>
            {renderContent()}
        </CardContent>
      </Card>
    </div>
  );
}

function OrderDetailsDialog({ order, isOpen, onClose }: { order: Order | null; isOpen: boolean; onClose: () => void; }) {
    if (!order) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Order Details</DialogTitle>
                    <DialogDescription>
                        ID: {order.id} | Placed by: {order.customerName}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <div className="grid gap-4 py-4 pr-6">
                        {order.items && order.items.length > 0 ? (
                           <Card>
                                <CardHeader><CardTitle className="text-lg">Order Items</CardTitle></CardHeader>
                                <CardContent>
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Item</TableHead>
                                                <TableHead>Qty</TableHead>
                                                <TableHead className="text-right">Price</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {order.items.map((item, index) => (
                                                <TableRow key={index}>
                                                    <TableCell>{item.productName}</TableCell>
                                                    <TableCell>{item.quantity}</TableCell>
                                                    <TableCell className="text-right">₹{item.price.toFixed(2)}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        ) : (
                            <p>No items listed for this order.</p>
                        )}
                    </div>
                </ScrollArea>
                <DialogFooter>
                    <Button variant="outline" onClick={onClose}>Close</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
