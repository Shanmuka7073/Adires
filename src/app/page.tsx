
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Product as ProductType, ProductPrice } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { ShoppingCart } from 'lucide-react';
import Link from 'next/link';

function classNames(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

// --- Product Card Component ---
function ProductCard({ product }: { product: ProductType }) {
  const { addItem } = useCart();
  const { productPrices } = useAppStore();
  const [image, setImage] = useState({ imageUrl: '', imageHint: 'loading' });

  useEffect(() => {
    const fetchImage = async () => {
      if (product) {
        const fetchedImage = await getProductImage(product.imageId);
        setImage(fetchedImage);
      }
    };
    fetchImage();
  }, [product]);

  const priceData = productPrices[product.name.toLowerCase()];
  const variant = priceData?.variants?.[0]; // Use first variant for display

  const handleAddToCart = () => {
    if (variant) {
      addItem(product, variant);
    }
  };

  const discountPct = useMemo(() => {
    if (!variant) return 0;
    const finalPrice = variant.price * 1.20;
    const originalPrice = finalPrice / 0.85;
    return Math.round(((originalPrice - finalPrice) / originalPrice) * 100);
  }, [variant]);
  
  const finalPrice = variant ? (variant.price * 1.20).toFixed(2) : 'N/A';
  const originalPrice = variant ? (parseFloat(finalPrice) / 0.85).toFixed(2) : 'N/A';


  return (
    <article className="bg-white rounded-2xl shadow-sm overflow-hidden relative">
      {discountPct > 0 && (
        <div className="absolute z-10 left-3 top-3 bg-red-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
          {discountPct}% OFF
        </div>
      )}
      <div className="w-full h-40 bg-gray-50 overflow-hidden">
        <Image 
          src={image.imageUrl || '/images/placeholder.jpg'} 
          alt={product.name}
          data-ai-hint={image.imageHint}
          width={200}
          height={160}
          className="w-full h-full object-cover" />
      </div>
      <div className="p-3">
        <h3 className="text-base font-semibold text-[#0f172a] truncate">{product.name}</h3>
        {product.teluguName && <div className="text-xs text-gray-500 mt-0.5">{product.teluguName}</div>}
        <div className="mt-3 flex items-center justify-between">
          <div>
            <div className="text-green-600 font-bold text-lg">₹{finalPrice}</div>
            {variant && <div className="text-xs text-gray-400 line-through">₹{originalPrice}</div>}
          </div>
          <div className="text-xs text-gray-500">{variant?.weight}</div>
        </div>
        <div className="mt-3">
          <Button onClick={handleAddToCart} disabled={!variant} className="w-full bg-[#ff7a00] hover:bg-[#ff6c00] text-white py-2 rounded-lg text-sm flex items-center justify-center gap-2">
            <ShoppingCart className="w-4 h-4" />
            Add to Cart
          </Button>
        </div>
      </div>
    </article>
  );
}

// --- Skeleton Component ---
function ProductCardSkeleton() {
    return (
        <article className="bg-white rounded-2xl shadow-sm p-3 animate-pulse">
            <div className="h-40 bg-gray-100 rounded-xl mb-3" />
            <div className="h-4 bg-gray-200 w-3/5 rounded mb-2" />
            <div className="h-3 bg-gray-200 w-1/2 rounded mb-4" />
            <div className="h-8 bg-gray-200 rounded" />
        </article>
    )
}

// --- Sidebar Component ---
function CategorySidebar({ categories, activeCategory, onSelectCategory, isLoading }) {
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { stores } = useAppStore();
  const firstStoreId = stores.find(s => s.name === 'LocalBasket')?.id;


  useEffect(() => {
    if (!sidebarRef.current || !activeButtonRef.current) return;
    const sidebar = sidebarRef.current;
    const item = activeButtonRef.current;
    const offsetTop = item.offsetTop - sidebar.clientHeight / 2 + item.clientHeight / 2;
    sidebar.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
  }, [activeCategory]);
  
  if (!firstStoreId) return null;

  return (
    <aside
      ref={sidebarRef}
      className="w-[72px] bg-[#f3faf3] border-r border-[#e2f0e2] rounded-lg py-4 px-1 h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar"
      aria-label="Categories"
    >
      <div className="flex flex-col items-center gap-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
             <div key={i} className="flex flex-col items-center w-[60px] p-2 rounded-2xl space-y-1">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="h-2 w-10" />
            </div>
          ))
        ) : (
          categories.map((cat) => {
            const active = cat.categoryName === activeCategory;
            return (
              <Link
                key={cat.id}
                href={`/stores/${firstStoreId}?category=${cat.categoryName}`}
                passHref
                legacyBehavior
              >
              <a
                ref={active ? activeButtonRef : undefined}
                onClick={(e) => { e.preventDefault(); onSelectCategory(cat.categoryName); router.push(`/stores/${firstStoreId}?category=${cat.categoryName}`)}}
                className={classNames(
                  'flex flex-col items-center w-[60px] p-2 rounded-2xl transition-transform focus:outline-none cursor-pointer',
                  active ? 'border-2 border-green-600 shadow-md bg-white' : 'border border-transparent bg-white/90'
                )}
                aria-pressed={active}
                title={cat.name}
              >
                <div className="w-12 h-12 rounded-full overflow-hidden bg-white flex items-center justify-center">
                  <Image src={cat.icon} alt={cat.name} width={40} height={40} className="w-10 h-10 object-cover" />
                </div>
                <span className="text-[11px] mt-1 text-center text-gray-700 truncate w-[52px]">{cat.name}</span>
              </a>
              </Link>
            );
          })
        )}
      </div>
       <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </aside>
  );
}

// --- Main Homepage Component ---
export default function LocalBasketHomepage() {
  const { masterProducts, loading: isAppLoading } = useAppStore();
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [categoryIcons, setCategoryIcons] = useState<any[]>([]);

  useEffect(() => {
    setIsLoading(true);
    const t = setTimeout(() => setIsLoading(isAppLoading), 700);
    return () => clearTimeout(t);
  }, [isAppLoading]);
  
  const categories = useMemo(() => {
    if (!masterProducts) return [];
    return [...new Set(masterProducts.map(p => p.category).filter(Boolean))]
      .map(catName => ({ id: catName, name: catName, icon: '' }));
  }, [masterProducts]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
      setActiveCategory(categories[0].id);
    }
  }, [categories, activeCategory]);

   useEffect(() => {
        const fetchCategoryIcons = async () => {
            if (categories.length === 0) return;
            const iconPromises = categories.map(cat => {
                const imageId = `cat-${cat.name.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-')}`;
                return getProductImage(imageId);
            });
            const icons = await Promise.all(iconPromises);
            setCategoryIcons(categories.map((cat, index) => ({...cat, icon: icons[index].imageUrl})));
        }
        fetchCategoryIcons();
    }, [categories]);


  const featuredProducts = useMemo(() => {
    if (!masterProducts) return [];
    return masterProducts.slice(0, 8); // Show more featured products
  }, [masterProducts]);

  const gridCols = 'grid-cols-2 md:grid-cols-3';

  return (
    <div className="min-h-screen bg-[#ecf8ee] text-[#1f2937]">
      <div className="max-w-6xl mx-auto px-3 md:px-6 py-4 flex gap-4">
        <CategorySidebar categories={categoryIcons} activeCategory={activeCategory} onSelectCategory={setActiveCategory} isLoading={isLoading} />
        <main className="flex-1">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-[#0f172a]">Featured Products</h1>
              <p className="text-sm text-gray-500 mt-1">Curated products just for you</p>
            </div>
            <div className="w-full md:w-96 ml-4">
              <label htmlFor="search" className="sr-only">Search</label>
              <div className="relative">
                <input id="search" type="search" placeholder="Search all products..." className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-200 focus:border-green-400" />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</div>
              </div>
            </div>
          </div>
          <section>
            {isLoading ? (
              <div className={`grid gap-4 ${gridCols}`}>
                {Array.from({ length: 6 }).map((_, i) => (
                  <ProductCardSkeleton key={i} />
                ))}
              </div>
            ) : (
              <div className={`grid gap-4 ${gridCols}`}>
                {featuredProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

    