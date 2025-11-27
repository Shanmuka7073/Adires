'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Product as ProductType, ProductPrice } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useFirebase } from '@/firebase';
import { Search, Menu as MenuIcon, ShoppingCart, User as UserIcon, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/locales';
import { useCart } from '@/lib/cart';

/* ---------------- HEADER ---------------- */
function Header() {
  return (
    <div className="bg-white/50 backdrop-blur-md sticky top-0 z-30 border-b border-green-50 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        
        {/* Left icons */}
        <div className="flex items-center gap-3">
          <button className="p-2 bg-white rounded-xl shadow-sm">
            <MenuIcon className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Center search bar - desktop */}
        <div className="hidden md:flex items-center bg-white rounded-xl px-3 py-2 shadow-sm w-80">
          <Search className="w-4 h-4 text-green-600 mr-2" />
          <input 
            placeholder="Search products"
            className="w-full outline-none text-sm bg-transparent"
          />
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-3">
          <button className="p-2 bg-white rounded-xl shadow-sm">
            <Mic className="w-5 h-5 text-green-600" />
          </button>

          <button className="p-2 bg-white rounded-xl shadow-sm relative">
            <ShoppingCart className="w-5 h-5 text-gray-700" />
          </button>

          <button className="p-2 bg-white rounded-xl shadow-sm">
            <UserIcon className="w-5 h-5 text-gray-700" />
          </button>
        </div>

      </div>
    </div>
  );
}

/* ---------------- SIDEBAR ---------------- */
function CategorySidebar({
  categories,
  activeCategory,
  onSelectCategory,
  isLoading
}: {
    categories: { id: string; name: string; icon?: string; }[];
    activeCategory: string;
    onSelectCategory: (name: string) => void;
    isLoading: boolean;
}) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sidebarRef.current || !activeRef.current) return;
    const sidebar = sidebarRef.current;
    const item = activeRef.current;
    sidebar.scrollTo({
      top: item.offsetTop - sidebar.clientHeight / 2 + item.clientHeight / 2,
      behavior: 'smooth'
    });
  }, [activeCategory]);

  return (
    <aside
      ref={sidebarRef}
      className="hidden md:block w-[100px] bg-white/70 backdrop-blur-sm rounded-3xl shadow-sm p-3 h-[calc(100vh-7rem)] overflow-y-auto no-scrollbar"
    >
      <div className="flex flex-col gap-3">

        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3 rounded-xl bg-white shadow-sm flex flex-col items-center gap-2">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="w-16 h-4 mt-1" />
              </div>
            ))
          : categories.map(cat => {
              const active = cat.name === activeCategory;
              return (
                <button
                  key={cat.id}
                  ref={active ? activeRef : null}
                  onClick={() => onSelectCategory(cat.name)}
                  className={cn(
                    "flex flex-col items-center justify-center p-2 rounded-2xl w-full transition-all duration-200 text-center",
                    active
                      ? "bg-green-500 text-white shadow-md scale-[1.03]"
                      : "bg-white border border-gray-200 hover:bg-green-50"
                  )}
                >
                  <div className="w-12 h-12 rounded-full overflow-hidden mb-1">
                    {cat.icon ? (
                      <Image src={cat.icon} alt={cat.name} width={48} height={48} className="object-cover w-full h-full" />
                    ) : (
                      <Skeleton className="w-full h-full rounded-full" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium leading-tight line-clamp-2">{cat.name}</span>
                </button>
              );
            })}

      </div>
       <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </aside>
  );
}

/* ---------------- PRODUCT CARD ---------------- */
function ProductCard({ product, priceData }: { product: ProductType; priceData?: ProductPrice | null }) {
  const { addItem } = useCart();
  const priceInfo = priceData?.variants?.[0] ?? null;

  const handleAddToCart = () => {
    if (priceInfo) {
      // Assuming a default quantity of 1 when adding from product card
      addItem(product, { ...priceInfo, stock: 50, sku: `${product.id}-${priceInfo.weight}` }, 1);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 hover:shadow-md transition flex flex-col">
      <div className="w-full h-40 overflow-hidden rounded-xl bg-gray-50">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={300}
            height={300}
            className="object-cover w-full h-full"
          />
        ) : (
          <Skeleton className="w-full h-full" />
        )}
      </div>

      <div className="mt-3 flex flex-col flex-grow">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 flex-grow">{product.name}</h3>
        <div className="mt-2 flex items-center justify-between">
            <div>
            <div className="text-xs text-gray-400">{priceInfo?.weight || ''}</div>
            <div className="text-green-600 font-bold text-sm">
                {priceInfo ? `₹${priceInfo.price.toFixed(2)}` : '—'}
            </div>
            </div>
            <button
                onClick={handleAddToCart}
                className="bg-green-500 text-white text-sm px-4 py-1.5 rounded-lg shadow-sm"
            >
                Add
            </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- MAIN PAGE ---------------- */
export default function LocalBasketHomepage() {
  const { masterProducts, productPrices, loading: isAppLoading, fetchProductPrices, fetchInitialData } = useAppStore();
  const { firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeCategory, setActiveCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryIcons, setCategoryIcons] = useState<{ id: string; name: string; icon?: string }[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);

  /* Load initial data */
  useEffect(() => {
    if (firestore && !useAppStore.getState().isInitialized) {
      fetchInitialData(firestore);
    }
  }, [firestore, fetchInitialData]);

  /* Build categories */
  const categories = useMemo(() => {
    if (!masterProducts) return [];
    return [...new Set(masterProducts.map(p => p.category).filter(Boolean))].map(name => ({
      id: name,
      name,
      icon: ''
    }));
  }, [masterProducts]);

  /* Default category from URL */
  useEffect(() => {
    const urlCat = searchParams.get('category');
    if (categories.length > 0) {
      setActiveCategory(urlCat && categories.some(c => c.name === urlCat) ? urlCat : categories[0].name);
    }
  }, [categories, searchParams]);

  /* Fetch category icons */
  useEffect(() => {
    const loadIcons = async () => {
      if (!categories.length) return setSidebarLoading(false);
      setSidebarLoading(true);

      const icons = await Promise.all(
        categories.map(async cat => {
          const id = `cat-${cat.name.toLowerCase().replace(/ /g, '-')}`;
          try {
            const { imageUrl } = await getProductImage(id);
            return { ...cat, icon: imageUrl };
          } catch {
            return { ...cat, icon: '' };
          }
        })
      );

      setCategoryIcons(icons);
      setSidebarLoading(false);
    };

    loadIcons();
  }, [categories]);

  /* Filter products */
  const filteredProducts = useMemo(() => {
    if (!masterProducts) return [];
    if (searchTerm) {
      return masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return masterProducts.filter(p => p.category === activeCategory);
  }, [masterProducts, activeCategory, searchTerm]);

  /* Fetch price */
  useEffect(() => {
    if (!firestore || !filteredProducts.length) return;
    fetchProductPrices(firestore, filteredProducts.map(p => p.name));
  }, [firestore, filteredProducts, fetchProductPrices]);

  const handleSelectCategory = (categoryName: string) => {
    setActiveCategory(categoryName);
    setSearchTerm('');
    router.push(`/?category=${encodeURIComponent(categoryName)}`, { scroll: false });
  };

  const title = t(activeCategory.toLowerCase(), 'en') || activeCategory;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3fff3] to-[#e8f8ea]">

      <Header />

      <div className="max-w-6xl mx-auto px-4 flex gap-4 mt-4">

        {/* Sidebar */}
        <CategorySidebar
          categories={categoryIcons.length ? categoryIcons : categories}
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          isLoading={sidebarLoading}
        />

        {/* Main Content */}
        <div className="flex-1">

          {/* Title */}
          <div className="mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-600">{filteredProducts.length} products</p>
          </div>

          {/* Search - mobile */}
          <div className="md:hidden mb-4">
            <div className="flex items-center bg-white rounded-xl px-3 py-2 shadow-sm">
              <Search className="w-4 h-4 text-green-600 mr-2" />
              <input
                placeholder="Search products..."
                className="w-full outline-none text-sm bg-transparent"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {isAppLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-64 w-full rounded-2xl" />
                ))
              : filteredProducts.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    priceData={productPrices[p.name.toLowerCase()]}
                  />
                ))}
          </div>

        </div>
      </div>
    </div>
  );
}
