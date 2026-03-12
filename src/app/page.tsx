'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { User } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { Search, Mic, ChevronDown, MapPin, User as UserCircle, Globe, Download, Loader2, Info, ChefHat, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import ProductCard from '@/components/product-card';
import { doc } from 'firebase/firestore';
import { useVoiceCommanderContext } from '@/components/layout/voice-commander-context';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { CartIcon } from '@/components/cart/cart-icon';
import { RecipeCard } from '@/components/features/recipe-card';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useInstall } from '@/components/install-provider';
import { useAdminAuth } from '@/hooks/use-admin-auth';

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
    }, [categoryName]);

    if (isLoading) return <Skeleton className="w-full h-24 rounded-lg" />;
    
    return (
        <Link href={href} className="flex flex-col items-center gap-2 text-center group bg-white p-2 rounded-lg shadow-sm">
             <div className={cn("w-full h-16 relative rounded-lg overflow-hidden flex justify-center items-center gap-1", bgColor || 'bg-gray-50')}>
                <Image src={image.imageUrl} alt={categoryName} width={50} height={50} className="w-12 h-12 object-contain" />
                 {count && count > 0 && <div className="flex flex-col items-center"><span className="text-xs font-bold text-gray-600">+{count}</span></div>}
            </div>
            <span className="text-xs font-medium text-gray-800 w-full truncate">{categoryName}</span>
        </Link>
    );
}

function HomepageHeader({ onSearchChange, user, onMicClick }: { onSearchChange: (term: string) => void, user: User | null, onMicClick: () => void }) {
    const [deliveryTime, setDeliveryTime] = useState<number | null>(null);
    const { onCartOpenChange, isCartOpen, voiceEnabled } = useVoiceCommanderContext();
    const { canInstall, triggerInstall } = useInstall();
    const { isRestaurantOwner } = useAdminAuth();

    useEffect(() => { setDeliveryTime(Math.floor(Math.random() * 10) + 15); }, []);

    return (
        <header className="bg-background sticky top-0 z-20 px-4 pt-4 pb-2 border-b">
            <div className="flex justify-between items-center mb-3">
                <div>
                     <p className="text-xs font-bold text-gray-700 uppercase">Delivery in</p>
                     {deliveryTime !== null ? <p className="text-xl font-bold text-gray-900">{deliveryTime} minutes</p> : <Skeleton className="h-7 w-24 mt-1" />}
                </div>
                 <div className="flex items-center gap-1">
                    {canInstall && <Button variant="ghost" size="icon" onClick={triggerInstall}><Download className="h-5 w-5 text-gray-600" /></Button>}
                    {!isRestaurantOwner && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full relative" onClick={onMicClick}>
                            <Mic className="h-5 w-5 text-gray-600" />
                            {voiceEnabled && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
                        </Button>
                    )}
                    <CartIcon open={isCartOpen} onOpenChange={onCartOpenChange} />
                </div>
            </div>
            <div className="flex items-center gap-3 bg-[#F1F3F5] p-2.5 rounded-xl border border-gray-200 shadow-sm">
                <Search className="h-5 w-5 text-gray-500" />
                <input type="text" placeholder='Search "vegetables"' className="w-full bg-transparent outline-none text-sm" onChange={(e) => onSearchChange(e.target.value)} />
            </div>
        </header>
    );
}

export default function LocalBasketHomepage() {
  const { firestore, user } = useFirebase();
  const { isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
  const router = useRouter();
  const { masterProducts, productPrices, loading: isAppLoading, isInitialized, setActiveStoreId, stores } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const { onToggleVoice } = useVoiceCommanderContext();
  
  const userDocRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);
  const masterStoreId = useMemo(() => stores.find(s => s.name === 'LocalBasket')?.id, [stores]);

  useEffect(() => { if (!isRoleLoading && isRestaurantOwner) router.replace('/dashboard/restaurant'); }, [isRoleLoading, isRestaurantOwner, router]);
  useEffect(() => { if(masterStoreId) setActiveStoreId(masterStoreId); return () => setActiveStoreId(null); }, [masterStoreId, setActiveStoreId]);

  const filteredProducts = useMemo(() => searchTerm ? masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) : [], [searchTerm, masterProducts]);

  if (isRoleLoading || isRestaurantOwner) return <div className="flex h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="min-h-screen bg-[#f3f4f6]">
      <HomepageHeader onSearchChange={setSearchTerm} user={userData} onMicClick={onToggleVoice} />
      <main className="p-4 space-y-6">
        {isAppLoading && !isInitialized ? <Skeleton className="h-64 w-full" /> : searchTerm ? (
             <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {filteredProducts.map(product => <ProductCard key={product.id} product={product} priceData={productPrices[product.name.toLowerCase()]} />)}
            </div>
        ) : (
          <>
            <VoiceInstructions />
            <RecipeCard />
            {homePageSections.map(section => (
                <div key={section.title}>
                    <h2 className="text-xl font-bold text-gray-800 mb-4">{section.title}</h2>
                     <div className="grid grid-cols-3 gap-2">
                        {section.categories.map(item => <GroceryCategoryCard key={item.name} categoryName={item.name} imageHint={item.imageHint} count={item.count} bgColor={item.bgColor} />)}
                    </div>
                </div>
            ))}
          </>
        )}
      </main>
    </div>
  );
}

function VoiceInstructions() {
    return (
        <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
            <CardHeader><CardTitle className="text-blue-800">Voice Commands</CardTitle></CardHeader>
            <CardContent className="text-sm text-blue-700">Say "Order 1kg chicken to home" to place an order instantly.</CardContent>
        </Card>
    );
}
