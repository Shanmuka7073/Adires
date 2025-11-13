
'use client';

import { Store, Product, ProductPrice } from '@/lib/types';
import groceryData from '@/lib/grocery-data.json';
import { useParams, notFound } from 'next/navigation';
import { getProductPrice, getProducts, getStore } from '@/lib/data';
import { CategoryClient } from './category-client';
import { useFirebase } from '@/firebase';
import { useEffect, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

export default function StoreDetailPage() {
  const { firestore } = useFirebase();
  const params = useParams();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  const [data, setData] = useState<{ store: Store; products: Product[]; productPrices: Record<string, ProductPrice | null> } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!firestore || !id) return;

    const fetchData = async () => {
      try {
        setIsLoading(true);
        const store = await getStore(firestore, id);
        if (!store) {
          setError(true);
          return;
        }

        const products = await getProducts(firestore, id);
        const pricePromises = products.map(p => getProductPrice(firestore, p.name));
        const priceResults = await Promise.all(pricePromises);
        const productPrices = products.reduce((acc, product, index) => {
          acc[product.name.toLowerCase()] = priceResults[index];
          return acc;
        }, {} as Record<string, ProductPrice | null>);

        setData({ store, products, productPrices });
      } catch (e) {
        console.error(e);
        setError(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [firestore, id]);

  if (error) {
    notFound();
  }

  if (isLoading || !data) {
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

  const { store, products, productPrices } = data;

  const storeCategories = [...new Set(products.map(p => p.category || 'Miscellaneous'))]
    .map(catName => groceryData.categories.find(gc => gc.categoryName === catName))
    .filter(Boolean) as { categoryName: string; items: string[] }[];

  return (
    <CategoryClient
      store={store}
      initialCategories={storeCategories}
      allProducts={products}
      productPrices={productPrices}
    />
  );
}
