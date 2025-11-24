'use client';
import React, { useMemo, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Globe, Mic, ShoppingCart, ArrowRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { getProductImage } from '@/lib/data';
import ProductCard from '@/components/product-card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from '@/components/ui/card';

function CategoryButton({ category, storeId }) {
  const [image, setImage] = useState({ imageUrl: '', imageHint: '' });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchImage = async () => {
      setIsLoading(true);
      const imageId = `cat-${category.categoryName.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-')}`;
      try {
        const fetchedImage = await getProductImage(imageId);
        setImage(fetchedImage);
      } catch (error) {
        console.error("Failed to fetch image for category:", category.categoryName, error);
        setImage({ imageUrl: 'https://picsum.photos/seed/placeholder/128/128', imageHint: 'placeholder' });
      }
      setIsLoading(false);
    };
    fetchImage();
  }, [category.categoryName]);

  return (
    <Link 
        href={`/stores/${storeId}?category=${category.categoryName}`}
        className="flex flex-col items-center w-20 bg-white rounded-2xl shadow-sm py-3 px-2 transition-all hover:shadow-md hover:-translate-y-1"
    >
      {isLoading ? (
        <Skeleton className="w-12 h-12 rounded-full" />
      ) : (
        <Image
          src={image.imageUrl}
          alt={category.categoryName}
          data-ai-hint={image.imageHint}
          width={48}
          height={48}
          className="w-12 h-12 object-cover rounded-full border"
        />
      )}
      <span className="text-xs text-gray-700 font-medium mt-2 text-center truncate w-full">
        {category.categoryName}
      </span>
    </Link>
  );
}

export default function LocalBasketHome() {
  const { masterProducts, stores, loading: isAppLoading } = useAppStore();
  const categories = useMemo(() => {
    if (!masterProducts) return [];
    const uniqueCategories = [...new Set(masterProducts.map(p => p.category).filter(Boolean))];
    return uniqueCategories.map(catName => ({ categoryName: catName, items: [] })).slice(0, 5); // Limit to 5 for demo
  }, [masterProducts]);

  const featuredProducts = useMemo(() => {
    if (!masterProducts) return [];
    // Just grab the first few products to feature them.
    return masterProducts.slice(0, 4);
  }, [masterProducts]);

  const firstStoreId = useMemo(() => stores.find(s => s.name === 'LocalBasket')?.id, [stores]);

  if (isAppLoading || !firstStoreId) {
    return (
        <div className="min-h-screen flex bg-[#f2f9f2] p-4">
            <aside className="w-24 bg-[#e9f5e9] border-r border-[#d8ead8] py-4 overflow-y-auto">
                <div className="flex flex-col items-center gap-6">
                    {[...Array(5)].map((_, i) => <Skeleton key={i} className="w-16 h-24 rounded-2xl" />)}
                </div>
            </aside>
            <main className="flex-1 p-4 overflow-y-auto">
                <Skeleton className="h-10 w-48 mb-4" />
                <Skeleton className="h-8 w-32 mb-3" />
                <div className="grid grid-cols-2 gap-4">
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </div>
            </main>
        </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#f2f9f2]">
      {/* ----- Sidebar ----- */}
      <aside className="w-24 bg-[#e9f5e9] border-r border-[#d8ead8] py-4 overflow-y-auto">
        <div className="flex flex-col items-center gap-6">
          {categories.map((cat, i) => (
            <CategoryButton key={i} category={cat} storeId={firstStoreId} />
          ))}
        </div>
      </aside>

      {/* ----- Main Content ----- */}
      <main className="flex-1 p-4 overflow-y-auto">
        {/* We let the main app header handle the top bar now */}
        <h2 className="text-xl font-semibold text-gray-800 mb-3 font-headline">
          Featured Products
        </h2>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {featuredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
            ))}
        </div>
        
        <div className="mt-8">
            <Card className="bg-white">
                <CardHeader>
                    <CardTitle>Don't see what you're looking for?</CardTitle>
                    <CardDescription>Browse our full selection of stores and products.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full">
                        <Link href="/stores">
                            Browse All Stores <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardContent>
            </Card>
        </div>

      </main>
    </div>
  );
}
