
'use client';

import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import { SheetHeader, SheetTitle, SheetFooter, SheetClose, SheetDescription } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Plus, Minus } from 'lucide-react';
import Link from 'next/link';
import { Input } from '../ui/input';
import { useEffect, useState } from 'react';
import { t } from '@/lib/locales';

// A component to render each item, now receiving image data directly
function CartSheetItem({ item }) {
    const { removeItem, updateQuantity } = useCart();
    const { product, variant, quantity } = item;

    return (
        <div className="flex items-center gap-4 py-3">
            <div className="flex-1 grid gap-1">
                <p className="font-medium leading-tight line-clamp-2">{product.name} <span className="text-sm text-muted-foreground">({variant.weight})</span></p>
                <p className="text-sm font-semibold">₹{(variant.price * quantity).toFixed(2)}</p>
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
  const { cartItems, cartTotal, cartCount } = useCart();
  
  return (
    <>
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
                return <CartSheetItem key={item.variant.sku} item={item} />
              })}
            </div>
        </ScrollArea>
        <SheetFooter className="pt-4 border-t">
            <div className="w-full space-y-4">
              <div className="flex justify-between font-bold text-lg">
                <span>{t('total')}</span>
                <span>₹{cartTotal.toFixed(2)}</span>
              </div>
              <SheetClose asChild>
                  <Button asChild className="w-full bg-accent hover:bg-accent/90 text-accent-foreground">
                      <Link href="/cart">{t('proceed-to-checkout')}</Link>
                  </Button>
              </SheetClose>
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
