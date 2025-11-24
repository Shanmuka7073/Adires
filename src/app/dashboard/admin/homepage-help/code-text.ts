'use client';

export const homepageCodeText = [
    {
        path: 'src/app/page.tsx',
        content: `
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useAppStore } from '@/lib/store';
import { Product as ProductType, ProductPrice } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import ProductCard from '@/components/product-card';
import { useFirebase } from '@/firebase';

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
          categories.map((cat: { id: string; name: string; icon: string; }) => {
            const active = cat.name === activeCategory;
            return (
              <Link
                key={cat.id}
                href={\`/stores/\${firstStoreId}?category=\${cat.name}\`}
                passHref
                legacyBehavior
              >
              <a
                ref={active ? activeButtonRef : undefined}
                onClick={(e) => { e.preventDefault(); onSelectCategory(cat.name); router.push(\`/stores/\${firstStoreId}?category=\${cat.name}\`)}}
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
       <style jsx>{\`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      \`}</style>
    </aside>
  );
}

// --- Main Homepage Component ---
export default function LocalBasketHomepage() {
    const { masterProducts, productPrices, loading: isAppLoading, fetchProductPrices } = useAppStore();
    const { firestore } = useFirebase();
    const [activeCategory, setActiveCategory] = useState<string>('');
    const [categoryIcons, setCategoryIcons] = useState<any[]>([]);
    const router = useRouter();

    const categories = useMemo(() => {
        if (!masterProducts) return [];
        return [...new Set(masterProducts.map(p => p.category).filter(Boolean))]
          .map(catName => ({ id: catName, name: catName, icon: '' }));
    }, [masterProducts]);

    // Set the default active category once categories are loaded
    useEffect(() => {
        if (categories.length > 0 && !activeCategory) {
            setActiveCategory(categories[0].name);
        }
    }, [categories, activeCategory]);

    // Fetch images for the categories
    useEffect(() => {
        const fetchCategoryIcons = async () => {
            if (categories.length === 0) return;
            const iconPromises = categories.map(cat => {
                const imageId = \`cat-\${cat.name.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-')}\`;
                return getProductImage(imageId);
            });
            const icons = await Promise.all(iconPromises);
            setCategoryIcons(categories.map((cat, index) => ({...cat, icon: icons[index].imageUrl})));
        }
        fetchCategoryIcons();
    }, [categories]);

    // Fetch prices for the featured products
    const featuredProducts = useMemo(() => {
        if (!masterProducts) return [];
        return masterProducts.slice(0, 8);
    }, [masterProducts]);

    useEffect(() => {
        if (firestore && featuredProducts.length > 0) {
            const productNamesToFetch = featuredProducts.map(p => p.name);
            fetchProductPrices(firestore, productNamesToFetch);
        }
    }, [firestore, featuredProducts, fetchProductPrices]);

    const gridCols = 'grid-cols-2 md:grid-cols-3';

    return (
        <div className="min-h-screen bg-[#ecf8ee] text-[#1f2937]">
            <div className="max-w-6xl mx-auto px-3 md:px-6 py-4 flex gap-4">
                <CategorySidebar categories={categoryIcons} activeCategory={activeCategory} onSelectCategory={setActiveCategory} isLoading={isAppLoading} />
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
                        {isAppLoading ? (
                            <div className={\`grid gap-4 \${gridCols}\`}>
                                {Array.from({ length: 6 }).map((_, i) => (
                                    <Skeleton key={i} className="h-64 w-full" />
                                ))}
                            </div>
                        ) : (
                            <div className={\`grid gap-4 \${gridCols}\`}>
                                {featuredProducts.map((p) => (
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
`,
    },
];
