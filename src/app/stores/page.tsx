
'use client';

import StoreCard from '@/components/store-card';
import { useFirebase } from '@/firebase';
import { getStores } from '@/lib/data';
import type { Store } from '@/lib/types';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function StoresPage() {
  const { firestore } = useFirebase();
  const [stores, setStores] = useState<Store[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (firestore) {
      getStores(firestore).then((fetchedStores) => {
        setStores(fetchedStores);
        setIsLoading(false);
      });
    }
  }, [firestore]);

  return (
    <div className="container mx-auto py-12 px-4 md:px-6">
      <div className="space-y-4 mb-8">
        <h1 className="text-4xl font-bold font-headline">Browse All Stores</h1>
        <p className="text-muted-foreground text-lg">Find your new favorite local grocery store.</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {isLoading ? (
          <>
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
            <Skeleton className="h-80 w-full" />
          </>
        ) : stores.length > 0 ? (
          stores.map((store) => (
            <StoreCard key={store.id} store={store} />
          ))
        ) : (
           <p className="text-muted-foreground">No stores have been created yet.</p>
        )}
      </div>
    </div>
  );
}
