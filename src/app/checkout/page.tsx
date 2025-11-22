
'use client';

import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { getProductImage, getStore } from '@/lib/data';
import { useTransition, useState, useCallback, useEffect, useMemo, RefObject, useRef } from 'react';
import { useFirebase, errorEmitter, useDoc, useMemoFirebase } from '@/firebase';
import { collection, doc, serverTimestamp, getDoc, writeBatch, type DocumentReference, type DocumentData } from 'firebase/firestore';
import { FirestorePermissionError } from '@/firebase/errors';
import { CheckCircle, MapPin, Loader2, AlertCircle, Store as StoreIcon, Home, LocateFixed } from 'lucide-react';
import Link from 'next/link';
import type { User as AppUser, Store, ProductPrice } from '@/lib/types';
import { create } from 'zustand';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/locales';
import { useVoiceCommander } from '@/components/layout/main-layout';


const checkoutSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Please enter a valid phone number'),
  deliveryAddress: z.string().min(10, 'Please provide a valid delivery address.'),
});

type CheckoutFormValues = z.infer<typeof checkoutSchema>;

const DELIVERY_FEE = 30;

function OrderSummaryItem({ item, image }) {
    const { product, variant, quantity } = item;
    
    const productNameKey = product.name.toLowerCase().replace(/ /g, '-');
    const englishName = t(productNameKey, 'en');
    const teluguName = t(productNameKey, 'te');

    return (
        <div className="flex justify-between items-center">
            <div className="flex items-center gap-4">
                <Image src={image.imageUrl} alt={product.name} data-ai-hint={image.imageHint} width={48} height={48} className="rounded-md" />
                <div>
                    <p className="font-medium">{englishName} <span className="text-sm text-muted-foreground">({variant.weight})</span></p>
                    <p className="text-xs text-muted-foreground">{teluguName}</p>
                    <p className="text-sm text-muted-foreground">Qty: {quantity}</p>
                </div>
            </div>
            <p>₹{(variant.price * quantity).toFixed(2)}</p>
        </div>
    );
}

// State store for the checkout page, allowing the VoiceCommander to interact with it.
interface CheckoutState {
  placeOrderBtnRef: RefObject<HTMLButtonElement> | null;
  setPlaceOrderBtnRef: (ref: RefObject<HTMLButtonElement> | null) => void;
  isWaitingForQuickOrderConfirmation: boolean;
  setIsWaitingForQuickOrderConfirmation: (isWaiting: boolean) => void;
  shouldPlaceOrderDirectly: boolean;
  setShouldPlaceOrderDirectly: (shouldPlace: boolean) => void;
  setHomeAddress: (address: string | null) => void;
  setShouldUseCurrentLocation: (shouldUse: boolean) => void;
  // Handlers for voice commands to call directly
  handleUseHomeAddress: () => void;
  handleUseCurrentLocation: () => void;
  setAddressHandlers: (homeHandler: () => void, currentHandler: () => void) => void;
}

export const useCheckoutStore = create<CheckoutState>((set) => ({
  placeOrderBtnRef: null,
  setPlaceOrderBtnRef: (placeOrderBtnRef) => set({ placeOrderBtnRef }),
  isWaitingForQuickOrderConfirmation: false,
  setIsWaitingForQuickOrderConfirmation: (isWaiting) => set({ isWaitingForQuickOrderConfirmation: isWaiting }),
  shouldPlaceOrderDirectly: false,
  setShouldPlaceOrderDirectly: (shouldPlace) => set({ shouldPlaceOrderDirectly: shouldPlace }),
  setHomeAddress: (address) => {
    // This is a placeholder. The actual logic is in the page component.
    // We update the state to trigger effects in the component.
    set(state => ({ ...state })); 
  },
  setShouldUseCurrentLocation: (shouldUse) => {
    // Placeholder, logic is in component.
     set(state => ({ ...state }));
  },
  handleUseHomeAddress: () => {}, // Default empty function
  handleUseCurrentLocation: () => {}, // Default empty function
  setAddressHandlers: (homeHandler, currentHandler) => set({ handleUseHomeAddress: homeHandler, handleUseCurrentLocation: currentHandler }),
}));

export default function CheckoutPage() {
  const { cartItems, cartTotal, clearCart, activeStoreId, setActiveStoreId } = useCart();
  const router = useRouter();
  const { toast } = useToast();
  const [isPlacingOrder, startPlaceOrderTransition] = useTransition();
  const { firestore, user } = useFirebase();
  const form = useForm<CheckoutFormValues>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: { name: '', phone: '', deliveryAddress: '' },
  });

  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number} | null>(null);
  const [images, setImages] = useState({});
  const placeOrderBtnRef = useRef<HTMLButtonElement>(null);
  
  const { allStores, fetchInitialData } = useAppStore((state) => ({
    allStores: state.stores,
    fetchInitialData: state.fetchInitialData,
  }));
  
  const localBasketStore = useMemo(() => allStores.find(s => s.name === 'LocalBasket'), [allStores]);

  const { 
      isWaitingForQuickOrderConfirmation, 
      setPlaceOrderBtnRef,
      shouldPlaceOrderDirectly,
      setShouldPlaceOrderDirectly,
      setAddressHandlers, // Get the function to set our handlers
    } = useCheckoutStore();
  
  const { triggerVoicePrompt } = useVoiceCommander();

  const hasItemsInCart = cartItems.length > 0;
  const finalTotal = hasItemsInCart ? cartTotal + DELIVERY_FEE : 0;
  
  useEffect(() => {
    if (firestore) {
      fetchInitialData(firestore);
    }
  }, [firestore, fetchInitialData]);

  // Automatically set the store to LocalBasket
  useEffect(() => {
    if (localBasketStore && !activeStoreId) {
      setActiveStoreId(localBasketStore.id);
    }
  }, [localBasketStore, activeStoreId, setActiveStoreId]);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData } = useDoc<AppUser>(userDocRef);
  
  const handleUseCurrentLocation = useCallback(() => {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setDeliveryCoords({ lat: latitude, lng: longitude });
                form.setValue('deliveryAddress', `Current Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`, { shouldValidate: true });
                toast({ title: "Location Fetched!", description: "Your current location has been set for delivery." });
            },
            () => {
                toast({ variant: 'destructive', title: "Location Error", description: "Could not retrieve your location. Please ensure permissions are enabled." });
            },
            { timeout: 10000 }
        );
    } else {
        toast({ variant: 'destructive', title: "Not Supported", description: "Geolocation is not supported by your browser." });
    }
  }, [toast, form]);

  const handleUseHomeAddress = useCallback(() => {
    if (userData?.address) {
      form.setValue('deliveryAddress', userData.address, { shouldValidate: true });
      toast({ title: "Home Address Set!", description: "Your saved home address will be used for delivery." });
      setDeliveryCoords(null); 
    } else {
      toast({ variant: 'destructive', title: 'No Home Address', description: 'Please set your home address in your profile first.' });
    }
  }, [userData, form, toast]);

  // Expose the local handlers to the global state for the VoiceCommander to use
  useEffect(() => {
    setAddressHandlers(handleUseHomeAddress, handleUseCurrentLocation);
  }, [handleUseHomeAddress, handleUseCurrentLocation, setAddressHandlers]);

  useEffect(() => {
    setPlaceOrderBtnRef(placeOrderBtnRef);
    return () => {
      setPlaceOrderBtnRef(null);
    }
  }, [setPlaceOrderBtnRef]);

  const deliveryAddressValue = form.watch('deliveryAddress');
  
  useEffect(() => {
    if ((deliveryAddressValue && deliveryAddressValue.length > 10) || activeStoreId) {
      if (triggerVoicePrompt) {
        triggerVoicePrompt();
      }
    }
  }, [deliveryAddressValue, activeStoreId, triggerVoicePrompt]);

  // Effect to pre-fill form with user data
  useEffect(() => {
    if (userData) {
      form.reset({
        name: `${userData.firstName} ${userData.lastName}`,
        phone: userData.phoneNumber,
        deliveryAddress: form.getValues('deliveryAddress') || '',
      });
    }
  }, [userData, form]);

  useEffect(() => {
    const fetchImages = async () => {
        if (cartItems.length === 0) return;
        const imagePromises = cartItems.map(item => {
            if (item.product.imageUrl) {
                return Promise.resolve({ imageUrl: item.product.imageUrl, imageHint: item.product.name });
            }
            return getProductImage(item.product.imageId);
        });
        const resolvedImages = await Promise.all(imagePromises);
        const imageMap = cartItems.reduce((acc, item, index) => {
            acc[item.variant.sku] = resolvedImages[index];
            return acc;
        }, {});
        setImages(imageMap);
    };

    if (cartItems.length > 0) {
        fetchImages();
    }
  }, [cartItems]);

  const onSubmit = (data: CheckoutFormValues) => {
    if (!firestore || !user) {
        toast({ variant: 'destructive', title: 'Error', description: 'You must be logged in to place an order.' });
        return;
    }
    
    if (cartItems.length === 0) {
        toast({ variant: 'destructive', title: 'Error', description: 'Your cart is empty. Please add items before checking out.' });
        return;
    }
     if (!activeStoreId) {
        toast({ variant: 'destructive', title: 'Store Required', description: 'A store must be selected to fulfill your order.' });
        return;
    }

    startPlaceOrderTransition(async () => {
        if (!firestore) return;
        const storeData = await getStore(firestore, activeStoreId);
        if (!storeData) {
            toast({ variant: 'destructive', title: 'Error', description: 'Selected store could not be found.' });
            return;
        }
        
        const totalAmount = cartTotal + DELIVERY_FEE;
        
        const orderDocRef = doc(collection(firestore, 'orders'));

        const orderData: any = {
            id: orderDocRef.id,
            userId: user.uid,
            storeId: activeStoreId,
            storeOwnerId: storeData.ownerId,
            customerName: data.name,
            deliveryAddress: data.deliveryAddress,
            deliveryLat: deliveryCoords?.lat || 0,
            deliveryLng: deliveryCoords?.lng || 0,
            phone: data.phone,
            email: user.email,
            orderDate: serverTimestamp(),
            status: 'Pending' as 'Pending',
            totalAmount,
            items: cartItems.map(item => ({
                productId: item.product.id,
                productName: item.product.name,
                variantSku: item.variant.sku,
                variantWeight: item.variant.weight,
                quantity: item.quantity,
                price: item.variant.price,
            })),
        };

        try {
            const batch = writeBatch(firestore);

            // 1. Set the new order document
            batch.set(orderDocRef, orderData);

            // 2. Decrement stock for each item in the order
            for (const item of cartItems) {
                const priceDocRef = doc(firestore, 'productPrices', item.product.name.toLowerCase());
                const priceDocSnap = await getDoc(priceDocRef);

                if (priceDocSnap.exists()) {
                    const priceData = priceDocSnap.data() as ProductPrice;
                    const updatedVariants = priceData.variants.map(variant => {
                        if (variant.sku === item.variant.sku) {
                            return { ...variant, stock: Math.max(0, variant.stock - item.quantity) };
                        }
                        return variant;
                    });
                    batch.update(priceDocRef, { variants: updatedVariants });
                } else {
                    console.warn(`Could not find price document for ${item.product.name} to update stock.`);
                }
            }

            // 3. Commit the atomic batch
            await batch.commit();

            toast({
                title: "Order Placed!",
                description: "Thank you for your purchase. Inventory has been updated.",
            });
            clearCart();
            setDeliveryCoords(null);
            form.reset();
            router.push('/order-confirmation');

        } catch (e) {
            console.error('Error placing order and updating stock:', e);
            const permissionError = new FirestorePermissionError({
                path: orderDocRef.path, // Use the order path for the primary error context
                operation: 'create',
                requestResourceData: orderData
            });
            errorEmitter.emit('permission-error', permissionError);
            toast({
                variant: 'destructive',
                title: 'Order Failed',
                description: 'Could not place your order or update stock. Please try again.',
            });
        }
    });
  };

  const areAllDetailsReady = useMemo(() => {
    return cartItems.length > 0 && activeStoreId && form.getValues('deliveryAddress').length > 10;
  }, [cartItems.length, activeStoreId, form.getValues('deliveryAddress')]);

  useEffect(() => {
      if (shouldPlaceOrderDirectly && areAllDetailsReady && placeOrderBtnRef.current) {
          console.log("Direct order conditions met. Clicking place order.");
          placeOrderBtnRef.current.click();
          setShouldPlaceOrderDirectly(false); // Reset after action
      }
  }, [shouldPlaceOrderDirectly, areAllDetailsReady, placeOrderBtnRef, setShouldPlaceOrderDirectly]);


  if (!hasItemsInCart && !isWaitingForQuickOrderConfirmation) {
      return (
          <div className="container mx-auto py-24 text-center">
              <h1 className="text-4xl font-bold mb-4 font-headline">
                  {t('your-cart-is-empty')}
              </h1>
              <p className="text-muted-foreground mb-8">
                  {t('please-add-items-to-your-cart-before-proceeding')}
              </p>
              <Button asChild size="lg">
                  <Link href="/">{t('browse-stores')}</Link>
              </Button>
          </div>
      );
  }

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid md:grid-cols-2 gap-12">
                <div>
                    <Card>
                        <CardHeader>
                        <CardTitle>{t('order-summary')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {cartItems.map((item) => {
                                const image = images[item.variant.sku] || { imageUrl: 'https://placehold.co/48x48/E2E8F0/64748B?text=...', imageHint: 'loading' };
                                return <OrderSummaryItem key={item.variant.sku} item={item} image={image} />
                            })}
                            {cartItems.length === 0 && (
                                <div className="text-center text-muted-foreground py-8">
                                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                                    <p className="mt-2">{t('loading-your-quick-order-item')}</p>
                                </div>
                            )}
                            <div className="flex justify-between items-center border-t pt-4">
                                <p className="font-medium">{t('subtotal')}</p>
                                <p>₹{cartTotal.toFixed(2)}</p>
                            </div>
                            <div className="flex justify-between items-center">
                                <p className="font-medium">{t('delivery-fee')}</p>
                                <p>₹{DELIVERY_FEE.toFixed(2)}</p>
                            </div>
                        </CardContent>
                        <CardFooter className="flex justify-between font-bold text-lg border-t pt-4">
                            <span>{t('total')}</span>
                            <span id="final-total-amount">₹{finalTotal.toFixed(2)}</span>
                        </CardFooter>
                    </Card>
                </div>
                <div>
                    <Card>
                        <CardHeader>
                        <CardTitle>{t('delivery-and-store-selection')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <FormField
                                control={form.control}
                                name="name"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('full-name')}</FormLabel>
                                    <FormControl>
                                    <Input placeholder="John Doe" {...field} readOnly={!!userData?.firstName} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />
                            <div className="space-y-4">
                                <FormLabel>{t('delivery-location')}</FormLabel>
                                <div className="grid grid-cols-2 gap-4">
                                <Button type="button" variant="outline" onClick={handleUseHomeAddress} disabled={!userData?.address}>
                                        <Home className="mr-2 h-4 w-4" /> Use Home Address
                                </Button>
                                <Button type="button" variant="outline" onClick={handleUseCurrentLocation}>
                                        <LocateFixed className="mr-2 h-4 w-4" /> Use Current Location
                                </Button>
                                </div>
                                <FormField
                                    control={form.control}
                                    name="deliveryAddress"
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormControl>
                                        <Input placeholder="Select a delivery address above" {...field} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </div>
                            <FormField
                                control={form.control}
                                name="phone"
                                render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t('phone-number')}</FormLabel>
                                    <FormControl>
                                    <Input placeholder="(555) 123-4567" {...field} readOnly={!!userData?.phoneNumber} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                                )}
                            />

                            <div className="space-y-2">
                                <FormLabel>{t('fulfilling-store')}</FormLabel>
                                 <div className="flex items-center gap-2 p-3 rounded-md border bg-muted">
                                    <StoreIcon className="h-5 w-5 text-muted-foreground" />
                                    <span className="font-medium">{localBasketStore?.name || 'Loading...'}</span>
                                </div>
                                {!activeStoreId && !isWaitingForQuickOrderConfirmation && (
                                    <Alert variant="destructive" id="action-required-alert">
                                        <AlertCircle className="h-4 w-4" />
                                        <AlertTitle>{t('action-required')}</AlertTitle>
                                        <AlertDescription>
                                            {t('please-select-a-store-to-continue')}
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>

                            <Button ref={placeOrderBtnRef} type="submit" disabled={isPlacingOrder || !areAllDetailsReady} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                                {isPlacingOrder ? t('placing-order') : t('place-order')}
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </form>
        </Form>
    </div>
  );
}
