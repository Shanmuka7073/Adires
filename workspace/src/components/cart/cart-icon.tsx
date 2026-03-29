'use client';

import { ShoppingCart } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetTrigger, SheetContent } from '@/components/ui/sheet';
import { CartSheetContent } from './cart-sheet';
import type * as SheetPrimitive from "@radix-ui/react-dialog"
import { useCart } from '@/lib/cart';


interface CartIconProps extends React.ComponentProps<typeof SheetPrimitive.Root> {}


export function CartIcon({ open, onOpenChange }: CartIconProps) {
  const { cartCount } = useCart();

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon" className="relative rounded-xl shadow-sm bg-white">
          <ShoppingCart className="h-5 w-5 text-gray-700" />
          {cartCount > 0 && (
            <span className="absolute top-0 right-0 flex h-4 w-4 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white ring-2 ring-white">
              {cartCount}
            </span>
          )}
          <span className="sr-only">Open cart</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[90vw] sm:w-[540px]">
        <CartSheetContent />
      </SheetContent>
    </Sheet>
  );
}
