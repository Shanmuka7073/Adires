
'use client';

import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Minus, Loader2, LogIn, ShoppingBag, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { Input } from '../ui/input';
import { useEffect, useState, useTransition } from 'react';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/locales';
import { placeRestaurantOrder } from '@/app/actions';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import type { CartItem } from '@/lib/types';

function CartSheetItem({ item, image }: { item: CartItem, image: { imageUrl: string; imageHint: string } }) {
    const { removeItem, updateQuantity } = useCart();
    const { product, variant, quantity } = item;
    
    const productNameKey = product.name.toLowerCase().replace(/ /g, '-');
    const englishName = t(productNameKey, 'en');
    const teluguName = t(productNameKey, 'te');
    
    return (
        <div className="flex items-center gap-4 py-3">
            <Image
                src={image.imageUrl}
                alt={product.name}
                data-ai-hint={image.imageHint}
                width={40}
                height={40}
                className="rounded-md object-cover"
            />
            <div className="flex-1 grid gap-1">
                <div>
                    <p className="font-medium leading-tight line-clamp-2">{englishName} <span className="text-sm text-muted-foreground">({variant.weight})</span></p>
                    <p className="text-xs text-muted-foreground">{teluguName}</p>
                </div>
                <div className="flex items-baseline gap-2">
                    <p className="text-sm font-semibold">₹{(variant.price * quantity).toFixed(2)}</p>
                </div>
                 <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(variant.sku, quantity - 1)}>
                        <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                        type="number"
                        min="1"
                        value={quantity}
                        onChange={(e) => updateQuantity(variant.sku, parseInt(e.target.value) || 1)}
                        className="w-12 h-7 text-center"
                        aria-label={`Quantity for ${product.name} (${variant.weight})`}
                    />
                    <Button variant="outline" size="icon" className="h-7 w-7" onClick={() => updateQuantity(variant.sku, quantity + 1)}>
                        <Plus className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={() => removeItem(variant.sku)} className="self-center">
                <Trash2 className="h-4 w-4 text-muted-foreground" />
                <span className="sr-only">Remove {product.name} ({variant.weight})</span>
            </Button>
        </div>
    );
}

export function CartSheetContent() {
  const { cartItems, cartTotal, cartCount, clearCart, sessionId } = useCart();
  const { deviceId, setCartOpen } = useAppStore();
  const [images, setImages] = useState<Record<string, { imageUrl: string; imageHint: string }>>({});
  const { user, auth, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isPlacingOrder, startOrderTransition] = useTransition();

  const isRestaurantOrder = cartItems.length > 0 && cartItems.every(item => item.product.isMenuItem);
  
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
        }, {} as Record<string, { imageUrl: string; imageHint: string }>);
        setImages(imageMap);
    };

    fetchImages();
  }, [cartItems]);
  
  const handlePlaceOrder = () => {
    // GUEST CHECKOUT: Allow placing orders without login for restaurants/retail
    if (!user) {
        setCartOpen(false);
        router.push('/checkout');
        return;
    }

    startOrderTransition(async () => {
        try {
            if (!auth || !firestore) throw new Error("Firebase services not available.");
            
            const idToken = await user.getIdToken();
            const guestInfo = {
                name: `${user.displayName || 'Authenticated User'}`,
                phone: user.phoneNumber || 'N/A',
                tableNumber: cartItems.find(i => i.tableNumber)?.tableNumber || 'N/A'
            };

            const result = await placeRestaurantOrder(cartItems, cartTotal, guestInfo, idToken, sessionId || undefined, deviceId || undefined);

            if (result.success && result.orderId) {
                toast({ title: 'Order Placed!', description: 'Your order has been sent to the kitchen.' });
                clearCart();
                setCartOpen(false);
                router.push(`/order-confirmation?orderId=${result.orderId}`);
            } else {
                throw new Error(result.error || 'Could not place your order.');
            }
        } catch (error: any) {
             toast({ variant: 'destructive', title: 'Order Failed', description: error.message });
        }
    });
  };

  return (
    <>
      <SheetHeader>
        <SheetTitle>{t('shopping-cart')} ({cartCount})</SheetTitle>
        <SheetDescription className="sr-only">
          A summary of your shopping cart. Guest checkout available for restaurants.
        </SheetDescription>
      </SheetHeader>
      
      {cartItems.length > 0 ? (
      <div className="flex flex-col h-full">
        <ScrollArea className="flex-1 my-4 pr-4">
            <div className="flex flex-col divide-y">
              {cartItems.map((item) => {
                const image = images[item.variant.sku] || { imageUrl: 'https://placehold.co/40x40/E2E8F0/64748B?text=...', imageHint: 'loading' };
                return <CartSheetItem key={item.variant.sku} item={item} image={image} />
              })}
            </div>
        </ScrollArea>
        <SheetFooter className="pt-4 border-t">
            <div className="w-full space-y-4">
              <div className="flex justify-between font-black text-lg">
                <span className="uppercase text-[10px] opacity-40">Total Amount</span>
                <span className="text-primary">₹{cartTotal.toFixed(2)}</span>
              </div>
              
              <Button onClick={handlePlaceOrder} disabled={isPlacingOrder} className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase text-xs tracking-widest shadow-xl shadow-primary/20 transition-all active:scale-95">
                {isPlacingOrder ? <Loader2 className="mr-2 h-5 w-5 animate-spin"/> : <ShoppingBag className="mr-2 h-5 w-5" />}
                {isPlacingOrder ? 'Processing...' : 'Confirm Order'}
              </Button>

              {!user && (
                  <p className="text-[9px] font-bold text-center text-gray-400 uppercase tracking-widest">
                      Guest Checkout • No Login Required
                  </p>
              )}
            </div>
          </SheetFooter>
        </div>
      ) : (
          <div className="flex flex-1 h-full flex-col items-center justify-center opacity-30">
            <ShoppingCart className="h-16 w-16 mb-4" />
            <p className="font-black uppercase tracking-widest text-xs">Your cart is empty</p>
          </div>
      )}
    </>
  );
}
