
'use client'

import { useCart } from '@/lib/cart';
import type { Product, ProductPrice } from '@/lib/types';
import Image from 'next/image';
import { useAppStore } from '@/lib/store';
import { t } from '@/lib/locales';

interface ProductCardProps {
  product: Product;
  priceData?: ProductPrice | null;
}

export default function ProductCard({ product, priceData }: ProductCardProps) {
  const { addItem, setActiveStoreId } = useCart();

  const handleAddToCart = () => {
    // For simplicity, we'll add the first available variant to the cart.
    // A more advanced implementation would allow variant selection.
    if (priceData && priceData.variants && priceData.variants.length > 0) {
      addItem(product, priceData.variants[0]);
    }
  };

  const englishName = t(product.name.toLowerCase().replace(/ /g, '-'), 'en');

  // Restore discount logic
  const originalPrice = priceData?.variants?.[0]?.price;
  const finalPrice = originalPrice ? originalPrice * 0.9 : null; // 10% discount

  return (
    <div className="rounded-2xl bg-white shadow-md p-3 transition-all hover:shadow-xl hover:-translate-y-1">
      <div className="w-full h-32 bg-gray-100 rounded-xl overflow-hidden">
        <Image 
          src={product.imageUrl || 'https://picsum.photos/seed/placeholder/300/300'}
          alt={product.name}
          width={300}
          height={300}
          className="object-cover w-full h-full transition-transform hover:scale-110"
        />
      </div>

      <h3 className="mt-3 font-semibold text-gray-900 text-sm line-clamp-2">
        {englishName}
      </h3>

      <div className="flex items-center gap-2 mt-1">
        {finalPrice !== null && originalPrice ? (
          <>
            <p className="text-green-700 font-bold">
              ₹{finalPrice.toFixed(2)}
            </p>
            <s className="text-gray-400 text-xs">
              ₹{originalPrice.toFixed(2)}
            </s>
          </>
        ) : (
          <p className="text-gray-500 text-sm">Unavailable</p>
        )}
      </div>

      <button onClick={handleAddToCart} className="mt-2 w-full bg-green-500 hover:bg-green-600 text-white font-medium py-1.5 rounded-xl">
        Add to cart
      </button>
    </div>
  );
}
