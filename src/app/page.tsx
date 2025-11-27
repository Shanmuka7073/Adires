
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Product as ProductType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useFirebase } from '@/firebase';
import { Search, Menu as MenuIcon, ShoppingCart, User as UserIcon, Mic } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { t } from '@/lib/locales';

/**
 * Full homepage component (Blinkit-style)
 * - Medium cards
 * - Sidebar style B: Big rounded pills with icon + label
 * - Responsive: 2 cols mobile / 3 cols md / 4 cols lg
 *
 * Notes:
 * - Keeps existing app logic (fetchInitialData, fetchProductPrices)
 * - ProductCard implemented inline to ensure consistent look
 */

/* ---------- Sidebar (Style B: Big Rounded Rectangles) ---------- */
function CategorySidebar({
  categories,
  activeCategory,
  onSelectCategory,
  isLoading
}: {
  categories: { id: string; name: string; icon?: string }[];
  activeCategory: string;
  onSelectCategory: (name: string) => void;
  isLoading: boolean;
}) {
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!sidebarRef.current || !activeRef.current) return;
    const sidebar = sidebarRef.current;
    const el = activeRef.current;
    const offsetTop = el.offsetTop - sidebar.clientHeight / 2 + el.clientHeight / 2;
    sidebar.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
  }, [activeCategory]);

  return (
    <aside
      ref={sidebarRef}
      className="hidden md:block w-[96px] bg-white/60 backdrop-blur-sm shadow-sm rounded-3xl p-3 h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar"
      aria-label="Categories"
    >
      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-2 rounded-xl">
              <Skeleton className="w-12 h-12 rounded-full" />
              <div className="flex-1">
                <Skeleton className="h-3 w-full mb-1" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))
        ) : (
          categories.map((cat) => {
            const active = cat.name === activeCategory;
            return (
              <button
                key={cat.id}
                ref={active ? activeRef : undefined}
                onClick={() => onSelectCategory(cat.name)}
                className={cn(
                  'flex flex-col items-center justify-center text-center p-2 rounded-2xl transition-all duration-200 w-[72px] h-[72px] focus:outline-none',
                  active
                    ? 'bg-green-500 text-white shadow-lg transform scale-[1.02]'
                    : 'bg-white hover:bg-green-50 border border-gray-100'
                )}
                aria-pressed={active}
                title={cat.name}
              >
                {cat.icon ? (
                  <Image src={cat.icon} alt={cat.name} width={36} height={36} className="object-contain w-9 h-9" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gray-100" />
                )}
                <span className="text-[10px] font-medium truncate w-full mt-1.5">{cat.name}</span>
              </button>
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

/* ---------- ProductCard (Medium Card - Blinkit style) ---------- */
function ProductCard({
  product,
  priceData
}: {
  product: ProductType;
  priceData?: { variants?: { price: number; weight: string }[] };
}) {
  const { addItem } = useCart();
  const priceInfo = priceData?.variants?.[0] ?? null;

  const handleAddToCart = () => {
    if (priceInfo) {
      addItem(product, { ...priceInfo, stock: 50, sku: `${product.id}-${priceInfo.weight}`});
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 transition-shadow hover:shadow-md flex flex-col">
      <div className="w-full h-36 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} width={320} height={320} className="object-cover w-full h-full" />
        ) : (
          <div className="w-24 h-24 rounded-md bg-gray-100" />
        )}
      </div>

      <div className="mt-3 flex-1 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</h3>

        <div className="mt-2 flex items-center justify-between">
          <div>
            {priceInfo ? (
              <div className="text-green-600 font-bold text-sm">₹{(+priceInfo.price).toFixed(2)}</div>
            ) : (
              <div className="text-gray-400 text-sm">—</div>
            )}
            <div className="text-xs text-gray-400 mt-0.5">{priceInfo?.weight || ''}</div>
          </div>

          <button
            onClick={handleAddToCart}
            className="bg-green-500 hover:bg-green-600 text-white text-sm font-medium px-3 py-1.5 rounded-lg shadow-sm"
            type="button"
            aria-label={`Add ${product.name} to cart`}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Main Homepage Component ---------- */
export default function LocalBasketHomepage() {
  const { masterProducts, productPrices, loading: isAppLoading, fetchProductPrices, fetchInitialData } = useAppStore();
  const { firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryIcons, setCategoryIcons] = useState<{ id: string; name: string; icon?: string }[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState<boolean>(true);

  // Load initial data on mount
  useEffect(() => {
    if (firestore && !useAppStore.getState().isInitialized) {
      fetchInitialData(firestore);
    }
  }, [firestore, fetchInitialData]);

  // Build categories from masterProducts
  const categories = useMemo(() => {
    if (!masterProducts) return [];
    return [...new Set(masterProducts.map((p) => p.category).filter(Boolean))].map((name) => ({
      id: name,
      name,
      icon: ''
    }));
  }, [masterProducts]);

  // Default active category from URL or fallback
  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    if (categories.length > 0) {
      if (categoryFromUrl && categories.some((c) => c.name === categoryFromUrl)) {
        setActiveCategory(categoryFromUrl);
      } else if (!activeCategory) {
        setActiveCategory(categories[0].name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, searchParams]);

  // Fetch category icons once categories available
  useEffect(() => {
    let mounted = true;
    const fetchIcons = async () => {
      if (categories.length === 0) return setSidebarLoading(false);
      try {
        setSidebarLoading(true);
        const promises = categories.map((cat) => {
          // Build image id the same as earlier; fallback if not present
          const imageId = `cat-${cat.name.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-')}`;
          return getProductImage(imageId).catch(() => ({ imageUrl: '' }));
        });
        const icons = await Promise.all(promises);
        if (!mounted) return;
        setCategoryIcons(categories.map((cat, i) => ({ ...cat, icon: icons[i]?.imageUrl || '' })));
      } catch (err) {
        setCategoryIcons(categories.map((cat) => ({ ...cat, icon: '' })));
      } finally {
        if (mounted) {
            setSidebarLoading(false);
        }
      }
    };
    fetchIcons();
    return () => {
      mounted = false;
    };
  }, [categories]);

  // Filtered products based on search / category
  const filteredProducts = useMemo(() => {
    if (!masterProducts) return [];
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      return masterProducts.filter((p) => p.name.toLowerCase().includes(term));
    }
    if (activeCategory) {
      return masterProducts.filter((p) => p.category === activeCategory);
    }
    return masterProducts.slice(0, 18);
  }, [masterProducts, activeCategory, searchTerm]);

  // Fetch prices for visible products
  useEffect(() => {
    if (!firestore || filteredProducts.length === 0) return;
    const names = filteredProducts.map((p) => p.name);
    fetchProductPrices(firestore, names);
  }, [firestore, filteredProducts, fetchProductPrices]);

  // Handler when clicking category
  const handleSelectCategory = (categoryName: string) => {
    setActiveCategory(categoryName);
    setSearchTerm('');
    const { stores } = useAppStore.getState();
    const firstStoreId = stores.find((s) => s.name === 'LocalBasket')?.id;
    if (firstStoreId) {
      router.push(`/stores/${firstStoreId}?category=${encodeURIComponent(categoryName)}`);
    } else {
      router.push(`/?category=${encodeURIComponent(categoryName)}`);
    }
  };

  const gridCols = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  const title = t(activeCategory?.toLowerCase(), 'en') || 'Featured Products';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f6fff6] to-[#ecf8ee] text-[#0f172a]">
      {/* Top Navigation */}
      <div className="bg-white/40 backdrop-blur-md sticky top-0 z-30 border-b border-green-50">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button className="p-2 rounded-xl bg-white shadow-sm md:hidden">
              <MenuIcon className="w-5 h-5 text-gray-700" />
            </button>

            <div className="flex flex-col">
              <h2 className="text-lg font-semibold">{title}</h2>
              <span className="text-xs text-gray-500">{filteredProducts.length} products</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center bg-white rounded-xl px-3 py-2 shadow-sm">
              <button className="mr-2">
                <Mic className="w-4 h-4 text-green-600" />
              </button>
              <div className="relative w-60">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-green-600 w-4 h-4" />
                <input
                  aria-label="Search products"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search all products..."
                  className="w-full pl-10 pr-3 py-2 rounded-lg bg-transparent outline-none text-sm"
                />
              </div>
            </div>

            <button className="p-2 rounded-xl bg-white shadow-sm">
              <ShoppingCart className="w-5 h-5 text-gray-700" />
            </button>

            <button className="p-2 rounded-xl bg-white shadow-sm">
              <UserIcon className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="max-w-6xl mx-auto px-3 md:px-6 py-6 flex gap-4">
        {/* Sidebar */}
        <CategorySidebar
          categories={categoryIcons.length ? categoryIcons : categories}
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          isLoading={sidebarLoading || isAppLoading}
        />

        {/* Main area */}
        <main className="flex-1">
          {/* Mobile search (visible on small screens) */}
          <div className="md:hidden mb-4">
            <div className="flex items-center bg-white rounded-xl px-3 py-2 shadow-sm">
              <Search className="w-4 h-4 text-green-600 mr-2" />
              <input
                aria-label="Search products"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="w-full text-sm outline-none bg-transparent"
              />
            </div>
          </div>

          {/* Products */}
          <section>
            {isAppLoading ? (
              <div className={`grid gap-4 ${gridCols}`}>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-56 w-full rounded-2xl" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No products found.</div>
            ) : (
              <div className={`grid gap-4 ${gridCols}`}>
                {filteredProducts.map((p: ProductType) => (
                  <ProductCard key={p.id} product={p} priceData={productPrices?.[p.name.toLowerCase()]} />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

