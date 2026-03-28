
'use client';
import { Store } from '@/lib/types';
import { useParams, notFound, useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { CategoryClient } from './category-client';
import { useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';

/**
 * Store Detail Page.
 * Routes users between the retail scroller and the digital menu based on business type.
 */
export default function StoreDetailPage() {
  const { firestore } = useFirebase();
  const params = useParams();
  const router = useRouter();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const { 
    stores,
    isFetchingStores: appLoading, 
    isInitialized,
    fetchInitialData
  } = useAppStore();

  const store = useMemo(() => stores.find(s => s.id === id), [stores, id]);
  
  useEffect(() => {
    if (store) {
        const searchPool = `${store.name} ${store.description}`.toLowerCase();
        const isSalon = store.businessType === 'salon' || ['salon', 'saloon', 'parlour', 'beauty', 'hair', 'cut', 'spa', 'makeup'].some(kw => searchPool.includes(kw));
        const isRestaurant = store.businessType === 'restaurant' || [
            'restaurant', 'hotel', 'biryani', 'tiffin', 'mess', 
            'canteen', 'dhaba', 'food', 'meals', 'sweets', 'bakery', 'kitchen', 
            'cafe', 'bakers'
        ].some(kw => searchPool.includes(kw));
        
        if (isSalon || isRestaurant) {
            router.replace(`/menu/${store.id}`);
        }
    }
  }, [store, router]);

  useEffect(() => {
    if (firestore && !isInitialized) {
      fetchInitialData(firestore);
    }
  }, [firestore, isInitialized, fetchInitialData]);

  const isLoading = appLoading || !isInitialized;

  if (isLoading) {
    return (
      <div className="flex h-full">
        <div className="hidden md:block w-24 p-4">
          <Skeleton className="h-full w-full" />
        </div>
        <div className="flex-1 p-4 space-y-6">
          <Skeleton className="h-10 w-1/3" />
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
          </div>
        </div>
      </div>
    );
  }
  
  if (!store) {
    notFound();
  }

  return (
      <div className="flex-1 overflow-y-auto">
        <CategoryClient
          store={store}
          allProducts={[]}
          productPrices={{}}
          isLoading={isLoading}
        />
      </div>
  );
}
