
import ProductCard from '@/components/product-card';
import { Store, Product, ProductPrice } from '@/lib/types';
import groceryData from '@/lib/grocery-data.json';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { getAdminServices } from '@/firebase/admin-init';
import { notFound } from 'next/navigation';
import { getProductPrice, getProducts } from '@/lib/data';
import { CategoryClient } from './category-client';


async function getStoreAndProducts(id: string): Promise<{ store: Store; products: Product[]; productPrices: Record<string, ProductPrice | null> } | null> {
    const { db } = getAdminServices();
    if (!db) {
        console.error("Admin DB not available");
        return null;
    }

    const storeRef = doc(db, 'stores', id);
    const storeSnap = await getDoc(storeRef);

    if (!storeSnap.exists()) {
        return null;
    }

    const store = { id: storeSnap.id, ...storeSnap.data() } as Store;
    const products = await getProducts(db, id);

    // Fetch all prices for the products in this store
    const pricePromises = products.map(p => getProductPrice(db, p.name));
    const priceResults = await Promise.all(pricePromises);

    const productPrices = products.reduce((acc, product, index) => {
        acc[product.name.toLowerCase()] = priceResults[index];
        return acc;
    }, {} as Record<string, ProductPrice | null>);


    return { store, products, productPrices };
}


export default async function StoreDetailPage({ params }: { params: { id: string } }) {
  const data = await getStoreAndProducts(params.id);

  if (!data) {
    notFound();
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
