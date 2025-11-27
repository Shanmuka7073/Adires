
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Product as ProductType, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { Search, Menu as MenuIcon, Mic, ShoppingBag, Heart, Star, Briefcase, Sparkles, Lamp, Home as HomeIcon, LayoutGrid, ChevronDown, MapPin, User as UserCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import ProductCard from '@/components/product-card';
import { doc } from 'firebase/firestore';
import { useVoiceCommanderContext } from '@/components/layout/main-layout';

// Main categories for the top scroller
const mainCategories = [
  { name: 'All', icon: LayoutGrid },
  { name: 'Wedding', icon: Heart, tag: 'New' },
  { name: 'Electronics', icon: Briefcase },
  { name: 'Beauty', icon: Sparkles },
  { name: 'Decor', icon: Lamp },
  { name: 'Home', icon: HomeIcon },
];

const frequentlyBoughtCategories = [
    { name: 'Oil, Ghee & Masala', imageHint: 'oil ghee masala', count: 8 },
    { name: 'Rajma, Chole & Dal', imageHint: 'lentils dal', count: 0 },
    { name: 'Home Essentials', imageHint: 'cleaning supplies', count: 0 },
    { name: 'Rice, Atta & more', imageHint: 'rice flour', count: 0 },
    { name: 'Dry Fruits & Cereals', imageHint: 'dry fruits', count: 1 },
];

// Reusable Category Card for the main grid
function GroceryCategoryCard({ categoryName, imageHint, count }: { categoryName: string, imageHint: string, count?: number }) {
    const [image, setImage] = useState({ imageUrl: 'https://picsum.photos/seed/placeholder/200/200', imageHint: 'placeholder' });
    const [isLoading, setIsLoading] = useState(true);
    const slug = categoryName.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-');
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
        <Link href={href} className="flex flex-col items-center gap-2 text-center group bg-white p-2 rounded-lg shadow-sm">
             <div className="w-full h-24 relative rounded-lg overflow-hidden flex justify-center items-center gap-1 bg-gray-50">
                <Image 
                    src={image.imageUrl} 
                    alt={categoryName} 
                    width={80}
                    height={80}
                    className="w-16 h-16 object-contain"
                    data-ai-hint={image.imageHint}
                />
                 {count && count > 0 && (
                     <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-gray-600">+{count}</span>
                        <span className="text-xs text-gray-500">more</span>
                     </div>
                 )}
            </div>
            <span className="text-xs font-medium text-gray-800 w-full truncate">{categoryName}</span>
        </Link>
    );
}


// New Header component specific to this page layout
function HomepageHeader({ onSearchChange, user, onMicClick }: { onSearchChange: (term: string) => void, user: User | null, onMicClick: () => void }) {
    const [activeMainCategory, setActiveMainCategory] = useState('All');
    const deliveryTime = useMemo(() => Math.floor(Math.random() * 10) + 15, []);

    return (
        <header className="bg-[#f0faff] sticky top-0 z-20 px-4 pt-4 pb-2 border-b">
            <div className="flex justify-between items-center mb-3">
                <div>
                     <p className="text-xs font-bold text-gray-700 uppercase">Blinkit in</p>
                     <p className="text-xl font-bold text-gray-900">{deliveryTime} minutes</p>
                     {user && (
                         <div className="flex items-center text-xs text-gray-600 mt-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span className="font-semibold truncate max-w-[150px]">{user.firstName} {user.lastName} - {user.address}</span>
                            <ChevronDown className="h-3 w-3" />
                         </div>
                     )}
                </div>
                 <div className="flex items-center gap-2">
                    <div className="relative">
                        <Image src="https://i.ibb.co/VvZf0bY/rupee-bag.png" alt="Wallet" width={28} height={28} />
                        <span className="absolute -bottom-1 -right-1 text-[10px] font-bold bg-white rounded-full px-1">₹0</span>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <UserCircle className="h-5 w-5 text-gray-600"/>
                    </div>
                </div>
            </div>
            <div className="flex items-center gap-3 bg-white p-2.5 rounded-lg border border-gray-200 shadow-sm">
                <Search className="h-5 w-5 text-gray-500" />
                <input
                    type="text"
                    placeholder='Search "gardening essentials"'
                    className="w-full bg-transparent outline-none border-none text-sm placeholder:text-gray-500"
                    onChange={(e) => onSearchChange(e.target.value)}
                />
                <button onClick={onMicClick}>
                    <Mic className="h-5 w-5 text-gray-500" />
                </button>
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
                                "flex flex-col items-center gap-1.5 flex-shrink-0 w-16 text-xs font-medium transition-colors relative",
                                isActive ? "text-primary" : "text-gray-600"
                            )}
                        >
                            <Icon className="h-5 w-5" />
                            <span>{cat.name}</span>
                            {cat.tag && <span className="absolute -top-1 -right-1 text-[9px] bg-red-500 text-white font-bold px-1.5 py-0.5 rounded-full">{cat.tag}</span>}
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
  const { firestore, user } = useFirebase();
  const { masterProducts, productPrices, loading: isAppLoading, fetchInitialData } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const { onToggleVoice } = useVoiceCommanderContext();
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);


  // Load initial data on mount
  useEffect(() => {
    if (firestore && !useAppStore.getState().isInitialized) {
      fetchInitialData(firestore);
    }
  }, [firestore, fetchInitialData]);


  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, masterProducts]);

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <HomepageHeader onSearchChange={setSearchTerm} user={userData} onMicClick={onToggleVoice} />

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
          <>
            <div className="rounded-lg overflow-hidden">
                <Image src="https://i.ibb.co/Yy9R8gJ/ocean-banner.png" alt="O'cean Fruit Drink Banner" width={800} height={400} className="w-full h-auto" />
            </div>

            <div>
                <h2 className="text-xl font-bold text-gray-800 mb-4">Frequently bought</h2>
                 <div className="grid grid-cols-3 gap-2">
                    {frequentlyBoughtCategories.map(item => (
                        <GroceryCategoryCard 
                            key={item.name} 
                            categoryName={item.name} 
                            imageHint={item.imageHint}
                            count={item.count}
                        />
                    ))}
                </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
