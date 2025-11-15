
'use client';
import { useState, useMemo, useEffect } from 'react';
import { Product, ProductPrice, Store } from '@/lib/types';
import { useCart } from '@/lib/cart';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import ProductCard from '@/components/product-card';

interface CategoryClientProps {
  store: Store;
  initialCategories: { categoryName: string; items: string[] }[];
  allProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
}

function CategorySidebar({ categories, selectedCategory, onSelectCategory }) {
  return (
    <>
      {/* Desktop Sidebar */}
      <nav className="hidden md:block w-32 flex-shrink-0 border-r">
        <ScrollArea className="h-full py-4">
          <div className="space-y-4 px-2">
            {categories.map((category) => {
              const isSelected = category.categoryName === selectedCategory;
              return (
                <button
                  key={category.categoryName}
                  onClick={() => onSelectCategory(category.categoryName)}
                  className={cn(
                    'flex flex-col items-center gap-2 p-2 rounded-lg w-full text-center transition-colors',
                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-muted/50'
                  )}
                >
                  <div className={cn("relative rounded-full p-1", isSelected && "ring-2 ring-primary")}>
                    <div className="rounded-full object-cover w-14 h-14 bg-muted" />
                  </div>
                  <span className="text-xs font-medium">{category.categoryName}</span>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </nav>
      {/* Mobile Horizontal Scroll */}
      <div className="md:hidden border-b">
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex w-max space-x-2 p-4">
            {categories.map((category) => {
              const isSelected = category.categoryName === selectedCategory;
              return (
                <button
                  key={category.categoryName}
                  onClick={() => onSelectCategory(category.categoryName)}
                  className={cn(
                    'flex flex-col items-center justify-start gap-2 rounded-lg w-20 text-center transition-colors flex-shrink-0',
                    isSelected ? 'text-primary' : 'hover:bg-muted/50'
                  )}
                >
                  <div className={cn("relative rounded-full p-0.5", isSelected && "ring-2 ring-primary")}>
                    <div className="rounded-full object-cover w-12 h-12 bg-muted" />
                  </div>
                  <span className="text-[10px] font-medium leading-tight line-clamp-2">{category.categoryName}</span>
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>
    </>
  );
}

export function CategoryClient({ store, initialCategories, allProducts, productPrices }: CategoryClientProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const { setActiveStoreId } = useCart();

  useEffect(() => {
    // Set the active store in the cart context when visiting this page
    if (store.id) {
        setActiveStoreId(store.id);
    }
    // Cleanup function to clear the active store when leaving the page
    return () => {
      setActiveStoreId(null);
    };
  }, [store.id, setActiveStoreId]);

  useEffect(() => {
    if (initialCategories.length > 0 && !selectedCategory) {
      setSelectedCategory(initialCategories[0].categoryName);
    }
  }, [initialCategories, selectedCategory]);

  const filteredProducts = useMemo(() => {
    if (searchTerm) {
      return allProducts.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCategory) {
      return allProducts.filter(p => p.category === selectedCategory);
    }
    return [];
  }, [allProducts, selectedCategory, searchTerm]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <CategorySidebar categories={initialCategories} selectedCategory={selectedCategory} onSelectCategory={setSelectedCategory} />
      <div className="flex-1">
        <main className="p-4 md:p-6">
          <div className="flex justify-between items-start md:items-center mb-6 flex-col md:flex-row gap-4">
            <div>
              <h2 className="text-2xl font-bold font-headline">{searchTerm ? "Search Results" : selectedCategory}</h2>
              <p className="text-sm text-muted-foreground">
                {searchTerm ? `Found ${filteredProducts.length} products` : `Showing ${filteredProducts.length} products in this category.`}
              </p>
            </div>
            <div className="w-full md:max-w-sm">
              <Input
                placeholder={`Search all products in ${store.name}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const priceData = productPrices[product.name.toLowerCase()];
                return <ProductCard key={product.id} product={product} priceData={priceData} />;
              })
            ) : (
              <p className="text-muted-foreground col-span-full">No products found matching your criteria.</p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
