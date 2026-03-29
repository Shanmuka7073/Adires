
'use client';
import type { Store, Product, ProductPrice, CanonicalProduct } from './types';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  Firestore,
} from 'firebase/firestore';
import placeholderData from './placeholder-images.json';

// OPTIMIZED: Use static import for placeholder data
const getImages = () => placeholderData.placeholderImages;

const getImage = (id: string) => {
  const images = getImages();
  const image = images.find((img) => img.id === id);
  return (
    image || {
      imageUrl: 'https://placehold.co/300x300/E2E8F0/64748B?text=?',
      imageHint: 'placeholder',
    }
  );
};


// --- Firestore-based functions for CLIENT-SIDE ---

export async function getStores(db: Firestore): Promise<Store[]> {
  const storesCol = collection(db, 'stores');
  const storeSnapshot = await getDocs(storesCol);
  const storeList = storeSnapshot.docs.map(
    (doc) =>
      ({
        id: doc.id,
        ...doc.data(),
      } as Store)
  );
  return storeList;
}

export async function getStore(
  db: Firestore,
  id: string
): Promise<Store | undefined> {
  const storeDocRef = doc(db, 'stores', id);
  const storeSnap = await getDoc(storeDocRef);
  if (storeSnap.exists()) {
    const storeData = { id: storeSnap.id, ...storeSnap.data() } as Store;
    return storeData;
  }
  return undefined;
}

export async function getProducts(
  db: Firestore,
  storeId: string
): Promise<Product[]> {
  const productsQuery = query(collection(db, 'stores', storeId, 'products'));
  const productSnapshot = await getDocs(productsQuery);
  const productList = productSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Product[];
  return productList;
}

export async function getMasterProducts(db: Firestore): Promise<Product[]> {
    const storesQuery = query(collection(db, 'stores'), where('name', '==', 'LocalBasket'));
    const storeSnapshot = await getDocs(storesQuery);

    if (storeSnapshot.empty) {
        return [];
    }

    const masterStoreId = storeSnapshot.docs[0].id;
    const productsCol = collection(db, 'stores', masterStoreId, 'products');
    const productSnapshot = await getDocs(productsCol);
    
    return productSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
}


export async function getProduct(
  db: Firestore,
  storeId: string,
  productId: string
): Promise<Product | undefined> {
  const productDocRef = doc(db, 'stores', storeId, 'products', productId);
  const productSnap = await getDoc(productDocRef);
  if (productSnap.exists()) {
    return { id: productSnap.id, ...productSnap.data() } as Product;
  }
  return undefined;
}

export async function getProductPrice(db: Firestore, productName: string): Promise<ProductPrice | null> {
    if (!productName) return null;
    const priceDocRef = doc(db, 'productPrices', productName.toLowerCase());
    const priceSnap = await getDoc(priceDocRef);
    if (priceSnap.exists()) {
        return priceSnap.data() as ProductPrice;
    }
    return null;
}

/**
 * STRATEGIC IMAGE LOOKUP
 * 1. Checks for direct URL on the product.
 * 2. Checks the global canonicalCatalog for a master image override.
 * 3. Falls back to static placeholder identifiers.
 */
export async function getUnifiedProductImage(db: Firestore, product: Product) {
    if (product.imageUrl) return { imageUrl: product.imageUrl, imageHint: product.name };

    // Try canonical override
    try {
        const slug = product.name.toLowerCase().trim().replace(/\s+/g, '-');
        const canonicalRef = doc(db, 'canonicalCatalog', slug);
        const snap = await getDoc(canonicalRef);
        if (snap.exists()) {
            const data = snap.data() as CanonicalProduct;
            if (data.imageUrl) return { imageUrl: data.imageUrl, imageHint: product.name };
        }
    } catch (e) {
        console.warn("Canonical image fetch failed for", product.name);
    }

    return getImage(product.imageId);
}

export const getProductImage = (imageId: string) => getImage(imageId);
export const getStoreImage = (store: Store) => {
    if (store.imageUrl) {
        return { imageUrl: store.imageUrl, imageHint: 'store image' };
    }
    return getImage(store.imageId);
};
