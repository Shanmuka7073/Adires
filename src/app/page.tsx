
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Product as ProductType, ProductPrice } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import ProductCard from '@/components/product-card';
import { useFirebase } from '@/firebase';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { t } from '@/lib/locales';

function classNames(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ');
}

// --- Sidebar Component ---
function CategorySidebar({ categories, activeCategory, onSelectCategory, isLoading }) {
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const activeButtonRef = useRef<HTMLButtonElement | null>(null);
  const { stores } = useAppStore();
  const firstStoreId = stores.find(s => s.name === 'LocalBasket')?.id;
  const router = useRouter();


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
      className="w-[80px] bg-white/60 backdrop-blur-md shadow-md border border-green-100 rounded-3xl py-4 px-2 
             h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar transition-all duration-300"
      aria-label="Categories"
    >
      <div className="flex flex-col items-center gap-4">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
             <div key={i} className="flex flex-col items-center w-[60px] p-2 rounded-2xl space-y-1">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="h-2 w-10" />
            </div>
          ))
        ) : (
          categories.map((cat: { id: string; name: string; icon: string; }) => {
            const active = cat.name === activeCategory;
            return (
              <button
                key={cat.id}
                onClick={() => onSelectCategory(cat.name)}
                ref={active ? activeButtonRef : null}
                className={cn(
                  "flex flex-col items-center w-[64px] p-3 rounded-2xl cursor-pointer group transition-all duration-300",
                  active
                    ? "bg-green-500 text-white shadow-lg scale-[1.05]"
                    : "bg-white hover:shadow-md hover:bg-green-50"
                )}
              >
                <Image
                  src={cat.icon}
                  alt={cat.name}
                  width={40}
                  height={40}
                  className="rounded-full object-cover group-hover:scale-110 transition-all duration-200"
                />
                <span className="text-[11px] mt-1 text-center truncate w-[52px]">
                  {cat.name}
                </span>
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

// --- Main Homepage Component ---
export default function LocalBasketHomepage() {
    const { masterProducts, productPrices, loading: isAppLoading, fetchProductPrices, fetchInitialData } = useAppStore();
    const { firestore } = useFirebase();
    const router = useRouter();
    const searchParams = useSearchParams();

    const [activeCategory, setActiveCategory] = useState<string>('');
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryIcons, setCategoryIcons] = useState<any[]>([]);

    useEffect(() => {
        if(firestore && !useAppStore.getState().isInitialized) {
            fetchInitialData(firestore);
        }
    }, [firestore, fetchInitialData]);

    const categories = useMemo(() => {
        if (!masterProducts) return [];
        return [...new Set(masterProducts.map(p => p.category).filter(Boolean))]
          .map(catName => ({ id: catName, name: catName, icon: '' }));
    }, [masterProducts]);

    // Set the default active category from URL or fallback to first category
    useEffect(() => {
        const categoryFromUrl = searchParams.get('category');
        if (categories.length > 0) {
            if (categoryFromUrl && categories.some(c => c.name === categoryFromUrl)) {
                 setActiveCategory(categoryFromUrl);
            } else if (!activeCategory) {
                 setActiveCategory(categories[0].name);
            }
        }
    }, [categories, activeCategory, searchParams]);

    // Fetch images for the categories
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

    const filteredProducts = useMemo(() => {
        if (!masterProducts) return [];
        if (searchTerm) {
            return masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        if (activeCategory) {
            return masterProducts.filter(p => p.category === activeCategory);
        }
        return masterProducts.slice(0, 12); // Fallback to a few products
    }, [masterProducts, activeCategory, searchTerm]);

    useEffect(() => {
        if (firestore && filteredProducts.length > 0) {
            const productNamesToFetch = filteredProducts.map(p => p.name);
            fetchProductPrices(firestore, productNamesToFetch);
        }
    }, [firestore, filteredProducts, fetchProductPrices]);

    const handleSelectCategory = (categoryName: string) => {
        setActiveCategory(categoryName);
        setSearchTerm('');
        const { stores } = useAppStore.getState();
        const firstStoreId = stores.find(s => s.name === 'LocalBasket')?.id;
        if(firstStoreId) {
             router.push(`/stores/${firstStoreId}?category=${categoryName}`);
        } else {
             router.push(`/?category=${categoryName}`);
        }
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#f0fff4] to-[#e8f5e9] text-[#1f2937]">
            <div className="max-w-6xl mx-auto px-3 md:px-6 py-4 flex gap-4">
                <CategorySidebar categories={categoryIcons} activeCategory={activeCategory} onSelectCategory={handleSelectCategory} isLoading={isAppLoading} />
                <main className="flex-1">
                    <div className="mb-4 flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-[#0f172a]">{t(activeCategory?.toLowerCase(),'en') || 'Featured Products'}</h1>
                            <p className="text-sm text-gray-500 mt-1">{filteredProducts.length} products</p>
                        </div>
                        <div className="w-full md:w-96 ml-4">
                          <div className="relative">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-green-600" />
                            <input
                              type="search"
                              placeholder="Search 3000+ products instantly..."
                              className="w-full bg-white border border-green-200 shadow-sm px-4 py-2 pl-11 rounded-xl 
                                         focus:ring-2 focus:ring-green-300 focus:border-green-500 transition-all"
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                            />
                          </div>
                        </div>
                    </div>
                    <section>
                        {isAppLoading ? (
                            <div className="grid gap-5 grid-cols-2 md:grid-cols-3">
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Skeleton key={i} className="h-64 w-full" />
                                ))}
                            </div>
                        ) : (
                            <div className="grid gap-5 grid-cols-2 md:grid-cols-3">
                                {filteredProducts.map((p) => (
                                    <ProductCard 
                                        key={p.id} 
                                        product={p} 
                                        priceData={productPrices[p.name.toLowerCase()]}
                                    />
                                ))}
                            </div>
                        )}
                    </section>
                </main>
            </div>
        </div>
    );
}
