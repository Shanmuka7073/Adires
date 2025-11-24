
'use client';
import { Store, Product, ProductPrice } from '@/lib/types';
import groceryData from '@/lib/grocery-data.json';
import { useParams, notFound } from 'next/navigation';
import { useDoc, useCollection, useMemoFirebase, useFirebase } from '@/firebase';
import { collection, doc, query, where, getDocs } from 'firebase/firestore';
import { getProductPrice } from '@/lib/data';
import { CategoryClient } from './category-client';
import { useEffect, useState, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function StoreDetailPage() {
  const { firestore } = useFirebase();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const storeDocRef = useMemoFirebase(() => firestore ? doc(firestore, 'stores', id) : null, [firestore, id]);
  const { data: store, isLoading: isStoreLoading, error: storeError } = useDoc<Store>(storeDocRef);

  const productsQuery = useMemoFirebase(() => firestore ? query(collection(firestore, 'stores', id, 'products')) : null, [firestore, id]);
  const { data: products, isLoading: areProductsLoading } = useCollection<Product>(productsQuery);

  const [productPrices, setProductPrices] = useState<Record<string, ProductPrice | null>>({});
  const [arePricesLoading, setArePricesLoading] = useState(true);

  useEffect(() => {
    if (!firestore || !products || products.length === 0) {
      if(products && products.length === 0) setArePricesLoading(false);
      return;
    };

    const fetchPrices = async () => {
      setArePricesLoading(true);
      const productNames = products.map(p => p.name);
      
      // Batch fetching prices in chunks to avoid hitting query limits if necessary, though getDocs can handle up to 30 'in' comparisons
      const priceQuery = query(collection(firestore, 'productPrices'), where('productName', 'in', productNames.map(name => name.toLowerCase())));
      const priceSnapshot = await getDocs(priceQuery);
      
      const prices: Record<string, ProductPrice | null> = {};
      priceSnapshot.forEach(doc => {
          const priceData = doc.data() as ProductPrice;
          prices[doc.id] = priceData;
      });

      // Fill in null for products that didn't have a price document
      productNames.forEach(name => {
          if (!prices[name.toLowerCase()]) {
              prices[name.toLowerCase()] = null;
          }
      });
      
      setProductPrices(prices);
      setArePricesLoading(false);
    };

    fetchPrices();
  }, [firestore, products]);
  
  const isLoading = isStoreLoading || areProductsLoading || arePricesLoading;

  if (storeError) {
    notFound();
  }

  const storeCategories = useMemo(() => {
    if (!products) return [];
    return [...new Set(products.map(p => p.category || 'Miscellaneous'))]
      .map(catName => groceryData.categories.find(gc => gc.categoryName === catName))
      .filter(Boolean) as { categoryName: string; items: string[] }[];
  }, [products]);

  if (isLoading || !store || !products) {
    return (
      <div className="container mx-auto py-12 px-4 md:px-6">
        <Skeleton className="h-12 w-1/2 mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }


  return (
    <CategoryClient
      store={store}
      initialCategories={storeCategories}
      allProducts={products}
      productPrices={productPrices}
      isLoading={isLoading}
    />
  );
}

