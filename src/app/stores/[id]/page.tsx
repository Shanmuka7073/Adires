'use client';
import { Store, Product, ProductPrice } from '@/lib/types';
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

    const fetchPricesInBatches = async () => {
        setArePricesLoading(true);
        const productNames = products.map(p => p.name.toLowerCase());
        const allPrices: Record<string, ProductPrice | null> = {};

        // Firestore 'in' query limit is 30
        const batchSize = 30; 
        for (let i = 0; i < productNames.length; i += batchSize) {
            const batchNames = productNames.slice(i, i + batchSize);
            if (batchNames.length > 0) {
                const priceQuery = query(collection(firestore, 'productPrices'), where('productName', 'in', batchNames));
                const priceSnapshot = await getDocs(priceQuery);
                
                priceSnapshot.forEach(doc => {
                    const priceData = doc.data() as ProductPrice;
                    allPrices[doc.id] = priceData;
                });
            }
        }
        
        // Ensure all product names have an entry, even if it's null
        productNames.forEach(name => {
            if (!allPrices[name]) {
                allPrices[name] = null;
            }
        });
      
        setProductPrices(allPrices);
        setArePricesLoading(false);
    };

    fetchPricesInBatches();
  }, [firestore, products]);
  
  const isLoading = isStoreLoading || areProductsLoading || arePricesLoading;

  if (storeError) {
    notFound();
  }
  
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

  // The initialCategories are now derived from the products themselves.
  const initialCategories = Array.from(new Set(products.map(p => p.category || 'Miscellaneous')))
    .map(categoryName => ({ categoryName, items: [] }));


  return (
    <CategoryClient
      store={store}
      initialCategories={initialCategories}
      allProducts={products}
      productPrices={productPrices}
      isLoading={isLoading}
    />
  );
}
