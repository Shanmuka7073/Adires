
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { User, Store as StoreType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { Search, Mic, ChevronDown, MapPin, User as UserCircle, Globe, Download, Loader2, Info, ChefHat, Sparkles, ArrowRight, Store as StoreIcon, LayoutGrid, Beef, Scissors } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import StoreCard from '@/components/store-card';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

const homePageSections = [
    {
        title: 'Popular Categories',
        categories: [
            { name: 'Vegetables', imageHint: 'fresh vegetables', bgColor: 'bg-green-50'},
            { name: 'Fruits', imageHint: 'assorted fruits', bgColor: 'bg-red-50'},
            { name: 'Chicken', imageHint: 'raw chicken', bgColor: 'bg-red-50'},
            { name: 'Oils & Ghee', imageHint: 'cooking oil', bgColor: 'bg-yellow-50'},
            { name: 'Beverages', imageHint: 'soft drinks', bgColor: 'bg-blue-50'},
            { name: 'Snacks', imageHint: 'cereal snacks', bgColor: 'bg-purple-50'},
        ]
    }
];

function GroceryCategoryCard({ categoryName, imageHint, bgColor }: { categoryName: string, imageHint: string, bgColor?: string }) {
    const slug = categoryName.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-');
    const imageId = `cat-${slug}`;
    const image = getProductImage(imageId);
    const firstStoreId = useAppStore(state => state.stores.find(s => s.name === 'LocalBasket')?.id);
    const href = firstStoreId ? `/stores/${firstStoreId}?category=${encodeURIComponent(categoryName)}` : '/stores';

    return (
        <Link href={href} className="flex flex-col items-center gap-2 text-center group bg-white p-2 rounded-xl shadow-sm border border-black/5 hover:shadow-md transition-all">
             <div className={cn("w-full h-16 relative rounded-lg overflow-hidden flex justify-center items-center", bgColor || 'bg-gray-50')}>
                <Image src={image.imageUrl} alt={categoryName} width={40} height={40} className="w-10 h-10 object-contain" />
            </div>
            <span className="text-[10px] font-bold text-gray-800 uppercase tracking-tight truncate w-full px-1">{categoryName}</span>
        </Link>
    );
}

function HomepageHeader({ onSearchChange, user, onMicClick }: { onSearchChange: (term: string) => void, user: User | null, onMicClick: () => void }) {
    const [deliveryTime, setDeliveryTime] = useState<number | null>(null);
    const { onCartOpenChange, isCartOpen, voiceEnabled } = useVoiceCommanderContext();
    const { canInstall, triggerInstall } = useInstall();
    const { isRestaurantOwner } = useAdminAuth();
    const { userStore } = useAppStore();

    useEffect(() => { setDeliveryTime(Math.floor(Math.random() * 10) + 15); }, []);

    const logoUrl = userStore?.imageUrl || ADIRES_LOGO;
    const brandName = userStore?.name || "LocalBasket";

    return (
        <header className="bg-background sticky top-0 z-20 px-4 pt-4 pb-2 border-b">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-primary bg-white shadow-sm">
                        <Image src={logoUrl} alt={brandName} fill className="object-cover" priority />
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-primary uppercase tracking-widest">Delivery in</p>
                        {deliveryTime !== null ? <p className="text-lg font-black text-gray-900">{deliveryTime} mins</p> : <Skeleton className="h-6 w-20 mt-1" />}
                    </div>
                </div>
                 <div className="flex items-center gap-1">
                    {canInstall && <Button variant="ghost" size="icon" onClick={triggerInstall} className="rounded-full"><Download className="h-5 w-5 text-gray-600" /></Button>}
                    {!isRestaurantOwner && (
                        <Button variant="ghost" size="icon" className="h-10 w-10 rounded-full relative bg-primary/5 text-primary border border-primary/10" onClick={onMicClick}>
                            <Mic className="h-5 w-5" />
                            {voiceEnabled && <span className="absolute top-1 right-1 h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse border-2 border-white"></span>}
                        </Button>
                    )}
                    <CartIcon open={isCartOpen} onOpenChange={onCartOpenChange} />
                </div>
            </div>
            <div className="flex items-center gap-3 bg-[#F1F3F5] p-3 rounded-2xl border border-gray-200 shadow-inner">
                <Search className="h-5 w-5 text-gray-400" />
                <input type="text" placeholder={`Search shops, salons or items...`} className="w-full bg-transparent outline-none text-sm font-medium placeholder:text-gray-400" onChange={(e) => onSearchChange(e.target.value)} />
            </div>
        </header>
    );
}

function HubNavigation() {
    return (
        <ScrollArea className="w-full whitespace-nowrap py-4 border-b bg-white">
            <div className="flex gap-4 px-4">
                <Button asChild variant="outline" className="rounded-full h-10 px-6 font-black text-[10px] uppercase tracking-widest border-2">
                    <Link href="/stores"><LayoutGrid className="mr-2 h-4 w-4" /> Market Hub</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full h-10 px-6 font-black text-[10px] uppercase tracking-widest border-2">
                    <Link href="/stores?category=restaurants"><Beef className="mr-2 h-4 w-4" /> Food</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full h-10 px-6 font-black text-[10px] uppercase tracking-widest border-2">
                    <Link href="/stores?category=salons"><Scissors className="mr-2 h-4 w-4" /> Beauty</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full h-10 px-6 font-black text-[10px] uppercase tracking-widest border-2">
                    <Link href="/stores?category=retail"><ShoppingBag className="mr-2 h-4 w-4" /> Groceries</Link>
                </Button>
            </div>
            <ScrollBar orientation="horizontal" className="opacity-0" />
        </ScrollArea>
    );
}

export default function LocalBasketHomepage() {
  const { firestore, user } = useFirebase();
  const { isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
  const router = useRouter();
  const { masterProducts, productPrices, loading: isAppLoading, isInitialized, setActiveStoreId, stores, fetchInitialData } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const { onToggleVoice } = useVoiceCommanderContext();
  
  const userDocRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);
  const masterStoreId = useMemo(() => stores.find(s => s.name === 'LocalBasket')?.id, [stores]);

  useEffect(() => { if (firestore && !isInitialized) fetchInitialData(firestore, user?.uid); }, [firestore, isInitialized, fetchInitialData, user?.uid]);
  useEffect(() => { if (!isRoleLoading && isRestaurantOwner) router.replace('/dashboard/restaurant'); }, [isRoleLoading, isRestaurantOwner, router]);
  useEffect(() => { if(masterStoreId) setActiveStoreId(masterStoreId); return () => setActiveStoreId(null); }, [masterStoreId, setActiveStoreId]);

  const filteredProducts = useMemo(() => searchTerm ? masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase())) : [], [searchTerm, masterProducts]);
  const filteredStores = useMemo(() => searchTerm ? stores.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : [], [searchTerm, stores]);

  if (isRoleLoading || isRestaurantOwner) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  const featuredStores = stores.filter(s => s.name !== 'LocalBasket');

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <HomepageHeader onSearchChange={setSearchTerm} user={userData} onMicClick={onToggleVoice} />
      
      {!searchTerm && <HubNavigation />}

      <main className="p-4 space-y-8">
        {isAppLoading && !isInitialized ? (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full rounded-3xl" />
                <div className="grid grid-cols-3 gap-4">
                    <Skeleton className="h-24 w-full rounded-2xl" />
                    <Skeleton className="h-24 w-full rounded-2xl" />
                    <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
            </div>
        ) : searchTerm ? (
             <div className="space-y-8">
                {filteredStores.length > 0 && (
                    <section className="space-y-4">
                        <h2 className="text-xl font-black font-headline uppercase tracking-tight flex items-center gap-2 text-primary">
                            <StoreIcon className="h-5 w-5" /> Stores Found
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {filteredStores.map(s => <StoreCard key={s.id} store={s} />)}
                        </div>
                    </section>
                )}
                {filteredProducts.length > 0 && (
                    <section className="space-y-4">
                        <h2 className="text-xl font-black font-headline uppercase tracking-tight flex items-center gap-2 text-primary">
                            <ArrowRight className="h-5 w-5" /> Items Found
                        </h2>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {filteredProducts.map(product => <ProductCard key={product.id} product={product} priceData={productPrices[product.name.toLowerCase()]} />)}
                        </div>
                    </section>
                )}
                {filteredStores.length === 0 && filteredProducts.length === 0 && (
                    <div className="text-center py-20 opacity-40">
                        <Search className="h-12 w-12 mx-auto mb-4" />
                        <p className="font-bold">No results for "{searchTerm}"</p>
                    </div>
                )}
            </div>
        ) : (
          <>
            {/* HERO BANNER */}
            <div className="rounded-[2rem] overflow-hidden relative aspect-[2/1] w-full shadow-2xl border-4 border-white">
                <Image 
                    src="https://i.ibb.co/ZQC3c3h/file-00000000f15871fab9942ef91d9c2021.png" 
                    alt="Promotional Banner" 
                    fill 
                    className="object-cover" 
                    priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent flex items-end p-6">
                    <div className="text-white">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-1">Central Marketplace</p>
                        <h3 className="text-2xl font-black leading-tight text-shadow">Everything you need,<br/>all in one app.</h3>
                    </div>
                </div>
            </div>

            {/* CENTRAL MARKETPLACE HUB - ALL BUSINESSES */}
            <section className="space-y-4">
                <div className="flex justify-between items-end px-1">
                    <div>
                        <h2 className="text-xl font-black font-headline uppercase tracking-tighter text-gray-950">Marketplace Hub</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">All Local Business Owners</p>
                    </div>
                    <Button asChild variant="link" className="text-xs font-black uppercase tracking-widest text-primary p-0 h-auto">
                        <Link href="/stores">Open Directory <ArrowRight className="ml-1 h-3 w-3" /></Link>
                    </Button>
                </div>
                <ScrollArea className="w-full whitespace-nowrap pb-4">
                    <div className="flex gap-4 px-1">
                        {featuredStores.length > 0 ? featuredStores.map(store => (
                            <div key={store.id} className="w-[300px] shrink-0">
                                <StoreCard store={store} />
                            </div>
                        )) : (
                            <div className="w-full p-8 text-center bg-white rounded-3xl border-2 border-dashed opacity-40">
                                <p className="text-xs font-bold uppercase tracking-widest">Connecting to local shops...</p>
                            </div>
                        )}
                    </div>
                    <ScrollBar orientation="horizontal" className="opacity-0" />
                </ScrollArea>
            </section>

            <RecipeCard />
            
            {/* CATEGORIES */}
            {homePageSections.map(section => (
                <section key={section.title} className="space-y-4">
                    <div className="px-1">
                        <h2 className="text-xl font-black font-headline uppercase tracking-tighter text-gray-950">{section.title}</h2>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Shop by Category</p>
                    </div>
                     <div className="grid grid-cols-3 gap-3">
                        {section.categories.map(item => <GroceryCategoryCard key={item.name} categoryName={item.name} imageHint={item.imageHint} bgColor={item.bgColor} />)}
                    </div>
                </section>
            ))}

            <Card className="bg-gradient-to-br from-primary/10 to-blue-50 border-0 rounded-[2.5rem] shadow-xl overflow-hidden">
                <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 text-primary mb-1">
                        <Mic className="h-5 w-5" />
                        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Voice Assistant</span>
                    </div>
                    <CardTitle className="text-2xl font-black tracking-tight text-gray-950">Can't find a store?</CardTitle>
                    <CardDescription className="font-bold text-gray-600">Just ask me. I'll search the whole market for you.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary text-xs">1</div>
                            <p className="text-xs font-bold text-gray-800">Tap the Mic</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary text-xs">2</div>
                            <p className="text-xs font-bold text-gray-800 italic">"Where can I buy chicken near me?"</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
}
