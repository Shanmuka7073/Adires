
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
import { Mic } from 'lucide-react';
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

  const [pricesLoaded, setPricesLoaded] = useState(false);

  const featuredProducts = useMemo(() => {
    return masterProducts.slice(0, 8); // Show up to 8 featured products
  }, [masterProducts]);

  useEffect(() => {
    if (firestore && featuredProducts.length > 0) {
      const productNames = featuredProducts.map(p => p.name);
      fetchProductPrices(firestore, productNames).then(() => {
        setPricesLoaded(true);
      });
    }
  }, [firestore, featuredProducts, fetchProductPrices]);

  const isLoading = appLoading || !pricesLoaded;

  return (
    <div className="flex flex-col">
       {/* Hero Section */}
       <section className="w-full py-12 md:py-20 lg:py-28 bg-primary/5 text-center">
            <div className="container px-4 md:px-6">
                <h1 className="text-3xl font-bold tracking-tighter sm:text-4xl md:text-5xl lg:text-6xl/none font-headline">
                    {t('shop-fresh-shop-local-just-by-voice')}
                </h1>
                <p className="mx-auto max-w-[700px] text-muted-foreground md:text-xl mt-4">
                    {t('your-hands-free-shopping-assistant')}
                </p>
                 <div className="mt-6">
                     <p className="text-sm text-muted-foreground flex items-center justify-center gap-2">
                        <Mic className="h-4 w-4"/>
                        {t('try-saying-find-bananas')}
                    </p>
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
              <h2 className="text-2xl font-bold font-headline">Featured Products</h2>
              {firstStoreId && (
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
              <p className="col-span-full text-muted-foreground">No featured products available.</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
