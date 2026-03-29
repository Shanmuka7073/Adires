
'use client';

import { Order, Store, DeliveryPartner, Payout, SiteConfig } from '@/lib/types';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Check, Banknote, History, Landmark, Receipt, CreditCard, ChevronDown, ChevronUp, Route, Package, Bot, Info, Loader2, LocateFixed, RefreshCw, Zap, ShoppingBag } from 'lucide-react';
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
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

const BASE_DELIVERY_FEE = 30;
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

function PayoutHistoryCard({ partnerId }: { partnerId: string }) {
    const { firestore } = useFirebase();
    
    const payoutQuery = useMemoFirebase(() => {
        if (!firestore || !partnerId) return null;
        return query(
            collection(firestore, `deliveryPartners/${partnerId}/payouts`),
            orderBy('requestDate', 'desc'),
            limit(10)
        );
    }, [firestore, partnerId]);

    const { data: payouts, isLoading } = useCollection<Payout>(payoutQuery);

    const formatDate = (date: any) => {
        if (!date) return 'N/A';
        const jsDate = date.seconds ? new Date(date.seconds * 1000) : new Date(date);
        return format(jsDate, 'PPP');
    }

    return (
        <Card className="rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white">
            <CardHeader className="bg-primary/5 border-b border-black/5 pb-6">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" />
                    <span>Payout History</span>
                </CardTitle>
                <CardDescription className="text-[10px] font-bold opacity-40 uppercase">Last 10 transactions</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                {isLoading ? (
                    <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>
                ) : !payouts || payouts.length === 0 ? (
                    <div className="p-20 text-center opacity-20">
                        <Banknote className="h-12 w-12 mx-auto mb-4" />
                        <p className="font-black uppercase tracking-widest text-xs">No payout history</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-black/5">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Date</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Method</TableHead>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Amount</TableHead>
                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Status</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {payouts.map((p) => (
                                <TableRow key={p.id} className="border-b border-black/5">
                                    <TableCell className="py-4">
                                        <p className="font-bold text-xs">{formatDate(p.requestDate)}</p>
                                    </TableCell>
                                    <TableCell className="text-[10px] font-black uppercase opacity-60">
                                        {p.payoutMethod}
                                    </TableCell>
                                    <TableCell className="font-black text-sm text-primary">₹{p.amount.toFixed(0)}</TableCell>
                                    <TableCell className="text-right pr-6">
                                        <Badge variant={p.status === 'completed' ? 'default' : p.status === 'failed' ? 'destructive' : 'secondary'} className="text-[8px] font-black uppercase">
                                            {p.status}
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    );
}

function OrderDetailsDialog({ order, isOpen, onClose, onAccept, distance }: { order: Order | null; isOpen: boolean; onClose: () => void; onAccept?: () => void; distance?: number; }) {
    if (!order) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl rounded-[2rem] border-0 shadow-2xl">
                <DialogHeader>
                    <DialogTitle className="font-black uppercase tracking-tight">Job Particulars</DialogTitle>
                    <DialogDescription className="font-bold opacity-40">
                        Order #{order.id.slice(-6)} • Customer: {order.customerName}
                    </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh]">
                    <div className="grid gap-4 py-4 pr-6">
                        {order.items && order.items.length > 0 ? (
                           <Card className="rounded-2xl border-2 bg-muted/30">
                                <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest opacity-40">Load Manifest</CardTitle></CardHeader>
                                <CardContent className="p-0">
                                    <Table>
                                        <TableBody>
                                            {order.items.map((item, index) => (
                                                <TableRow key={index} className="border-b last:border-0 border-black/5">
                                                    <TableCell className="font-bold text-xs">{item.productName}</TableCell>
                                                    <TableCell className="text-right font-black opacity-40 text-[10px]">x{item.quantity}</TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </CardContent>
                            </Card>
                        ) : (
                            <p>No items listed for this order.</p>
                        )}
                         <Card className="rounded-2xl border-2">
                            <CardHeader><CardTitle className="text-xs font-black uppercase tracking-widest opacity-40">Route Logistics</CardTitle></CardHeader>
                            <CardContent className="text-xs space-y-4 font-bold text-gray-600">
                                 <div className="flex gap-3">
                                     <div className="h-2 w-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                                     <p>Pickup: {order.store?.name} - {order.store?.address}</p>
                                 </div>
                                 <div className="flex gap-3">
                                     <div className="h-2 w-2 rounded-full bg-primary mt-1 shrink-0" />
                                     <p>Drop-off: {order.customerName} - {order.deliveryAddress}</p>
                                 </div>
                                 {distance !== undefined && (
                                     <div className="border-t pt-4 mt-4 flex items-center justify-between">
                                        <div className="text-sm font-black text-gray-900">
                                            Est. Distance: {distance.toFixed(2)} km
                                        </div>
                                         <Button
                                            variant="outline"
                                            size="sm"
                                            className="rounded-xl font-black text-[9px] uppercase tracking-widest border-2"
                                            onClick={() => openInGoogleMaps(order.deliveryLat, order.deliveryLng, order.store?.latitude, order.store?.longitude)}
                                        >
                                            <Route className="mr-2 h-3.5 w-3.5" />
                                            Open Navigator
                                        </Button>
                                     </div>
                                 )}
                            </CardContent>
                        </Card>
                    </div>
                </ScrollArea>
                <DialogFooter className="gap-2 sm:gap-0 border-t pt-6">
                    <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">Cancel</Button>
                    {onAccept && (
                        <Button onClick={onAccept} className="rounded-xl h-12 px-8 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">
                            Accept Job & Confirm Pickup
                        </Button>
                    )}
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
        <Card className="rounded-[2rem] border-0 shadow-xl overflow-hidden">
            <CardHeader className="bg-primary/5 border-b border-black/5 pb-6">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <Landmark className="h-5 w-5 text-primary" />
                    <span>Payout Profile</span>
                </CardTitle>
                <CardDescription className="text-[10px] font-bold opacity-40 uppercase">Manage zone & banking</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin opacity-20" /> : (
                    !isEditing && hasDetails ? (
                        <div className="space-y-6">
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-[10px] font-black uppercase opacity-40 tracking-widest mb-1">Active Zone</p>
                                    <p className="text-2xl font-black tracking-tighter text-primary">{partnerData.zoneId?.replace('zone-', '') || 'Global'}</p>
                                </div>
                                <Button variant="outline" size="sm" className="rounded-xl font-bold uppercase text-[9px] tracking-widest h-8" onClick={() => setIsEditing(true)}>Edit Profile</Button>
                            </div>
                            
                            <div className="p-4 rounded-2xl bg-muted/30 border border-black/5">
                                {partnerData.payoutMethod === 'upi' ? (
                                    <div className="space-y-1">
                                        <p className="text-[8px] font-black uppercase opacity-40">UPI Destination</p>
                                        <p className="text-xs font-bold font-mono">{partnerData.upiId}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-2">
                                        <p className="text-[8px] font-black uppercase opacity-40">Bank Routing</p>
                                        <div className="text-xs font-bold font-mono space-y-1">
                                            <p className="opacity-60">{partnerData.bankDetails?.accountHolderName}</p>
                                            <p>{partnerData.bankDetails?.accountNumber}</p>
                                            <p className="text-[9px] uppercase opacity-40">{partnerData.bankDetails?.ifscCode}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ) : (
                         <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField control={form.control} name="pincode" render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-[10px] font-black uppercase opacity-40">Your Pincode (Service Area)</FormLabel>
                                        <FormControl><Input placeholder="e.g. 500001" {...field} className="rounded-xl h-12 border-2" /></FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )} />

                                <FormField
                                    control={form.control}
                                    name="payoutMethod"
                                    render={({ field }) => (
                                        <FormItem className="space-y-3">
                                            <FormLabel className="text-[10px] font-black uppercase opacity-40">Payout Method</FormLabel>
                                            <FormControl>
                                                <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="flex gap-4">
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value="bank" /></FormControl>
                                                        <FormLabel className="text-xs font-bold uppercase">Bank</FormLabel>
                                                    </FormItem>
                                                    <FormItem className="flex items-center space-x-2 space-y-0">
                                                        <FormControl><RadioGroupItem value="upi" /></FormControl>
                                                        <FormLabel className="text-xs font-bold uppercase">UPI</FormLabel>
                                                    </FormItem>
                                                </RadioGroup>
                                            </FormControl>
                                        </FormItem>
                                    )}
                                />
                                
                                {watchPayoutMethod === 'upi' && (
                                    <FormField control={form.control} name="upiId" render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-[10px] font-black uppercase opacity-40">UPI ID</FormLabel>
                                            <FormControl><Input placeholder="yourname@bank" {...field} className="rounded-xl h-12 border-2" /></FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )} />
                                )}

                                {watchPayoutMethod === 'bank' && (
                                    <div className="grid grid-cols-1 gap-4 p-4 rounded-2xl bg-muted/20 border-2 border-black/5">
                                        <FormField control={form.control} name="accountHolderName" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[9px] font-black uppercase opacity-40">Holder Name</FormLabel><FormControl><Input placeholder="Full Name" {...field} className="h-10 rounded-lg" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                        <FormField control={form.control} name="accountNumber" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[9px] font-black uppercase opacity-40">Account No.</FormLabel><FormControl><Input placeholder="Number" {...field} className="h-10 rounded-lg" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                         <FormField control={form.control} name="ifscCode" render={({ field }) => (
                                            <FormItem><FormLabel className="text-[9px] font-black uppercase opacity-40">IFSC</FormLabel><FormControl><Input placeholder="Code" {...field} className="h-10 rounded-lg uppercase" /></FormControl><FormMessage /></FormItem>
                                        )} />
                                    </div>
                                )}
                                <div className="flex gap-2">
                                     <Button type="submit" disabled={isSaving} className="flex-1 h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20">{isSaving ? 'Processing...' : 'Save Profile'}</Button>
                                     {hasDetails && <Button variant="ghost" className="rounded-xl font-bold" onClick={() => setIsEditing(false)}>Cancel</Button>}
                                </div>
                            </form>
                         </Form>
                    )
                )}
            </CardContent>
        </Card>
    );
}

function PayoutCard({ partnerData, isLoading, onPayout, boostMultiplier }: { partnerData: DeliveryPartner | null, isLoading: boolean, onPayout: () => void, boostMultiplier: number }) {
    const totalEarnings = partnerData?.totalEarnings || 0;
    const hasPayoutDetails = partnerData && (partnerData.bankDetails?.accountNumber || partnerData.upiId);

    return (
        <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-slate-900 text-white relative">
            <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                <Banknote className="h-32 w-32" />
            </div>
            <CardHeader className="p-8 pb-4 relative z-10">
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="text-sm font-black uppercase tracking-widest text-primary">Withdrawable Earnings</CardTitle>
                        <CardDescription className="text-white/40 font-bold text-[10px] uppercase">Synced live from secure vault</CardDescription>
                    </div>
                    {boostMultiplier > 1 && (
                        <Badge className="bg-primary text-white border-0 font-black uppercase text-[10px] px-3 py-1 flex gap-1.5 items-center shadow-lg shadow-primary/20 animate-bounce">
                            <Zap className="h-3.5 w-3.5 fill-current" /> {boostMultiplier}x Boost On
                        </Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="p-8 pt-0 relative z-10 space-y-8">
                <div>
                    {isLoading ? (
                        <Skeleton className="h-12 w-32 bg-white/10 rounded-xl" />
                    ) : (
                        <p className="text-6xl font-black tracking-tighter italic">₹{totalEarnings.toFixed(0)}</p>
                    )}
                    <p className="text-[10px] font-black uppercase opacity-20 tracking-[0.3em] mt-2">Available for payout</p>
                </div>
                
                <Button
                    size="lg"
                    onClick={onPayout}
                    disabled={isLoading || totalEarnings <= 0 || !hasPayoutDetails}
                    className="w-full h-14 rounded-2xl bg-white text-slate-900 hover:bg-white/90 font-black uppercase tracking-widest text-xs shadow-2xl"
                >
                    Request Instant Payout
                </Button>
            </CardContent>
        </Card>
    )
}

function MyActiveDeliveriesCard({ order, handleMarkAsDelivered, onShowDetails }: { order: Order, handleMarkAsDelivered: (order: Order) => void, onShowDetails: (order: Order) => void }) {
    
    return (
        <Card key={order.id} className="rounded-[2rem] border-0 shadow-lg p-6 bg-white overflow-hidden group">
            <div className="flex justify-between items-start mb-6">
                <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1 leading-none">Drop-off Destination</p>
                    <h3 className="text-lg font-black tracking-tight text-gray-900 truncate">{order.customerName}</h3>
                    <p className="text-[11px] font-bold text-gray-500 leading-tight truncate">{order.deliveryAddress}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                     <Button
                        variant="outline"
                        size="icon"
                        className="h-10 w-10 rounded-xl border-2 hover:bg-primary hover:text-white transition-colors"
                        onClick={() => openInGoogleMaps(order.deliveryLat, order.deliveryLng, order.store?.latitude, order.store?.longitude)}
                    >
                        <MapPin className="h-4 w-4" />
                    </Button>
                     <Button variant="secondary" size="sm" className="h-10 rounded-xl font-bold uppercase text-[9px] tracking-widest px-4" onClick={() => onShowDetails(order)}>Info</Button>
                </div>
            </div>

            <AlertDialog>
                <AlertDialogTrigger asChild>
                    <Button 
                        className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95"
                        disabled={!order.deliveryLat || !order.deliveryLng}
                    >
                        <Check className="mr-2 h-4 w-4" />
                        Finalize Delivery
                    </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-[2.5rem] border-0 shadow-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="font-black uppercase tracking-tight">Confirm Arrival?</AlertDialogTitle>
                        <AlertDialogDescription className="font-bold">
                            Have you reached the customer's location and handed over the package?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold">Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={() => handleMarkAsDelivered(order)} className="bg-primary hover:bg-primary/90 rounded-xl font-bold uppercase tracking-widest text-[10px]">Yes, Confirmed</AlertDialogAction>
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

  // REAL-TIME BOOST LISTENER
  const boostConfigRef = useMemoFirebase(() => firestore ? doc(firestore, 'siteConfig', 'partnerRewards') : null, [firestore]);
  const { data: boostConfig } = useDoc<any>(boostConfigRef);
  const activeBoost = useMemo(() => {
      if (!boostConfig || !boostConfig.active) return 1;
      const expiresAt = boostConfig.expiresAt instanceof Timestamp ? boostConfig.expiresAt.toDate() : new Date(boostConfig.expiresAt);
      if (expiresAt < new Date()) return 1;
      return boostConfig.multiplier || 1;
  }, [boostConfig]);

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
        description: `Proceed to store for pickup.`
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
                    title: 'Verification Failed',
                    description: `You must be within ${DELIVERY_PROXIMITY_THRESHOLD_KM * 1000}m of the drop-off location.`,
                });
                return;
            }

            if (!firestore || !user?.uid) return;

            const orderRef = doc(firestore, 'orders', order.id);
            const partnerRef = doc(firestore, 'deliveryPartners', user.uid);

            const batch = writeBatch(firestore);
            batch.update(orderRef, { status: 'Delivered', updatedAt: serverTimestamp() });
            
            // DYNAMIC PAYOUT CALCULATION WITH BOOST MULTIPLIER
            const finalEarnings = BASE_DELIVERY_FEE * activeBoost;
            
            batch.set(partnerRef, {
                totalEarnings: increment(finalEarnings),
                userId: user.uid,
                payoutsEnabled: true,
            }, { merge: true });

            batch.commit().catch(error => {
                console.error("Failed to mark as delivered:", error);
                toast({ variant: 'destructive', title: 'Sync Error', description: 'Internal platform sync failed.' });
            });

            toast({
                title: "Payment Credited!",
                description: `₹${finalEarnings.toFixed(2)} added to your vault. ${activeBoost > 1 ? `(Including ${activeBoost}x Boost)` : ''}`
            });
        },
        (error) => {
            toast({ variant: 'destructive', title: 'Location Error', description: 'GPS access required for delivery verification.' });
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
    <div className="container mx-auto py-12 px-4 md:px-6 space-y-12 pb-32">
        {selectedOrder && (
             <OrderDetailsDialog 
                order={selectedOrder} 
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                distance={selectedOrderDistance}
             />
        )}

        <div className="border-b pb-10 border-black/5">
            <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic">Logistics Hub</h1>
            <p className="text-muted-foreground font-black mt-2 uppercase text-[10px] tracking-[0.3em] opacity-40">Partner Performance Center</p>
        </div>

      <div className="grid md:grid-cols-2 gap-8">
        <PayoutCard partnerData={partnerData} isLoading={partnerLoading} onPayout={handlePayoutRequest} boostMultiplier={activeBoost} />
        {user && <PayoutSettingsCard partnerData={partnerData} isLoading={partnerLoading} partnerId={user.uid} />}
      </div>
      
      {user && <PayoutHistoryCard partnerId={user.uid} />}

      <section className="space-y-6">
        <div className="flex justify-between items-center px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 flex items-center gap-2">
                <Package className="h-3.5 w-3.5"/> Active Deliveries
            </h2>
            {myActiveDeliveriesWithStores.length > 0 && (
                 <Button variant="outline" onClick={handleOptimizedRoute} className="rounded-xl h-10 px-4 border-2 font-black uppercase text-[10px] tracking-widest"><Route className="mr-2 h-4 w-4" /> Multi-Route</Button>
            )}
        </div>
        
        {activeDeliveriesLoading ? (
          <div className="grid md:grid-cols-2 gap-4"><Skeleton className="h-48 w-full rounded-[2rem]" /><Skeleton className="h-48 w-full rounded-[2rem]" /></div>
        ) : myActiveDeliveriesWithStores.length === 0 ? (
          <div className="p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-black/5 opacity-40">
              <ShoppingBag className="h-12 w-12 mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-xs">No current assignments</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-6">
              {myActiveDeliveriesWithStores.map((order) => (
                <MyActiveDeliveriesCard 
                    key={order.id} order={order}
                    handleMarkAsDelivered={handleMarkAsDelivered}
                    onShowDetails={handleShowDetails}
                />
              ))}
          </div>
        )}
      </section>


      <section className="space-y-6">
        <div className="flex justify-between items-center px-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                <Bot className="h-3.5 w-3.5"/> Nearby Opportunities
            </h2>
            <Button variant="ghost" size="sm" onClick={fetchAvailableJobs} disabled={availableLoading} className="rounded-full font-black text-[9px] uppercase tracking-widest opacity-40">
                <RefreshCw className={cn("mr-2 h-3 w-3", availableLoading && "animate-spin")} /> Refresh
            </Button>
        </div>

        {!partnerData?.zoneId ? (
            <Alert className="rounded-3xl border-2 bg-amber-50 border-amber-100 p-8"><Info className="h-5 w-5 text-amber-600"/><AlertTitle className="text-amber-900 font-black uppercase text-xs">Zone Not Assigned</AlertTitle><AlertDescription className="text-amber-800 text-sm font-bold opacity-60">Set your service pincode above to discover jobs near you.</AlertDescription></Alert>
        ) : availableLoading && availableJobs.length === 0 ? (
          <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>
        ) : !availableDeliveriesWithStores || availableDeliveriesWithStores.length === 0 ? (
          <div className="p-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-black/5 opacity-40">
              <Zap className="h-12 w-12 mx-auto mb-4" />
              <p className="font-black uppercase tracking-widest text-xs">Zero pending jobs in {partnerData.zoneId.replace('zone-', '')}</p>
          </div>
        ) : (
            <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
                <Table>
                    <TableHeader className="bg-black/5">
                        <TableRow>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Hub (Pickup)</TableHead>
                            <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Value</TableHead>
                            <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Accept</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                         {availableDeliveriesWithStores.map(order => (
                            <TableRow key={order.id} className="hover:bg-muted/30 border-b border-black/5">
                                <TableCell className="py-6">
                                    <p className="font-black text-sm uppercase text-gray-950">{order.store?.name}</p>
                                    <p className="text-[9px] font-bold opacity-40 uppercase tracking-tight">{order.store?.address}</p>
                                </TableCell>
                                <TableCell className="font-black text-sm text-primary">₹{order.totalAmount.toFixed(0)}</TableCell>
                                <TableCell className="text-right pr-6">
                                    <Button size="sm" className="h-10 rounded-xl px-6 font-black uppercase text-[10px] tracking-widest shadow-lg shadow-primary/20" onClick={() => handleConfirmPickup(order.id)}>
                                        Go
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </Card>
        )}
      </section>

      <section className="space-y-6">
        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40 px-1">Earning Audit</h2>
         <Card className="rounded-[2.5rem] border-0 shadow-xl overflow-hidden bg-white">
            <CardContent className="p-0">
                {completedDeliveriesLoading ? (
                    <div className="p-12 text-center"><Loader2 className="animate-spin h-8 w-8 mx-auto opacity-20" /></div>
                ) : !completedDeliveries || completedDeliveries.length === 0 ? (
                    <div className="p-20 text-center opacity-20">
                        <History className="h-12 w-12 mx-auto mb-4" />
                        <p className="font-black uppercase tracking-widest text-xs">No history found</p>
                    </div>
                ) : (
                    <Table>
                        <TableHeader className="bg-black/5">
                            <TableRow>
                                <TableHead className="text-[10px] font-black uppercase tracking-widest opacity-40">Completion Date</TableHead>
                                <TableHead className="text-right text-[10px] font-black uppercase tracking-widest opacity-40">Yield (₹)</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {completedDeliveries.map((order) => (
                                <TableRow key={order.id} className="border-b border-black/5">
                                    <TableCell className="py-4">
                                        <p className="font-bold text-xs">{formatDate(order.orderDate)}</p>
                                        <p className="text-[9px] font-black uppercase opacity-40">#{order.id.slice(-6)}</p>
                                    </TableCell>
                                    <TableCell className="text-right font-black text-primary pr-6">₹{BASE_DELIVERY_FEE.toFixed(0)}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                        <TableFooter className="bg-primary/5">
                            <TableRow>
                                <TableCell className="text-xs font-black uppercase tracking-widest text-primary pl-6">Cumulative Assignments</TableCell>
                                <TableCell className="text-right font-black text-xl text-primary pr-6">{completedDeliveries.length}</TableCell>
                            </TableRow>
                        </TableFooter>
                    </Table>
                )}
            </CardContent>
        </Card>
      </section>

    </div>
  );
}
