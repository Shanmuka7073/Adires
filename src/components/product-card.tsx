
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

      <p className="text-green-700 font-bold mt-1">
        ₹{priceData?.variants?.[0]?.price?.toFixed(2) || "—"}
      </p>

      <button onClick={handleAddToCart} className="mt-2 w-full bg-green-500 hover:bg-green-600 text-white font-medium py-1.5 rounded-xl">
        Add to cart
      </button>
    </div>
  );
}
