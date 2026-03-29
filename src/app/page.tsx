
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { User, Store as StoreType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { Search, MapPin, ChevronDown, LayoutGrid, Beef, Scissors, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import StoreCard from '@/components/store-card';
import { doc, collection, query, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { RecipeCard } from '@/components/features/recipe-card';

function HomepageHeader({ onSearchChange, user }: { onSearchChange: (term: string) => void, user: User | null }) {
    const [deliveryTime, setDeliveryTime] = useState<number | null>(null);

    useEffect(() => {
        setDeliveryTime(Math.floor(Math.random() * 10) + 15);
    }, []);

    return (
        <div className="bg-background px-4 py-4 space-y-4 shadow-sm border-b">
            <div className="flex justify-between items-center">
                <div>
                     <p className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Quick Dispatch</p>
                     {deliveryTime !== null ? (
                        <p className="text-2xl font-black text-gray-950 tracking-tighter italic">{deliveryTime} mins</p>
                     ) : (
                        <Skeleton className="h-8 w-24 mt-1" />
                     )}
                     {user && user.address && (
                         <div className="flex items-center text-[10px] font-bold text-gray-500 mt-1">
                            <MapPin className="h-3 w-3 mr-1 text-primary" />
                            <span className="truncate max-w-[150px] uppercase tracking-tight">{user.address}</span>
                            <ChevronDown className="h-3 w-3 ml-1" />
                         </div>
                     )}
                </div>
            </div>
            <div className="flex items-center gap-3 bg-[#F1F3F5] p-3 rounded-2xl border border-gray-200 shadow-inner">
                <Search className="h-5 w-5 text-gray-400" />
                <input 
                    type="text" 
                    placeholder="Search for restaurants or salons..." 
                    className="w-full bg-transparent outline-none text-sm font-medium placeholder:text-gray-400" 
                    onChange={(e) => onSearchChange(e.target.value)} 
                />
            </div>
        </div>
    );
}

function HubNavigation() {
    return (
        <ScrollArea className="w-full whitespace-nowrap py-4 border-b bg-white">
            <div className="flex gap-4 px-4">
                <Button asChild variant="outline" className="rounded-full h-10 px-6 font-black text-[10px] uppercase tracking-widest border-2">
                    <Link href="/stores"><LayoutGrid className="mr-2 h-4 w-4" /> All Hubs</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full h-10 px-6 font-black text-[10px] uppercase tracking-widest border-2">
                    <Link href="/stores?category=restaurants"><Beef className="mr-2 h-4 w-4" /> Dining</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full h-10 px-6 font-black text-[10px] uppercase tracking-widest border-2">
                    <Link href="/stores?category=salons"><Scissors className="mr-2 h-4 w-4" /> Wellness</Link>
                </Button>
            </div>
            <ScrollBar orientation="horizontal" className="opacity-0" />
        </ScrollArea>
    );
}

export default function LocalBasketHomepage() {
  const { firestore, user } = useFirebase();
  const { isMerchant, isAdmin, isLoading: isRoleLoading } = useAdminAuth();
  const { stores, isFetchingStores, fetchInitialData, isInitialized } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  const userDocRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);

  useEffect(() => { 
    if (firestore && !isInitialized && !isFetchingStores) fetchInitialData(firestore, user?.uid); 
  }, [firestore, isInitialized, isFetchingStores, fetchInitialData, user?.uid]);

  const filteredStores = useMemo(() => searchTerm ? stores.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : stores, [searchTerm, stores]);

  if (isRoleLoading) {
    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-widest opacity-40">Synchronizing Hub...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <HomepageHeader onSearchChange={setSearchTerm} user={userData} />
      {!searchTerm && <HubNavigation />}
      <main className="p-4 space-y-10">
        <section className="space-y-4">
            <h2 className="text-xl font-black font-headline uppercase tracking-tighter text-gray-950">Marketplace Hub</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {isFetchingStores && stores.length === 0 ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-48 w-full rounded-[2.5rem]" />)
                ) : (
                    filteredStores.map(store => <StoreCard key={store.id} store={store} />)
                )}
            </div>
        </section>
        <RecipeCard />
      </main>
    </div>
  );
}
