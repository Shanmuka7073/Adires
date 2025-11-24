'use client';
import { Store, Product, ProductPrice } from '@/lib/types';
import { useParams, notFound, useSearchParams, useRouter } from 'next/navigation';
import { useDoc, useCollection, useMemoFirebase, useFirebase } from '@/firebase';
import { collection, doc, query, where, getDocs } from 'firebase/firestore';
import { CategoryClient } from './category-client';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';

export default function StoreDetailPage() {
  const { firestore } = useFirebase();
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const categoryFromUrl = searchParams.get('category');

  // Use the global store for master products and prices.
  const { masterProducts, productPrices, fetchProductPrices, loading: appLoading, isInitialized } = useAppStore();

  // Fetch the specific store being viewed.
  const storeDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'stores', id) : null, [firestore, id]);
  const { data: store, isLoading: isStoreLoading, error: storeError } = useDoc<Store>(storeDocRef);

  // When master products are loaded, fetch their prices.
  useEffect(() => {
    if (firestore && masterProducts.length > 0) {
      const productNames = masterProducts.map(p => p.name);
      fetchProductPrices(firestore, productNames);
    }
  }, [firestore, masterProducts, fetchProductPrices]);

  // Determine the final loading state.
  const isLoading = appLoading || isStoreLoading || !isInitialized;

  if (storeError) {
    notFound();
  }
  
  if (isLoading || !store) {
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

  // Once everything is loaded, render the main client component.
  return (
    <CategoryClient
      store={store}
      allProducts={masterProducts}
      productPrices={productPrices}
      isLoading={isLoading}
    />
  );
}
