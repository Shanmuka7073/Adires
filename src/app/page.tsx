
'use client';
import { Button } from '@/components/ui/button';
import { getStores } from '@/lib/data';
import StoreCard from '@/components/store-card';
import { useFirebase } from '@/firebase';
import type { Store } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { t } from '@/lib/locales';
import CategoryIcon from '@/components/features/CategoryIcon';
import groceryData from '@/lib/grocery-data.json';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Mic } from 'lucide-react';


export default function Home() {
  const { firestore } = useFirebase();
  const [allStores, setAllStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (firestore) {
      getStores(firestore)
        .then((fetchedStores) => {
          setAllStores(fetchedStores);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    } else {
        setLoading(false);
    }
  }, [firestore]);


  const displayedStores = useMemo(() => {
    return allStores.slice(0, 8); // Show up to 8 featured stores
  }, [allStores]);

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
              <h2 className="text-2xl font-bold font-headline">Featured Stores</h2>
              <Button variant="link" asChild>
                  <Link href="/stores">View All</Link>
              </Button>
          </div>
          {/* Responsive container for stores */}
          <div className="relative">
            <ScrollArea className="w-full md:hidden">
              <div className="flex space-x-4 pb-4">
                {loading ? (
                  <>
                    <StoreCard.Skeleton />
                    <StoreCard.Skeleton />
                    <StoreCard.Skeleton />
                  </>
                ) : displayedStores.length > 0 ? (
                  displayedStores.map((store) => (
                    <StoreCard key={store.id} store={store} />
                  ))
                ) : (
                  <p className="text-muted-foreground">No featured stores available.</p>
                )}
              </div>
              <ScrollBar orientation="horizontal" className="md:hidden" />
            </ScrollArea>
            <div className="hidden md:grid md:grid-cols-3 lg:grid-cols-4 gap-4">
               {loading ? (
                  <>
                      <StoreCard.Skeleton />
                      <StoreCard.Skeleton />
                      <StoreCard.Skeleton />
                      <StoreCard.Skeleton />
                  </>
                ) : displayedStores.length > 0 ? (
                      displayedStores.map((store) => (
                          <StoreCard key={store.id} store={store} />
                      ))
                ) : (
                  <p className="col-span-full text-muted-foreground">No featured stores available.</p>
                )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
