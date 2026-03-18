
'use client';

import { Order, Store, DeliveryPartner, Payout } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Check, Banknote, History, Landmark, Receipt, CreditCard, ChevronDown, ChevronUp, Route, Package, Bot, Info, Loader2, LocateFixed, RefreshCw } from 'lucide-react';
import { useFirebase, useCollection, useDoc, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, query, where, doc, updateDoc, Timestamp, increment, writeBatch, orderBy, setDoc, getDocs, limit, serverTimestamp } from 'firebase/firestore';
import { useEffect, useState, useMemo, useTransition, useCallback } from 'react';
import { getStores } from '@/lib/data';
import { useToast } from '@/hooks/use-toast';
import { format, formatDistanceToNow } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

const DELIVERY_FEE = 30;
const DELIVERY_PROXIMITY_THRESHOLD_KM = 1;

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

const openInGoogleMaps = (destLat: number, destLng: number, originLat?: number, originLng?: number) => {
    let url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}`;
    if (originLat && originLng) {
        url += `&origin=${originLat},${originLng}`;
    }
    window.open(url, '_blank');
};


const payoutDetailsSchema = z.object({
  payoutMethod: z.enum(['bank', 'upi']),
  upiId: z.string().optional(),
  accountHolderName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifscCode: z.string().optional(),
  pincode: z.string().regex(/^\d{6}$/, "Must be a 6-digit pincode"),
}).refine(data => {
    if (data.payoutMethod === 'upi') {
        return !!data.upiId && data.upiId.includes('@');
    }
    if (data.payoutMethod === 'bank') {
        return !!data.accountHolderName && !!data.accountNumber && !!data.ifscCode;
    }
    return false;
}, {
    message: "Please fill in all required fields for the selected payout method.",
    path: ['payoutMethod'],
});

type PayoutDetailsFormValues = z.infer<typeof payoutDetailsSchema>;

function OrderDetailsDialog({ order, isOpen, onClose, onAccept, distance }: { order: Order | null; isOpen: boolean; onClose: () => void; onAccept?: () => void; distance?: number; }) {
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
                         <Card>
                            <CardHeader><CardTitle className="text-lg">Delivery Details</CardTitle></CardHeader>
                            <CardContent className="text-sm space-y-4">
                                 <p><strong>Pickup:</strong> {order.store?.name} - {order.store?.address}</p>
                                 <p><strong>Drop-off:</strong> {order.customerName} - {order.deliveryAddress}</p>
                                 {distance !== undefined && (
                                     <div className="border-t pt-4 mt-4 flex items-center justify-between">
                                        <div className="font-bold">
                                            Total Distance: {distance.toFixed(2)} km
                                        </div>
                                         <Button
                                            variant="secondary"
                                            size="sm"
                                            onClick={() => openInGoogleMaps(order.deliveryLat, order.deliveryLng, order.store?.latitude, order.store?.longitude)}
                                        >
                                            <Route className="mr-2 h-4 w-4" />
                                            View Route on Map
                                        </Button>
                                     </div>
                                 )}
                            </CardContent>
                        </Card>
                    </div>
                </ScrollArea>
                <DialogFooter className="gap-2 sm:gap-0">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    {onAccept && <Button onClick={onAccept}>Accept Job & Confirm Pickup</Button>}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PayoutSettingsCard({ partnerData, isLoading, partnerId }: { partnerData: DeliveryPartner | null, isLoading: boolean, partnerId: string }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isSaving, startSaveTransition] = useTransition();
    const [isEditing, setIsEditing] = useState(false);

    const form = useForm<PayoutDetailsFormValues>({
        resolver: zodResolver(payoutDetailsSchema),
        defaultValues: {
            payoutMethod: partnerData?.payoutMethod || 'bank',
            upiId: partnerData?.upiId || '',
            accountHolderName: partnerData?.bankDetails?.accountHolderName || '',
            accountNumber: partnerData?.bankDetails?.accountNumber || '',
            ifscCode: partnerData?.bankDetails?.ifscCode || '',
            pincode: partnerData?.zoneId?.replace('zone-', '') || '',
        }
    });
    
    const watchPayoutMethod = form.watch('payoutMethod');

    useEffect(() => {
        if (!isLoading && partnerData) {
            form.reset({
                payoutMethod: partnerData.payoutMethod || 'bank',
                upiId: partnerData.upiId || '',
                accountHolderName: partnerData.bankDetails?.accountHolderName || '',
                accountNumber: partnerData.bankDetails?.accountNumber || '',
                ifscCode: partnerData.bankDetails?.ifscCode || '',
                pincode: partnerData.zoneId?.replace('zone-', '') || '',
            });
        }
    }, [partnerData, form, isLoading, isEditing]);


    const onSubmit = (data: PayoutDetailsFormValues) => {
        if (!firestore || !partnerId) return;

        const updateData: Partial<DeliveryPartner> = {
            payoutMethod: data.payoutMethod,
            upiId: data.payoutMethod === 'upi' ? data.upiId : '',
            bankDetails: data.payoutMethod === 'bank' ? {
                accountHolderName: data.accountHolderName!,
                accountNumber: data.accountNumber!,
                ifscCode: data.ifscCode!,
            } : { accountHolderName: '', accountNumber: '', ifscCode: '' },
            zoneId: `zone-${data.pincode}`, 
        };
        
        const partnerRef = doc(firestore, 'deliveryPartners', partnerId);
        // NON-BLOCKING for offline resilience
        setDoc(partnerRef, updateData, { merge: true }).catch(error => {
            const permissionError = new FirestorePermissionError({
                path: partnerRef.path,
                operation: 'update',
                requestResourceData: updateData,
            });
            errorEmitter.emit('permission-error', permissionError);
        });
        
        toast({ title: "Profile saved!", description: "Your payment and zone information has been updated." });
        setIsEditing(false);
    };
    
    const hasDetails = partnerData?.zoneId;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Landmark className="h-6 w-6 text-primary" />
                    <span>Delivery Profile & Payouts</span>
                </CardTitle>
                <CardDescription>Set your service area (pincode) and payment details.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <p>Loading settings...</p> : (
                    !isEditing && hasDetails ? (
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium">Service Zone</p>
                                <p className="text-lg font-bold text-primary">{partnerData.zoneId?.replace('zone-', '') || 'Global'}</p>
                            </div>
                            {partnerData.payoutMethod === 'upi' ? (
                                <div>
                                    <p className="text-sm font-medium">UPI ID</p>
                                    <p className="text-lg font-mono bg-muted/50 p-2 rounded-md">{partnerData.upiId}</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <p className="text-sm font-medium">Bank Account</p>
                                    <div className="text-lg bg-muted/50 p-3 rounded-md text-sm space-y-1 font-mono">
                                        <p><strong>Holder:</strong> {partnerData.bankDetails?.accountHolderName}</p>
                                        <p><strong>A/C No:</strong> {partnerData.bankDetails?.accountNumber}</p>
                                        <p><strong>IFSC:</strong> {partnerData.bankDetails?.ifscCode}</p>
                                    </div>
                                </div>
                            )}
                            <Button variant="outline" onClick={() => setIsEditing(true)}>Edit Profile</Button>
                        </div>
                    ) : (
                         <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField control={form.control} name="pincode" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Your Service Area (Pincode)</FormLabel>
                                        <FormControl><Input placeholder="e.g. 500001" {...field} /></FormControl>
                                        <FormDescription>You will only see pending orders in this zone.</FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField
                                    control={form.control}
                                    name="payoutMethod"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel>Payout Method</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                                        <FormControl><RadioGroupItem value="bank" /></FormControl>
                                                        <FormLabel className="font-normal">Bank Account</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-3 space-y-0">
                                                        <FormControl><RadioGroupItem value="upi" /></FormControl>
                                                        <FormLabel className="font-normal">UPI</FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                
                                {watchPayoutMethod === 'upi' && (
                                    <FormField control={form.control} name="upiId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>UPI ID</FormLabel>
                                            <FormControl><Input placeholder="yourname@bank" {...field} /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}

                                {watchPayoutMethod === 'bank' && (
                                    <div className="space-y-4">
                                        <FormField control={form.control} name="accountHolderName" render={({ field }) => (
                                            <FormItem><FormLabel>Account Holder Name</FormLabel><FormControl><Input placeholder="John Doe" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="accountNumber" render={({ field }) => (
                                            <FormItem><FormLabel>Account Number</FormLabel><FormControl><Input placeholder="1234567890" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                         <FormField control={form.control} name="ifscCode" render={({ field }) => (
                                            <FormItem><FormLabel>IFSC Code</FormLabel><FormControl><Input placeholder="SBIN0001234" {...field} /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                )}
                                <div className="flex gap-2">
                                     <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Save Profile'}</Button>
                                     {hasDetails && <Button variant="ghost" onClick={() => setIsEditing(false)}>Cancel</Button>}
                                </div>
                            </form>
                         </Form>
                    )
                )}
            </CardContent>
        </Card>
    );
}

function PayoutCard({ partnerData, isLoading, onPayout }: { partnerData: DeliveryPartner | null, isLoading: boolean, onPayout: () => void }) {
    const totalEarnings = partnerData?.totalEarnings || 0;
    const hasPayoutDetails = partnerData && (partnerData.bankDetails?.accountNumber || partnerData.upiId);

    return (
        <Card className="bg-primary/5">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Banknote className="h-6 w-6 text-primary" />
                    <span>Earnings & Payouts</span>
                </CardTitle>
                <CardDescription>
                    Your current withdrawable balance. Payout requests are processed within 24 hours.
                </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="text-center md:text-left">
                    <p className="text-sm text-muted-foreground">Current Balance</p>
                    {isLoading ? (
                        <p className="text-3xl font-bold">Loading...</p>
                    ) : (
                        <p className="text-3xl font-bold">₹{totalEarnings.toFixed(2)}</p>
                    )}
                </div>
                <Button
                    size="lg"
                    onClick={onPayout}
                    disabled={isLoading || totalEarnings <= 0 || !hasPayoutDetails}
                    title={!hasPayoutDetails ? "Please set up your payout details first" : ""}
                >
                    Request Payout
                </Button>
            </CardContent>
        </Card>
    )
}

function PayoutHistoryCard({ partnerId }: { partnerId: string }) {
    const { firestore } = useFirebase();

    const payoutsQuery = useMemoFirebase(() => {
        if (!firestore || !partnerId) return null;
        return query(
            collection(firestore, `deliveryPartners/${partnerId}/payouts`),
            orderBy('requestDate', 'desc')
        );
    }, [firestore, partnerId]);

    const { data: payouts, isLoading } = useCollection<Payout>(payoutsQuery);
    
    const getStatusVariant = (status: Payout['status']): "default" | "secondary" | "destructive" | "outline" => {
        switch (status) {
            case 'completed': return 'default';
            case 'pending': return 'secondary';
            case 'failed': return 'destructive';
            default: return 'outline';
        }
    }

    const formatDateSafe = (date: any) => {
        if (!date) return 'N/A';
        const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        return `${format(jsDate, 'PPP')} (${formatDistanceToNow(jsDate, { addSuffix: true })})`
    }

    return (
         <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <History className="h-6 w-6 text-primary" />
                    <span>Payout History</span>
                </CardTitle>
                <CardDescription>A record of all your payout requests.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? <p>Loading payout history...</p> : 
                !payouts || payouts.length === 0 ? <p className="text-muted-foreground">You have not requested any payouts yet.</p> : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Amount</TableHead>
                                <TableHead className="text-right">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payouts.map((payout) => (
                                <TableRow key={payout.id}>
                                    <TableCell>{formatDateSafe(payout.requestDate)}</TableCell>
                                    <TableCell className="font-medium">₹{payout.amount.toFixed(2)}</TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={getStatusVariant(payout.status)}>{payout.status}</Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}

function MyActiveDeliveriesCard({ order, handleMarkAsDelivered, onShowDetails }: { order: Order, handleMarkAsDelivered: (order: Order) => void, onShowDetails: (order: Order) => void }) {
    
    return (
        <Card key={order.id} className="p-4 space-y-4">
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-semibold">{order.customerName}</p>
                    <p className="text-sm text-muted-foreground">{order.deliveryAddress}</p>
                </div>
                <div className="flex flex-col gap-2">
                     <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openInGoogleMaps(order.deliveryLat, order.deliveryLng, order.store?.latitude, order.store?.longitude)}
                    >
                        <MapPin className="mr-2 h-4 w-4" />
                        Route
                    </Button>
                     <Button variant="secondary" size="sm" onClick={() => onShowDetails(order)}>Details</Button>
                </div>
            </div>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button 
                        className="w-full"
                        disabled={!order.deliveryLat || !order.deliveryLng}
                    >
                        <Check className="mr-2 h-4 w-4" />
                        Mark as Delivered
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Confirm Delivery</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to mark this order as delivered? This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleMarkAsDelivered(order)}>Confirm</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    )
}


export default function DeliveriesPage() {
  const { firestore, user } = useFirebase();
  const [stores, setStores] = useState<Store[]>([]);
  const { toast } = useToast();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedOrderDistance, setSelectedOrderDistance] = useState<number | undefined>(undefined);
  const [availableJobs, setAvailableJobs] = useState<Order[]>([]);
  const [availableLoading, setAvailableLoading] = useState(false);

  const partnerDocRef = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return doc(firestore, 'deliveryPartners', user.uid);
  }, [firestore, user?.uid]);
  const { data: partnerData, isLoading: partnerLoading } = useDoc<DeliveryPartner>(partnerDocRef);

  const myActiveDeliveriesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
        collection(firestore, 'orders'),
        where('status', '==', 'Out for Delivery'),
        where('deliveryPartnerId', '==', user.uid)
    );
  }, [firestore, user?.uid]);
  
  const { data: myActiveDeliveries, isLoading: activeDeliveriesLoading } = useCollection<Order>(myActiveDeliveriesQuery);

  const fetchAvailableJobs = useCallback(async () => {
    if (!firestore || !partnerData?.zoneId) return;
    setAvailableLoading(true);
    try {
        const q = query(
            collection(firestore, 'orders'),
            where('status', '==', 'Pending'),
            where('zoneId', '==', partnerData.zoneId),
            limit(20)
        );
        const snap = await getDocs(q);
        const jobs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Order));
        setAvailableJobs(jobs);
    } catch (e) {
        console.error("Failed to fetch jobs:", e);
    } finally {
        setAvailableLoading(false);
    }
  }, [firestore, partnerData?.zoneId]);

  useEffect(() => {
    fetchAvailableJobs();
    const interval = setInterval(fetchAvailableJobs, 30000); // 30s refresh
    return () => clearInterval(interval);
  }, [fetchAvailableJobs]);

  const completedDeliveriesQuery = useMemoFirebase(() => {
    if (!firestore || !user?.uid) return null;
    return query(
      collection(firestore, 'orders'),
      where('status', '==', 'Delivered'),
      where('deliveryPartnerId', '==', user.uid)
    );
  }, [firestore, user?.uid]);

  const { data: completedDeliveries, isLoading: completedDeliveriesLoading } = useCollection<Order>(completedDeliveriesQuery);
  
  useEffect(() => {
    if (firestore) {
      getStores(firestore).then(setStores);
    }
  }, [firestore]);

  const joinStoresToOrders = (orders: Order[] | null) => {
    if (!orders || !stores.length) return [];
    return orders.map(order => {
      const store = stores.find(s => s.id === order.storeId);
      return { ...order, store };
    }).filter(order => order.store);
  };

  const myActiveDeliveriesWithStores = useMemo(() => joinStoresToOrders(myActiveDeliveries), [myActiveDeliveries, stores]);
  const availableDeliveriesWithStores = useMemo(() => joinStoresToOrders(availableJobs), [availableJobs, stores]);

  const handleConfirmPickup = (orderId: string) => {
    if (!firestore || !user?.uid) return;
     
    const orderRef = doc(firestore, 'orders', orderId);
    // NON-BLOCKING
    updateDoc(orderRef, { 
        deliveryPartnerId: user.uid,
        status: 'Out for Delivery',
        updatedAt: serverTimestamp()
    }).catch(error => {
         console.error("Failed to confirm pickup:", error);
         toast({ variant: 'destructive', title: "Accept Failed", description: "Could not accept the selected job."})
    });
    
    toast({
        title: `Job Accepted!`,
        description: `You are now assigned to deliver this order.`
    });
    fetchAvailableJobs();
  };

  const handleMarkAsDelivered = (order: Order) => {
    if (!navigator.geolocation) {
        toast({ variant: 'destructive', title: 'Geolocation Not Supported', description: "Cannot verify your location." });
        return;
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const { latitude: partnerLat, longitude: partnerLng } = position.coords;
            const distance = haversineDistance(partnerLat, partnerLng, order.deliveryLat, order.deliveryLng);

            if (distance > DELIVERY_PROXIMITY_THRESHOLD_KM) {
                toast({
                    variant: 'destructive',
                    title: 'Too Far Away',
                    description: `You must be within ${DELIVERY_PROXIMITY_THRESHOLD_KM * 1000} meters of the delivery location.`,
                });
                return;
            }

            if (!firestore || !user?.uid) return;

            const orderRef = doc(firestore, 'orders', order.id);
            const partnerRef = doc(firestore, 'deliveryPartners', user.uid);

            const batch = writeBatch(firestore);
            batch.update(orderRef, { status: 'Delivered', updatedAt: serverTimestamp() });
            batch.set(partnerRef, {
                totalEarnings: increment(DELIVERY_FEE),
                userId: user.uid,
                payoutsEnabled: true,
            }, { merge: true });

            // NON-BLOCKING
            batch.commit().catch(error => {
                console.error("Failed to mark as delivered:", error);
                toast({ variant: 'destructive', title: 'Update Failed', description: 'Could not update the order status.' });
            });

            toast({
                title: "Delivery Complete!",
                description: `₹${DELIVERY_FEE.toFixed(2)} added to your earnings.`
            });
        },
        (error) => {
            toast({ variant: 'destructive', title: 'Location Error', description: 'Could not get your current location.' });
        }
    );
  };

  const handlePayoutRequest = () => {
      if (!firestore || !user || !partnerData || partnerData.totalEarnings <= 0) return;
      
      const payoutAmount = partnerData.totalEarnings;
      const payoutDetails = partnerData.payoutMethod === 'upi' ? { upiId: partnerData.upiId } : { bankDetails: partnerData.bankDetails };

      const batch = writeBatch(firestore);
      const newPayoutRef = doc(collection(firestore, `deliveryPartners/${user.uid}/payouts`));
      batch.set(newPayoutRef, {
          id: newPayoutRef.id,
          amount: payoutAmount,
          partnerId: user.uid,
          requestDate: Timestamp.now(),
          status: 'pending',
          payoutMethod: partnerData.payoutMethod,
          payoutDetails: payoutDetails,
      });

      const partnerRef = doc(firestore, 'deliveryPartners', user.uid);
      batch.update(partnerRef, {
          totalEarnings: 0,
          lastPayoutDate: Timestamp.now(),
      });

      // NON-BLOCKING
      batch.commit().catch(error => {
          toast({ variant: 'destructive', title: 'Payout Failed', description: 'Error submitting request.' });
      });
      
      toast({ title: 'Payout Requested!', description: `Request for ₹${payoutAmount.toFixed(2)} submitted.` });
  };

  const handleOptimizedRoute = () => {
    if (!myActiveDeliveriesWithStores || myActiveDeliveriesWithStores.length === 0) return;
    const baseUrl = `https://www.google.com/maps/dir/`;
    const storeWaypoints = [...new Map(myActiveDeliveriesWithStores.map(order => [order.storeId, `Pickup:${order.store!.name}/${order.store!.latitude},${order.store!.longitude}`])).values()];
    const customerWaypoints = myActiveDeliveriesWithStores.map(order => `Drop-off:${order.customerName}/${order.deliveryLat},${order.deliveryLng}`);
    const allWaypoints = [...storeWaypoints, ...customerWaypoints];
    window.open(baseUrl + allWaypoints.join('/'), '_blank');
};

  const handleShowDetails = (order: Order) => {
    const distance = haversineDistance(order.store!.latitude, order.store!.longitude, order.deliveryLat, order.deliveryLng);
    setSelectedOrder(order);
    setSelectedOrderDistance(distance);
  }

  const isLoading = activeDeliveriesLoading || completedDeliveriesLoading || stores.length === 0;

  const formatDate = (date: any) => {
    if (!date) return 'N/A';
    const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
    return format(jsDate, 'PPP');
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6 space-y-12">
        {selectedOrder && (
             <OrderDetailsDialog 
                order={selectedOrder} 
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                distance={selectedOrderDistance}
             />
        )}
      <div className="grid md:grid-cols-2 gap-8">
        <PayoutCard partnerData={partnerData} isLoading={partnerLoading} onPayout={handlePayoutRequest} />
        {user && <PayoutSettingsCard partnerData={partnerData} isLoading={partnerLoading} partnerId={user.uid} />}
      </div>
      
      {user && <PayoutHistoryCard partnerId={user.uid} />}

      <div>
        <h1 className="text-4xl font-bold mb-8 font-headline">My Active Deliveries</h1>
        <Card>
          <CardHeader>
             <div className="flex justify-between items-center">
                <CardTitle>Orders You Are Delivering</CardTitle>
                {myActiveDeliveriesWithStores.length > 0 && (
                     <Button onClick={handleOptimizedRoute}><Route className="mr-2 h-4 w-4" /> Optimized Route</Button>
                )}
            </div>
          </CardHeader>
          <CardContent>
            {activeDeliveriesLoading ? (
              <p>Loading your active deliveries...</p>
            ) : myActiveDeliveriesWithStores.length === 0 ? (
              <p className="text-muted-foreground">No active deliveries. Pick one below.</p>
            ) : (
              <div className="space-y-4">
                  {myActiveDeliveriesWithStores.map((order) => (
                    <MyActiveDeliveriesCard 
                        key={order.id} order={order}
                        handleMarkAsDelivered={handleMarkAsDelivered}
                        onShowDetails={handleShowDetails}
                    />
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>


      <div>
        <div className="flex justify-between items-center mb-8">
            <h2 className="text-3xl font-bold font-headline">Available in your Zone</h2>
            <Button variant="outline" size="sm" onClick={fetchAvailableJobs} disabled={availableLoading}>
                <RefreshCw className={cn("mr-2 h-4 w-4", availableLoading && "animate-spin")} />
                Refresh
            </Button>
        </div>
         <Card>
          <CardHeader>
            <CardTitle>Ready for Pickup</CardTitle>
             <CardDescription>Orders in your zone ({partnerData?.zoneId?.replace('zone-', '') || 'Set zone above'}).</CardDescription>
          </CardHeader>
          <CardContent>
            {!partnerData?.zoneId ? (
                <Alert><Info className="h-4 w-4"/><AlertTitle>Service Zone Required</AlertTitle><AlertDescription>Please set your Pincode in Payout Settings to see available jobs in your area.</AlertDescription></Alert>
            ) : availableLoading && availableJobs.length === 0 ? (
              <p>Finding available deliveries...</p>
            ) : !availableDeliveriesWithStores || availableDeliveriesWithStores.length === 0 ? (
              <Alert><Package className="h-4 w-4" /><AlertTitle>Zone is Quiet</AlertTitle><AlertDescription>No orders are currently ready in your zone. Check back soon.</AlertDescription></Alert>
            ) : (
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Customer</TableHead>
                            <TableHead>Store</TableHead>
                            <TableHead>Total Value</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {availableDeliveriesWithStores.map(order => (
                            <TableRow key={order.id}>
                                <TableCell>{order.customerName}</TableCell>
                                <TableCell>{order.store?.name}</TableCell>
                                <TableCell>₹{order.totalAmount.toFixed(2)}</TableCell>
                                <TableCell className="text-right">
                                    <Button size="sm" onClick={() => handleConfirmPickup(order.id)}>
                                        Accept Job
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="text-3xl font-bold mb-8 font-headline">Earnings History</h2>
         <Card>
            <CardHeader>
                <CardTitle>Completed Deliveries</CardTitle>
                <CardDescription>A record of your successful deliveries.</CardDescription>
            </CardHeader>
            <CardContent>
                {completedDeliveriesLoading ? (
                    <p>Loading completed deliveries...</p>
                ) : !completedDeliveries || completedDeliveries.length === 0 ? (
                    <p className="text-muted-foreground">You have not completed any deliveries yet.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Date</TableHead>
                                <TableHead>Customer</TableHead>
                                <TableHead className="text-right">Your Earning</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {completedDeliveries.map((order) => (
                                <TableRow key={order.id}>
                                    <TableCell>{formatDate(order.orderDate)}</TableCell>
                                    <TableCell>{order.customerName}</TableCell>
                                    <TableCell className="text-right font-medium">₹{DELIVERY_FEE.toFixed(2)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter>
                            <TableRow>
                                <TableCell colSpan={2} className="text-right font-bold text-lg">Total Deliveries</TableCell>
                                <TableCell className="text-right font-bold text-lg">{completedDeliveries.length}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                )}
            </CardContent>
        </Card>
      </div>

    </div>
  );
}
