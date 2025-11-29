
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Product as ProductType, User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { Search, Menu as MenuIcon, Mic, ShoppingBag, Heart, Star, Briefcase, Sparkles, Lamp, Home as HomeIcon, LayoutGrid, ChevronDown, MapPin, User as UserCircle, Globe, ChefHat, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import ProductCard from '@/components/product-card';
import { doc } from 'firebase/firestore';
import { useVoiceCommanderContext } from '@/components/layout/main-layout';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { CartIcon } from '@/components/cart/cart-icon';
import { RecipeCard } from '@/components/features/recipe-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';


const homePageSections = [
    {
        title: 'Frequently bought',
        categories: [
            { name: 'Oils & Ghee', imageHint: 'oil ghee masala', count: 8, bgColor: 'bg-yellow-50' },
            { name: 'Dals & Pulses', imageHint: 'lentils dal', count: 0, bgColor: 'bg-orange-50' },
            { name: 'Home Care', imageHint: 'cleaning supplies', count: 0, bgColor: 'bg-blue-50' },
            { name: 'Grains & Cereals', imageHint: 'rice flour', count: 0, bgColor: 'bg-amber-50' },
            { name: 'Dry Fruits & Nuts', imageHint: 'dry fruits', count: 1, bgColor: 'bg-stone-50' },
        ]
    },
    {
        title: 'Meat & Fish',
        categories: [
            { name: 'Chicken', imageHint: 'raw chicken', count: 0, bgColor: 'bg-red-50'},
            { name: 'Meat & Fish', imageHint: 'fresh fish', count: 0, bgColor: 'bg-blue-50'},
        ]
    },
    {
        title: 'Groceries & Kitchen',
        categories: [
            { name: 'Vegetables', imageHint: 'fresh vegetables', count: 0, bgColor: 'bg-green-50'},
            { name: 'Fruits', imageHint: 'assorted fruits', count: 0, bgColor: 'bg-red-50'},
            { name: 'Dals & Pulses', imageHint: 'lentils dal', count: 0, bgColor: 'bg-orange-50'},
            { name: 'Oils & Ghee', imageHint: 'cooking oil', count: 0, bgColor: 'bg-yellow-50'},
            { name: 'Spices & Masalas', imageHint: 'spices masala', count: 0, bgColor: 'bg-red-50'},
            { name: 'Kitchen Essentials', imageHint: 'kitchen essentials', count: 0, bgColor: 'bg-gray-50'},
        ]
    },
    {
        title: 'Snacks & Drinks',
        categories: [
            { name: 'Snacks & Breakfast', imageHint: 'cereal snacks', count: 0, bgColor: 'bg-purple-50'},
            { name: 'Beverages', imageHint: 'soft drinks', count: 0, bgColor: 'bg-blue-50'},
            { name: 'Sauces & Condiments', imageHint: 'sauces condiments', count: 0, bgColor: 'bg-rose-50'},
        ]
    },
    {
        title: 'Beauty & Personal Care',
        categories: [
            { name: 'Personal Care', imageHint: 'soap', count: 0, bgColor: 'bg-pink-50'},
        ]
    },
     {
        title: 'Household Essentials',
        categories: [
            { name: 'Home Care', imageHint: 'cleaning supplies', count: 0, bgColor: 'bg-sky-50'},
            { name: 'Pet Care', imageHint: 'pet food', count: 0, bgColor: 'bg-lime-50'},
        ]
    }
];


// Reusable Category Card for the main grid
function GroceryCategoryCard({ categoryName, imageHint, count, bgColor }: { categoryName: string, imageHint: string, count?: number, bgColor?: string }) {
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
                setImage({ imageUrl: 'https://picsum.photos/seed/placeholder/128/128', imageHint: 'placeholder' });
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
                <Skeleton className="w-full h-16 rounded-lg" />
                <Skeleton className="h-4 w-20" />
            </div>
        );
    }
    
    return (
        <Link href={href} className="flex flex-col items-center gap-2 text-center group bg-white p-2 rounded-lg shadow-sm">
             <div className={cn("w-full h-16 relative rounded-lg overflow-hidden flex justify-center items-center gap-1", bgColor || 'bg-gray-50')}>
                <Image 
                    src={image.imageUrl} 
                    alt={categoryName} 
                    width={50}
                    height={50}
                    className="w-12 h-12 object-contain"
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

function LanguageSwitcher() {
    const { language, setLanguage } = useAppStore();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full">
                    <Globe className="h-5 w-5 text-gray-600" />
                    <span className="sr-only">Change language</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Select Language</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
                    <DropdownMenuRadioItem value="en">
                        English
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="te">
                        Telugu
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// New Header component specific to this page layout
function HomepageHeader({ onSearchChange, user, onMicClick }: { onSearchChange: (term: string) => void, user: User | null, onMicClick: () => void }) {
    const [deliveryTime, setDeliveryTime] = useState<number | null>(null);
    const { onCartOpenChange, isCartOpen, voiceEnabled } = useVoiceCommanderContext();

    useEffect(() => {
        // Generate random delivery time only on the client-side to avoid hydration errors
        setDeliveryTime(Math.floor(Math.random() * 10) + 15);
    }, []);

    return (
        <header className="bg-background sticky top-0 z-20 px-4 pt-4 pb-2 border-b">
            <div className="flex justify-between items-center mb-3">
                <div>
                     <p className="text-xs font-bold text-gray-700 uppercase">Delivery in</p>
                     {deliveryTime !== null ? (
                        <p className="text-xl font-bold text-gray-900">{deliveryTime} minutes</p>
                     ) : (
                        <Skeleton className="h-7 w-24 mt-1" />
                     )}
                     {user && user.address && (
                         <div className="flex items-center text-xs text-gray-600 mt-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span className="font-semibold truncate max-w-[150px]">{user.address}</span>
                            <ChevronDown className="h-3 w-3" />
                         </div>
                     )}
                </div>
                 <div className="flex items-center gap-1">
                    <LanguageSwitcher />
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full relative" onClick={onMicClick}>
                        <Mic className="h-5 w-5 text-gray-600" />
                        {voiceEnabled && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
                    </Button>
                    <CartIcon open={isCartOpen} onOpenChange={onCartOpenChange} />
                     <Link href="/dashboard/customer/my-profile">
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                            <UserCircle className="h-5 w-5 text-gray-600"/>
                        </div>
                    </Link>
                </div>
            </div>
            <div className="flex items-center gap-3 bg-[#F1F3F5] p-2.5 rounded-xl border border-gray-200">
                <Search className="h-5 w-5 text-gray-500" />
                <input
                    type="text"
                    placeholder='Search "gardening essentials"'
                    className="w-full bg-transparent outline-none border-none text-sm placeholder:text-gray-500"
                    onChange={(e) => onSearchChange(e.target.value)}
                />
            </div>
        </header>
    );
}

function VoiceInstructions() {
    const { onToggleVoice } = useVoiceCommanderContext();
    return (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 font-headline text-blue-800">
                    <Lightbulb className="h-6 w-6" />
                    How to use Voice
                </CardTitle>
                <CardDescription className="text-blue-700">
                    Tap the microphone icon in the header and try saying one of these commands.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
                <ul className="text-sm text-gray-700 list-disc pl-5 space-y-2">
                    <li><span className="font-semibold">"add one kilo of onions"</span></li>
                    <li><span className="font-semibold">"cost of tomatoes"</span></li>
                    <li><span className="font-semibold">"go to my cart"</span></li>
                </ul>
                 <Button onClick={onToggleVoice} className="w-full mt-2">
                    <Mic className="mr-2 h-4 w-4" /> Try It Now
                </Button>
            </CardContent>
        </Card>
    );
}


/* ---------------- MAIN PAGE ---------------- */
export default function LocalBasketHomepage() {
  const { firestore, user } = useFirebase();
  const { masterProducts, productPrices, loading: isAppLoading, fetchInitialData, isInitialized, setActiveStoreId, stores } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const { onToggleVoice } = useVoiceCommanderContext();
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);
  
  const masterStoreId = useMemo(() => stores.find(s => s.name === 'LocalBasket')?.id, [stores]);


  // Load initial data on mount
  useEffect(() => {
    if (firestore && !isInitialized) {
      fetchInitialData(firestore);
    }
  }, [firestore, isInitialized, fetchInitialData]);

  // Set the active store to the master store when on the homepage
  useEffect(() => {
    if(masterStoreId) {
      setActiveStoreId(masterStoreId);
    }
    // Cleanup when leaving the page
    return () => setActiveStoreId(null);
  }, [masterStoreId, setActiveStoreId]);


  const filteredProducts = useMemo(() => {
    if (!searchTerm) return [];
    return masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [searchTerm, masterProducts]);

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <HomepageHeader onSearchChange={setSearchTerm} user={userData} onMicClick={onToggleVoice} />

      <main className="p-4 space-y-6">
        {isAppLoading && !isInitialized ? (
             Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-4">
                    <Skeleton className="h-6 w-48" />
                    <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 6 }).map((_, j) => <Skeleton key={j} className="h-24 w-full" />)}
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
                <Image src="https://i.ibb.co/ZQC3c3h/file-00000000f15871fab9942ef91d9c2021.png" alt="Promotional Banner" width={800} height={400} className="w-full h-auto" />
            </div>
            
            <VoiceInstructions />

            <RecipeCard />
            
            {homePageSections.map(section => (
                <div key={section.title}>
                    <h2 className="text-xl font-bold text-gray-800 mb-4">{section.title}</h2>
                     <div className="grid grid-cols-3 gap-2">
                        {section.categories.map(item => (
                            <GroceryCategoryCard 
                                key={item.name} 
                                categoryName={item.name} 
                                imageHint={item.imageHint}
                                count={item.count}
                                bgColor={item.bgColor}
                            />
                        ))}
                    </div>
                </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
