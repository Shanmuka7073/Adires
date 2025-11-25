
'use client';
import { Store, Product, ProductPrice, Order } from '@/lib/types';
import { useParams, notFound } from 'next/navigation';
import { useDoc, useCollection, useMemoFirebase, useFirebase } from '@/firebase';
import { collection, doc, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { CategoryClient } from './category-client';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/lib/store';
import ProductCard from '@/components/product-card';
import { Separator } from '@/components/ui/separator';

function Recommendations() {
    const { firestore, user } = useFirebase();
    const { masterProducts, productPrices, loading: appLoading, fetchProductPrices } = useAppStore();

    const ordersQuery = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return query(
            collection(firestore, 'orders'),
            where('userId', '==', user.uid),
            orderBy('orderDate', 'desc'),
            limit(5) // Limit to last 5 orders to find recent items
        );
    }, [firestore, user]);

    const { data: recentOrders, isLoading: ordersLoading } = useCollection<Order>(ordersQuery);

    const recommendedProducts = useMemo(() => {
        if (ordersLoading || appLoading) return [];

        let recommendations: Product[] = [];
        
        if (recentOrders && recentOrders.length > 0) {
            const productIds = new Set<string>();
            recentOrders.forEach(order => {
                order.items.forEach(item => productIds.add(item.productId));
            });
            recommendations = masterProducts.filter(p => productIds.has(p.id));
        }

        // If no past orders or not enough items, fill with random products
        if (recommendations.length < 4 && masterProducts.length > 0) {
            const existingIds = new Set(recommendations.map(p => p.id));
            const randomProducts = masterProducts
                .filter(p => !existingIds.has(p.id))
                .sort(() => 0.5 - Math.random()) // Shuffle
                .slice(0, 4 - recommendations.length);
            recommendations.push(...randomProducts);
        }
        
        return recommendations.slice(0, 4); // Ensure we only show 4

    }, [recentOrders, masterProducts, ordersLoading, appLoading]);

    useEffect(() => {
        if (firestore && recommendedProducts.length > 0) {
            const productNames = recommendedProducts.map(p => p.name);
            fetchProductPrices(firestore, productNames);
        }
    }, [firestore, recommendedProducts, fetchProductPrices]);

    const isLoading = ordersLoading || appLoading;

    if (isLoading) {
        return (
             <div className="mt-12">
                <Skeleton className="h-8 w-1/3 mb-4" />
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
                </div>
            </div>
        )
    }

    if (recommendedProducts.length === 0) return null;

    return (
        <div className="mt-12">
            <h2 className="text-2xl font-bold font-headline mb-4">
                {recentOrders && recentOrders.length > 0 ? 'Buy Again' : 'Recommended For You'}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {recommendedProducts.map(product => {
                     const priceData = productPrices[product.name.toLowerCase()];
                     return <ProductCard key={`rec-${product.id}`} product={product} priceData={priceData} />;
                })}
            </div>
            <Separator className="my-8" />
        </div>
    )
}


export default function StoreDetailPage() {
  const { firestore } = useFirebase();
  const params = useParams();
  
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

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
      <div className="flex-1 overflow-y-auto">
        <div className="px-4">
            <Recommendations />
        </div>
        <CategoryClient
          store={store}
          allProducts={masterProducts}
          productPrices={productPrices}
          isLoading={isLoading}
        />
      </div>
  );
}
