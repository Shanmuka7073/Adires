
'use client'

import { useCart } from '@/lib/cart';
import type { Product, ProductPrice } from '@/lib/types';
import Image from 'next/image';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/locales';
import { Button } from './ui/button';
import { Plus, Minus, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface ProductCardProps {
  product: Product;
  priceData?: ProductPrice | null;
}

export default function ProductCard({ product, priceData }: ProductCardProps) {
  const { cartItems, addItem, updateQuantity } = useCart();
  const priceInfo = priceData?.variants?.[0] ?? null;
  const [isFavorite, setIsFavorite] = useState(false);

  const itemInCart = cartItems.find(item => item.variant.sku === priceInfo?.sku);

  const handleAddToCart = () => {
    if (priceInfo) {
      addItem(product, priceInfo, 1);
    }
  };
  
  const handleIncrease = () => {
    if (itemInCart) {
      updateQuantity(itemInCart.variant.sku, itemInCart.quantity + 1);
    }
  };

  const handleDecrease = () => {
    if (itemInCart) {
      updateQuantity(itemInCart.variant.sku, itemInCart.quantity - 1);
    }
  };
  
  const englishName = t(product.name.toLowerCase().replace(/ /g, '-'), 'en');

  // Apply a 20% markup for the "original" price, then apply a 15% discount
  const originalPrice = priceInfo ? priceInfo.price * 1.20 : null;
  const finalPrice = originalPrice ? originalPrice * 0.85 : null; // 15% discount

  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 transition-all hover:shadow-md flex flex-col">
      <div className="w-full h-36 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center relative group">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} width={320} height={320} className="object-cover w-full h-full" />
        ) : (
          <div className="w-24 h-24 rounded-md bg-gray-100" />
        )}
        <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
            15% OFF
        </div>
        <Button 
            size="icon" 
            variant="ghost" 
            className="absolute top-1 right-1 h-7 w-7 rounded-full bg-white/50 backdrop-blur-sm hover:bg-white opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={() => setIsFavorite(!isFavorite)}
        >
            <Heart className={cn("h-4 w-4 text-gray-500", isFavorite && "fill-red-500 text-red-500")} />
            <span className="sr-only">Favorite</span>
        </Button>
      </div>

      <div className="mt-3 flex-1 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{englishName}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{priceInfo?.weight || ''}</p>

        <div className="mt-auto pt-2 flex items-center justify-between">
            {finalPrice !== null && originalPrice ? (
              <div className="flex items-center gap-2">
                <p className="text-green-700 font-bold text-sm">
                  ₹{finalPrice.toFixed(2)}
                </p>
                <s className="text-gray-400 text-xs">
                  ₹{originalPrice.toFixed(2)}
                </s>
              </div>
            ) : (
              <div className="text-gray-400 text-sm">—</div>
            )}
             {itemInCart ? (
                <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={handleDecrease}>
                        <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-bold">{itemInCart.quantity}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={handleIncrease}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                 <Button
                    size="icon"
                    className="h-8 w-8 rounded-full bg-green-100 text-green-700 hover:bg-green-200 shadow-none font-bold"
                    type="button"
                    aria-label={`Add ${product.name} to cart`}
                    onClick={handleAddToCart}
                    disabled={!priceInfo}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            )}
        </div>
      </div>
    </div>
  );
}
