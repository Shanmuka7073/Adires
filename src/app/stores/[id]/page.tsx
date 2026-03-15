
'use client';
import { Store, Product, ProductPrice } from '@/lib/types';
import { useParams, notFound, useSearchParams, useRouter } from 'next/navigation';
import { useFirebase } from '@/firebase';
import { CategoryClient } from './category-client';
import { useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';

export default function StoreDetailPage() {
  const { firestore } = useFirebase();
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // Get all data from the central Zustand store
  const { 
    stores,
    masterProducts, 
    productPrices, 
    fetchProductPrices, 
    loading: appLoading, 
    isInitialized,
    fetchInitialData
  } = useAppStore();

  // Find the specific store being viewed from the already-loaded list.
  const store = useMemo(() => stores.find(s => s.id === id), [stores, id]);
  
  // Fail-safe redirect: if this is a restaurant or salon, it belongs on the /menu page
  useEffect(() => {
    if (store) {
        const isSalon = store.businessType === 'salon' || store.name.toLowerCase().includes('salon') || store.name.toLowerCase().includes('saloon');
        const isRestaurant = store.businessType === 'restaurant' || store.name.toLowerCase().includes('restaurant') || store.name.toLowerCase().includes('restuarent') || store.name.toLowerCase().includes('hotel') || store.name.toLowerCase().includes('biryani') || store.name.toLowerCase().includes('tiffin');
        
        if (isSalon || isRestaurant) {
            router.replace(`/menu/${store.id}`);
        }
    }
  }, [store, router]);

  // Fetch initial data if it's not already in the store
  useEffect(() => {
    if (firestore && !isInitialized) {
      fetchInitialData(firestore);
    }
  }, [firestore, isInitialized, fetchInitialData]);


  // When master products are loaded, fetch their prices.
  useEffect(() => {
    if (firestore && masterProducts.length > 0) {
      const productNames = masterProducts.map(p => p.name);
      fetchProductPrices(firestore, productNames);
    }
  }, [firestore, masterProducts, fetchProductPrices]);

  // Determine the final loading state.
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
    // If the store is not found after loading, it's a 404.
    notFound();
  }


  // Once everything is loaded, render the main client component.
  return (
      <div className="flex-1 overflow-y-auto">
        <CategoryClient
          store={store}
          allProducts={masterProducts}
          productPrices={productPrices}
          isLoading={isLoading}
        />
      </div>
  );
}
