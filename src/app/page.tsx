'use client';
import { Button } from '@/components/ui/button';
import { useFirebase } from '@/firebase';
import type { Product, ProductPrice } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { t } from '@/lib/locales';
import CategoryIcon from '@/components/features/CategoryIcon';
import groceryData from '@/lib/grocery-data.json';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useAppStore } from '@/lib/store';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';

export default function Home() {
  const { firestore } = useFirebase();
  const { 
    masterProducts, 
    productPrices, 
    fetchProductPrices, 
    loading: appLoading,
    stores
  } = useAppStore();
  const firstStoreId = stores[0]?.id;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [pricesLoaded, setPricesLoaded] = useState(false);

  const featuredProducts = useMemo(() => {
    let products = masterProducts;
    if (searchTerm) {
      products = products.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return products.slice(0, 12); // Show up to 12 products
  }, [masterProducts, searchTerm]);

  useEffect(() => {
    if (firestore && masterProducts.length > 0) {
      const productNamesToFetch = masterProducts.map(p => p.name);
      fetchProductPrices(firestore, productNamesToFetch).then(() => {
        setPricesLoaded(true);
      });
    } else if (masterProducts.length === 0 && !appLoading) {
        setPricesLoaded(true); // Nothing to load
    }
  }, [firestore, masterProducts, fetchProductPrices, appLoading]);

  const isLoading = appLoading || !pricesLoaded;

  return (
    <div className="flex flex-col">
       {/* Search Section */}
       <section className="w-full py-8 md:py-12 bg-primary/5">
            <div className="container px-4 md:px-6">
                <div className="max-w-2xl mx-auto">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                        <Input 
                            type="search"
                            placeholder="Search for products..."
                            className="w-full pl-10 pr-4 py-2 text-lg rounded-full shadow-sm"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </section>

      <div className="container mx-auto p-4 space-y-12">
        <section>
          <h2 className="text-2xl font-bold font-headline mb-4">Shop by Category</h2>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex w-max space-x-6 pb-4">
                {groceryData.categories.map((category) => (
                    <CategoryIcon key={category.categoryName} category={category} />
                ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>

        <section>
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold font-headline">
                {searchTerm ? 'Search Results' : 'Featured Products'}
              </h2>
              {firstStoreId && !searchTerm && (
                <Button variant="link" asChild>
                    <Link href={`/stores/${firstStoreId}`}>View All</Link>
                </Button>
              )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {isLoading ? (
              <>
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-64 w-full" />
              </>
            ) : featuredProducts.length > 0 ? (
              featuredProducts.map((product) => {
                const priceData = productPrices[product.name.toLowerCase()];
                return <ProductCard key={product.id} product={product} priceData={priceData} />;
              })
            ) : (
              <p className="col-span-full text-muted-foreground text-center py-8">
                No products found matching your search.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
