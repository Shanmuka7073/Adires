
'use client';

import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Minus, Loader2 } from 'lucide-react';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '../ui/label';

function GuestOrderDialog({ isOpen, onOpenChange, onPlaceOrder }: { isOpen: boolean, onOpenChange: (open: boolean) => void, onPlaceOrder: (name: string, phone: string) => void }) {
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [isPending, startTransition] = useTransition();
    
    const handleSubmit = () => {
        startTransition(() => {
            onPlaceOrder(name, phone);
        });
    }

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Place Guest Order</DialogTitle>
                    <DialogDescription>
                        Please provide your name and phone number to place your order.
                    </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="guest-name">Name</Label>
                        <Input id="guest-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your Name" />
                    </div>
                     <div className="space-y-2">
                        <Label htmlFor="guest-phone">Phone Number</Label>
                        <Input id="guest-phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Mobile Number" />
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={!name || !phone || isPending}>
                         {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                         Place Order
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

function CartSheetItem({ item, image }: { item: any, image: any }) {
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
  const { cartItems, cartTotal, cartCount, clearCart } = useCart();
  const [images, setImages] = useState({});
  const { user } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const [isPlacingOrder, startOrderTransition] = useTransition();
  const [isGuestDialogOpen, setIsGuestDialogOpen] = useState(false);

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
        }, {});
        setImages(imageMap);
    };

    fetchImages();
  }, [cartItems]);
  
  const handlePlaceOrder = (guestInfo?: { name: string, phone: string }) => {
    if (!user && !guestInfo) {
        setIsGuestDialogOpen(true);
        return;
    }

    startOrderTransition(async () => {
        const result = await placeRestaurantOrder(cartItems, cartTotal, guestInfo);
        if (result.success && result.orderId) {
            toast({
                title: 'Order Placed!',
                description: 'Your order has been sent to the kitchen.',
            });
            clearCart();
            setIsGuestDialogOpen(false); // Close dialog on success
            router.push(`/order-confirmation?orderId=${result.orderId}`);
        } else {
            toast({
                variant: 'destructive',
                title: 'Order Failed',
                description: result.error || 'Could not place your order. Please try again.',
            });
        }
    });
  };

  return (
    <>
      <GuestOrderDialog 
        isOpen={isGuestDialogOpen} 
        onOpenChange={setIsGuestDialogOpen}
        onPlaceOrder={(name, phone) => handlePlaceOrder({ name, phone })}
      />
      <SheetHeader>
        <SheetTitle>{t('shopping-cart')} ({cartCount})</SheetTitle>
        <SheetDescription className="sr-only">
          A summary of the items in your shopping cart. You can view, update quantities, or remove items.
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
              <div className="flex justify-between font-bold text-lg">
                <span>{t('total')}</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
              {isRestaurantOrder ? (
                 <Button onClick={() => handlePlaceOrder()} disabled={isPlacingOrder} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                    {isPlacingOrder ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : null}
                    {isPlacingOrder ? 'Placing Order...' : 'Place Order Now'}
                 </Button>
              ) : (
                <SheetClose asChild>
                    <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                        <Link href="/cart">{t('proceed-to-checkout')}</Link>
                    </Button>
                </SheetClose>
              )}
            </div>
          </SheetFooter>
        </div>
      ) : (
          <div className="flex flex-1 h-full items-center justify-center">
            <p>{t('your-cart-is-empty')}</p>
          </div>
      )}
    </>
  );
}
