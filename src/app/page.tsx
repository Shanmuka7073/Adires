
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Product as ProductType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useFirebase } from '@/firebase';
import { Search, Menu as MenuIcon, Mic, ShoppingBag, Heart, Star, Briefcase, Sparkles, Lamp, Home as HomeIcon, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import ProductCard from '@/components/product-card';

// Main categories for the top scroller
const mainCategories = [
  { name: 'All', icon: LayoutGrid },
  { name: 'Wedding', icon: Heart },
  { name: 'Electronics', icon: Briefcase },
  { name: 'Beauty', icon: Sparkles },
  { name: 'Decor', icon: Lamp },
  { name: 'Home', icon: HomeIcon },
];

// Reusable Category Card for the main grid
function GroceryCategoryCard({ categoryName, imageHint }: { categoryName: string, imageHint: string }) {
    const [image, setImage] = useState({ imageUrl: '', imageHint: 'loading' });
    const [isLoading, setIsLoading] = useState(true);
    const slug = categoryName.toLowerCase().replace(/ & /g, '-').replace(/ /g, '-');
    const firstStoreId = useAppStore(state => state.stores.find(s => s.name === 'LocalBasket')?.id);
    const href = firstStoreId ? `/stores/${firstStoreId}?category=${encodeURIComponent(categoryName)}` : '/';

    useEffect(() => {
        let mounted = true;
        const fetchImage = async () => {
            setIsLoading(true);
            try {
                const imageId = `cat-${slug}`;
                const fetchedImage = await getProductImage(imageId);
                if (mounted) setImage(fetchedImage);
            } catch (error) {
                console.error("Failed to fetch image for category:", categoryName, error);
                if (mounted) setImage({ imageUrl: 'https://picsum.photos/seed/placeholder/200/200', imageHint: 'placeholder' });
            } finally {
                if (mounted) setIsLoading(false);
            }
        };
        fetchImage();
        return () => { mounted = false; };
    }, [categoryName, slug]);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center gap-2">
                <Skeleton className="w-full h-24 rounded-lg" />
                <Skeleton className="h-4 w-20" />
            </div>
        );
    }
    
    return (
        <Link href={href} className="flex flex-col items-center gap-2 text-center group">
            <div className="w-full aspect-square bg-gray-100 rounded-lg overflow-hidden transition-transform group-hover:scale-105">
                 <Image 
                    src={image.imageUrl} 
                    alt={categoryName} 
                    width={200}
                    height={200}
                    className="w-full h-full object-cover"
                    data-ai-hint={image.imageHint}
                />
            </div>
            <span className="text-xs font-medium text-gray-800 w-full truncate">{categoryName}</span>
        </Link>
    );
}

// New Header component specific to this page layout
function HomepageHeader({ onSearchChange }: { onSearchChange: (term: string) => void }) {
    const [activeMainCategory, setActiveMainCategory] = useState('All');

    return (
        <header className="bg-white/80 backdrop-blur-md sticky top-0 z-20 px-4 pt-4 pb-2 border-b">
            <div className="flex items-center gap-3">
                <Search className="h-5 w-5 text-gray-500" />
                <input
                    type="text"
                    placeholder="Search for atta, dal, coke and m..."
                    className="w-full bg-transparent outline-none border-none text-sm placeholder:text-gray-500"
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                <Mic className="h-5 w-5 text-gray-500" />
            </div>
             <div className="mt-4 flex items-center gap-4 overflow-x-auto pb-2 no-scrollbar">
                {mainCategories.map(cat => {
                    const Icon = cat.icon;
                    const isActive = cat.name === activeMainCategory;
                    return (
                        <button 
                            key={cat.name} 
                            onClick={() => setActiveMainCategory(cat.name)}
                            className={cn(
                                "flex flex-col items-center gap-1.5 flex-shrink-0 w-16 text-xs font-medium transition-colors",
                                isActive ? "text-primary" : "text-gray-600"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            <span>{cat.name}</span>
                            {isActive && <div className="h-1 w-4 bg-primary rounded-full mt-1" />}
                        </button>
                    )
                })}
            </div>
            <style jsx>{`
                .no-scrollbar::-webkit-scrollbar { display: none; }
                .no-scrollbar { -ms-overflow-style: none;  scrollbar-width: none; }
            `}</style>
        </header>
    );
}


/* ---------------- MAIN PAGE ---------------- */
export default function BlinkitStyleHomepage() {
  const { masterProducts, productPrices, loading: isAppLoading, fetchInitialData } = useAppStore();
  const { firestore } = useFirebase();

  const [searchTerm, setSearchTerm] = useState('');

  // Load initial data on mount
  useEffect(() => {
    if (firestore && !useAppStore.getState().isInitialized) {
      fetchInitialData(firestore);
    }
  }, [firestore, fetchInitialData]);

  // Group products by category from your product list
  const categories = useMemo(() => {
    if (!masterProducts) return [];

    const groceryAndKitchen = ["Vegetables & Fruits", "Grains & Cereals", "Dals & Pulses", "Spices & Masalas", "Oils & Ghee", "Dairy & Bakery", "Kitchen Essentials"];
    const snacksAndDrinks = ["Snacks & Breakfast", "Beverages", "Instant Mixes"];
    const personalAndHome = ["Personal Care", "Home Care", "Pet Care"];
    const meat = ["Fresh Cut", "Meat & Fish"];
    
    // This creates a structure similar to the image for demonstration
    const categoryGroups = [
      {
        title: "Grocery & Kitchen",
        items: groceryAndKitchen.map(name => ({
            name: name,
            hint: name.split(',')[0].split(' & ')[0].toLowerCase(), // e.g., "vegetables"
        }))
      },
      {
        title: "Snacks & Drinks",
        items: snacksAndDrinks.map(name => ({
            name: name,
            hint: name.split(',')[0].split(' & ')[0].toLowerCase(), // e.g., "chips"
        }))
      },
      {
        title: "Home & Personal Care",
        items: personalAndHome.map(name => ({
            name: name,
            hint: name.split(',')[0].split(' & ')[0].toLowerCase(),
        }))
      },
      {
        title: "Meat & Fish",
        items: meat.map(name => ({
            name: name,
            hint: name.split(',')[0].split(' & ')[0].toLowerCase(),
        }))
      }
    ];

    return categoryGroups;
  }, [masterProducts]);

  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, masterProducts]);

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <HomepageHeader onSearchChange={setSearchTerm} />

      <main className="p-4 space-y-6">
        {isAppLoading ? (
             Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="space-y-4">
                    <Skeleton className="h-6 w-48" />
                    <div className="grid grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, j) => <Skeleton key={j} className="h-32 w-full" />)}
                    </div>
                </div>
            ))
        ) : searchTerm ? (
             <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Search Results</h2>
                 <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {filteredProducts.length > 0 ? (
                        filteredProducts.map(product => (
                            <ProductCard 
                                key={product.id}
                                product={product}
                                priceData={productPrices[product.name.toLowerCase()]}
                            />
                        ))
                    ) : (
                        <p className="col-span-full text-center text-gray-500">No products found for "{searchTerm}"</p>
                    )}
                </div>
            </div>
        ) : (
            categories.map(group => (
                <div key={group.title}>
                    <h2 className="text-xl font-bold text-gray-800 mb-4">{group.title}</h2>
                    <div className="grid grid-cols-4 gap-x-3 gap-y-6">
                        {group.items.map(item => (
                            <GroceryCategoryCard 
                                key={item.name} 
                                categoryName={item.name} 
                                imageHint={item.hint}
                            />
                        ))}
                    </div>
                </div>
            ))
        )}
      </main>
    </div>
  );
}
