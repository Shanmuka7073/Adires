'use client';

import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import { useTransition, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useFirebase, errorEmitter, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import type { User as AppUser, Order } from '@/lib/types';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/locales';
import { useCheckoutStore } from '@/lib/checkout-store';
import { format } from 'date-fns';

const checkoutSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  deliveryAddress: z.string().min(10, 'Please provide a valid delivery address.'),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

const DELIVERY_FEE = 30;

function OrderSummaryItem({ item, image }: { item: any, image: any }) {
    const { product, variant, quantity } = item;
    const productNameKey = product.name.toLowerCase().replace(/ /g, '-');
    const englishName = t(productNameKey, 'en');
    return (
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <Image src={image.imageUrl || 'https://placehold.co/32x32/E2E8F0/64748B?text=...'} alt={product.name} width={32} height={32} className="rounded-md" />
                <div>
                    <p className="font-medium text-sm">{englishName} <span className="text-xs text-muted-foreground">({variant.weight})</span></p>
                    <p className="text-xs text-muted-foreground">Qty: {quantity}</p>
                </div>
            </div>
            <p className="text-sm">₹{(variant.price * quantity).toFixed(2)}</p>
        </div>
    );
}

export default function CheckoutPage() {
  const { cartItems, cartTotal, clearCart, activeStoreId, setActiveStoreId } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const [isPlacingOrder, startPlaceOrderTransition] = useTransition();
  const { firestore, user } = useFirebase();
  const { deviceId, stores, fetchInitialData } = useAppStore();
  
  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    mode: 'onChange',
    defaultValues: { name: '', phone: '', deliveryAddress: '' },
  });

  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number} | null>(null);
  const placeOrderBtnRef = useRef<HTMLButtonElement>(null);
  
  const localBasketStore = useMemo(() => stores.find(s => s.name === 'LocalBasket'), [stores]);

  const { 
      setPlaceOrderBtnRef,
      shouldPlaceOrderDirectly,
      setShouldPlaceOrderDirectly,
      setAddressHandlers,
    } = useCheckoutStore();
  
  useEffect(() => { if (firestore) fetchInitialData(firestore, user?.uid); }, [firestore, fetchInitialData, user?.uid]);
  useEffect(() => { if (localBasketStore && !activeStoreId) setActiveStoreId(localBasketStore.id); }, [localBasketStore, activeStoreId, setActiveStoreId]);

  const userDocRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userData } = useDoc<AppUser>(userDocRef);
  
  const handleUseCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition((pos) => {
            const { latitude, longitude } = pos.coords;
            setDeliveryCoords({ lat: latitude, lng: longitude });
            form.setValue('deliveryAddress', `GPS (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`, { shouldValidate: true });
        });
    }
  }, [form]);

  const handleUseHomeAddress = useCallback(() => {
    if (userData?.address) {
      form.setValue('deliveryAddress', userData.address, { shouldValidate: true });
      setDeliveryCoords(null); 
    }
  }, [userData, form]);

  useEffect(() => { setAddressHandlers(handleUseHomeAddress, handleUseCurrentLocation); }, [handleUseHomeAddress, handleUseCurrentLocation, setAddressHandlers]);
  useEffect(() => { setPlaceOrderBtnRef(placeOrderBtnRef); return () => setPlaceOrderBtnRef(null); }, [setPlaceOrderBtnRef]);

  useEffect(() => {
    if (userData) {
      form.reset({ name: `${userData.firstName} ${userData.lastName}`, phone: userData.phoneNumber, deliveryAddress: form.getValues('deliveryAddress') || '' });
    }
  }, [userData, form]);

  const onSubmit = (data: CheckoutFormValues) => {
    if (!firestore || !activeStoreId) return;
    
    const finalDeviceId = deviceId || localStorage.getItem('adires-device-id') || 'unknown';
    const dateStr = format(new Date(), 'yyyy-MM-dd');
    // HARDENED: stableSessionId includes storeId to sync correctly with Menu Content listeners
    const stableSessionId = `home-${finalDeviceId}-${dateStr}-${activeStoreId}`;

    const orderId = doc(collection(firestore, 'orders')).id;
    const orderDocRef = doc(firestore, 'orders', orderId);
    
    const orderData: any = {
        id: orderId,
        userId: user?.uid || 'guest',
        deviceId: finalDeviceId,
        sessionId: stableSessionId,
        storeId: activeStoreId,
        customerName: data.name,
        deliveryAddress: data.deliveryAddress,
        deliveryLat: deliveryCoords?.lat || 0,
        deliveryLng: deliveryCoords?.lng || 0,
        orderDate: serverTimestamp(),
        status: 'Pending',
        orderType: 'delivery',
        isActive: true,
        totalAmount: cartTotal + DELIVERY_FEE,
        items: cartItems.map(item => ({ 
            id: crypto.randomUUID(), 
            orderId: orderId, 
            productId: item.product.id, 
            productName: item.product.name, 
            variantSku: item.variant.sku, 
            variantWeight: item.variant.weight, 
            quantity: item.quantity, 
            price: item.variant.price 
        })),
    };

    setDoc(orderDocRef, orderData).catch(async (e) => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({ path: orderDocRef.path, operation: 'create', requestResourceData: orderData }));
    });

    clearCart();
    router.push(`/order-confirmation?orderId=${orderId}`);
  };

  useEffect(() => { if (shouldPlaceOrderDirectly && form.formState.isValid && placeOrderBtnRef.current) { placeOrderBtnRef.current.click(); setShouldPlaceOrderDirectly(false); } }, [shouldPlaceOrderDirectly, form.formState.isValid, setShouldPlaceOrderDirectly]);

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid md:grid-cols-2 gap-12">
                <Card className="rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b border-black/5 p-6">
                        <CardTitle className="font-black uppercase tracking-tight">Order Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        {cartItems.map((item) => <OrderSummaryItem key={item.variant.sku} item={item} image={{imageUrl: '', imageHint: ''}} />)}
                        <div className="border-t border-dashed pt-4 flex justify-between items-baseline font-black">
                            <span className="text-xs uppercase opacity-40">Grand Total</span>
                            <span className="text-2xl text-primary tracking-tighter">₹{(cartTotal + DELIVERY_FEE).toFixed(2)}</span>
                        </div>
                    </CardContent>
                </Card>
                <Card className="rounded-[2rem] border-0 shadow-xl overflow-hidden bg-white">
                    <CardHeader className="bg-primary/5 border-b border-black/5 p-6">
                        <CardTitle className="font-black uppercase tracking-tight">Delivery Details</CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 space-y-6">
                        <FormField control={form.control} name="name" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Recipient Name</FormLabel><FormControl><Input {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <div className="grid grid-cols-2 gap-4">
                            <Button type="button" variant="outline" onClick={handleUseHomeAddress} className="h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-2">Home</Button>
                            <Button type="button" variant="outline" onClick={handleUseCurrentLocation} className="h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-2">GPS</Button>
                        </div>
                        <FormField control={form.control} name="deliveryAddress" render={({ field }) => (
                            <FormItem><FormLabel className="text-[10px] font-black uppercase opacity-40">Address</FormLabel><FormControl><Input placeholder="Full residential address" {...field} className="h-12 rounded-xl border-2 font-bold" /></FormControl><FormMessage /></FormItem>
                        )} />
                        <Button ref={placeOrderBtnRef} type="submit" disabled={isPlacingOrder} className="w-full h-14 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 mt-4">
                            {isPlacingOrder ? 'Processing...' : 'Confirm and Place Order'}
                        </Button>
                    </CardContent>
                </Card>
            </form>
        </Form>
    </div>
  );
}
