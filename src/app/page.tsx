
'use client';
import { Button } from '@/components/ui/button';
import { getStores } from '@/lib/data';
import StoreCard from '@/components/store-card';
import { useFirebase } from '@/firebase';
import type { Store } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { t } from '@/lib/locales';
import AIGroceryPackGenerator from '@/components/features/AIGroceryPackGenerator';
import CategoryIcon from '@/components/features/CategoryIcon';
import groceryData from '@/lib/grocery-data.json';


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
    return allStores.slice(0, 3); // Show 3 featured stores
  }, [allStores]);

  return (
    <div className="container mx-auto p-4 space-y-12">
      <section>
        <AIGroceryPackGenerator />
      </section>

      <section>
        <h2 className="text-2xl font-bold font-headline mb-4">Shop by Category</h2>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4">
          {groceryData.categories.map((category) => (
            <CategoryIcon key={category.categoryName} category={category} />
          ))}
        </div>
      </section>

      <section>
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold font-headline">Featured Stores</h2>
            <Button variant="link" asChild>
                <Link href="/stores">View All</Link>
            </Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
             <p className="col-span-full text-muted-foreground">No featured stores available.</p>
           )}
        </div>
      </section>
    </div>
  );
}
