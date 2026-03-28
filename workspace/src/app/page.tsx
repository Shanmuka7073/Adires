
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { User, Store as StoreType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { Search, MapPin, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { doc } from 'firebase/firestore';
import { RecipeCard } from '@/components/features/recipe-card';
import { getProductImage } from '@/lib/data';
import Image from 'next/image';
import Link from 'next/link';
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, DropdownMenuLabel } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { CartIcon } from '@/components/cart/cart-icon';

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
        title: 'Groceries & Kitchen',
        categories: [
            { name: 'Vegetables', imageHint: 'fresh vegetables', count: 0, bgColor: 'bg-green-50'},
            { name: 'Fruits', imageHint: 'assorted fruits', count: 0, bgColor: 'bg-red-50'},
            { name: 'Dals & Pulses', imageHint: 'lentils dal', count: 0, bgColor: 'bg-orange-50'},
            { name: 'Oils & Ghee', imageHint: 'cooking oil', count: 0, bgColor: 'bg-yellow-50'},
            { name: 'Spices & Masalas', imageHint: 'spices masala', count: 0, bgColor: 'bg-red-50'},
            { name: 'Kitchen Essentials', imageHint: 'kitchen essentials', count: 0, bgColor: 'bg-gray-50'},
        ]
    }
];

function GroceryCategoryCard({ categoryName, imageHint, count, bgColor }: { categoryName: string, imageHint: string, count?: number, bgColor?: string }) {
    const [image, setImage] = useState({ imageUrl: 'https://picsum.photos/seed/placeholder/200/200', imageHint: 'placeholder' });
    const [isLoading, setIsLoading] = useState(true);
    const firstStoreId = useAppStore(state => state.stores.find(s => s.name === 'LocalBasket')?.id);
    const href = firstStoreId ? `/stores/${firstStoreId}?category=${encodeURIComponent(categoryName)}` : '/';

    useEffect(() => {
        let mounted = true;
        const fetchImage = async () => {
            setIsLoading(true);
            try {
                const slug = categoryName.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-');
                const fetchedImage = await getProductImage(`cat-${slug}`);
                if (mounted) setImage(fetchedImage);
            } catch (error) {
                setImage({ imageUrl: 'https://picsum.photos/seed/placeholder/128/128', imageHint: 'placeholder' });
            } finally {
                if (mounted) setIsLoading(false);
            }
        };
        fetchImage();
        return () => { mounted = false; };
    }, [categoryName]);

    if (isLoading) return <Skeleton className="w-full h-16 rounded-lg" />;
    
    return (
        <Link href={href} className="flex flex-col items-center gap-2 text-center group bg-white p-2 rounded-lg shadow-sm">
             <div className={cn("w-full h-16 relative rounded-lg overflow-hidden flex justify-center items-center gap-1", bgColor || 'bg-gray-50')}>
                <Image src={image.imageUrl} alt={categoryName} width={50} height={50} className="w-12 h-12 object-contain" />
            </div>
            <span className="text-[10px] font-bold text-gray-800 w-full truncate uppercase tracking-tighter">{categoryName}</span>
        </Link>
    );
}

function LanguageSwitcher() {
    const { language, setLanguage } = useAppStore();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full"><Globe className="h-5 w-5 text-gray-600" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
                    <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="te">Telugu</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function HomepageHeader({ onSearchChange, user }: { onSearchChange: (term: string) => void, user: User | null }) {
    const { setCartOpen, isCartOpen } = useAppStore();
    return (
        <header className="bg-background sticky top-0 z-20 px-4 pt-4 pb-2 border-b">
            <div className="flex justify-between items-center mb-3">
                <div>
                     <p className="text-[10px] font-black text-primary uppercase tracking-widest">Adires Market</p>
                     {user && user.address && (
                         <div className="flex items-center text-[10px] font-bold text-gray-500 mt-1">
                            <MapPin className="h-3 w-3 mr-1" />
                            <span className="truncate max-w-[150px]">{user.address}</span>
                         </div>
                     )}
                </div>
                 <div className="flex items-center gap-1">
                    <LanguageSwitcher />
                    <CartIcon open={isCartOpen} onOpenChange={setCartOpen} />
                </div>
            </div>
            <div className="flex items-center gap-3 bg-[#F1F3F5] p-2.5 rounded-xl border border-gray-200 shadow-inner">
                <Search className="h-5 w-5 text-gray-500" />
                <input type="text" placeholder='Search hub...' className="w-full bg-transparent outline-none border-none text-sm" onChange={(e) => onSearchChange(e.target.value)} />
            </div>
        </header>
    );
}

export default function LocalBasketHomepage() {
  const { firestore, user } = useFirebase();
  const { isFetchingStores: isAppLoading, isInitialized, fetchInitialData } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const userDocRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);

  useEffect(() => { if (firestore && !isInitialized) fetchInitialData(firestore, user?.uid); }, [firestore, isInitialized, fetchInitialData, user?.uid]);

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <HomepageHeader onSearchChange={setSearchTerm} user={userData} />
      <main className="p-4 space-y-6">
        {isAppLoading && !isInitialized ? <Skeleton className="h-48 w-full rounded-3xl" /> : (
          <>
            <RecipeCard />
            {homePageSections.map(section => (
                <div key={section.title}>
                    <h2 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-3 px-1">{section.title}</h2>
                     <div className="grid grid-cols-3 gap-2">
                        {section.categories.map(item => <GroceryCategoryCard key={item.name} categoryName={item.name} imageHint={item.imageHint} bgColor={item.bgColor} />)}
                    </div>
                </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}
