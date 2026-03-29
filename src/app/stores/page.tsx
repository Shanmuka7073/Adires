'use client';

import StoreCard from '@/components/store-card';
import { useFirebase } from '@/firebase';
import type { Store } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { useAppStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
<<<<<<< HEAD
import { Search, Building2, Loader2 } from 'lucide-react';
=======
import { Search, Building2 } from 'lucide-react';
>>>>>>> 4742da82200849f40d246aaabc747352d08f8b8e
import { Input } from '@/components/ui/input';
import { useSearchParams } from 'next/navigation';

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return Infinity;
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
}

export default function StoresPage() {
  const { firestore, user } = useFirebase();
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  
  const allStores = useAppStore((state) => state.stores);
<<<<<<< HEAD
  const isFetchingStores = useAppStore((state) => state.isFetchingStores);
=======
  const isFetching = useAppStore((state) => state.isFetchingStores);
>>>>>>> 4742da82200849f40d246aaabc747352d08f8b8e
  const isInitialized = useAppStore((state) => state.isInitialized);
  const fetchInitialData = useAppStore((state) => state.fetchInitialData);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState(categoryParam || 'all');
  const [sortedStores, setSortedStores] = useState<Store[]>([]);

  useEffect(() => {
<<<<<<< HEAD
    if (firestore && !isInitialized && !isFetchingStores) fetchInitialData(firestore, user?.uid);
  }, [firestore, fetchInitialData, isInitialized, isFetchingStores, user?.uid]);
=======
    if (firestore && !isInitialized && !isFetching) fetchInitialData(firestore);
  }, [firestore, fetchInitialData, isInitialized, isFetching]);
>>>>>>> 4742da82200849f40d246aaabc747352d08f8b8e

  useEffect(() => {
    if (categoryParam) {
      setActiveTab(categoryParam);
    }
  }, [categoryParam]);

  useEffect(() => {
    if (allStores.length > 0) {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude } = position.coords;
            const storesWithDistance = allStores.map((store) => ({
              ...store,
              distance: haversineDistance(latitude, longitude, store.latitude, store.longitude),
            }));
            storesWithDistance.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
            setSortedStores(storesWithDistance);
          },
          () => {
            setSortedStores(allStores); 
          }
        );
      } else {
        setSortedStores(allStores);
      }
    }
  }, [allStores]);

  const filteredStores = useMemo(() => {
    let result = sortedStores.filter(s => s.name !== 'LocalBasket' && !s.isClosed); 
    
    if (searchTerm) {
        result = result.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    const checkIsRestaurant = (s: Store) => {
        if (s.businessType === 'restaurant') return true;
        if (s.businessType) return false;
        const pool = `${s.name} ${s.description}`.toLowerCase();
        return [
            'restaurant', 'restuarent', 'hotel', 'biryani', 'tiffin', 'mess', 
            'canteen', 'dhaba', 'food', 'meals', 'sweets', 'bakery', 'kitchen', 
            'cafe', 'bakers', 'grand', 'deluxe', 'paradise', 'pantry', 'grill', 
            'bbq', 'fry', 'kabab', 'fast food', 'curry'
        ].some(kw => pool.includes(kw));
    };

    const checkIsSalon = (s: Store) => {
        if (s.businessType === 'salon') return true;
        if (s.businessType) return false;
        const pool = `${s.name} ${s.description}`.toLowerCase();
        return ['salon', 'saloon', 'parlour', 'beauty', 'hair', 'cut', 'spa', 'massage', 'style', 'makeup', 'barber'].some(kw => pool.includes(kw));
    };

    if (activeTab === 'restaurants') {
        result = result.filter(checkIsRestaurant);
    } else if (activeTab === 'salons') {
        result = result.filter(checkIsSalon);
    } else if (activeTab === 'retail') {
        result = result.filter(s => s.businessType === 'grocery' || (!checkIsRestaurant(s) && !checkIsSalon(s)));
    }

    return result;
  }, [sortedStores, searchTerm, activeTab]);

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 max-w-6xl pb-24 md:pb-10">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 border-b pb-8">
        <div className="space-y-1">
            <h1 className="text-5xl font-black font-headline tracking-tighter uppercase italic">Hub Directory</h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest opacity-60">Verified Business Network</p>
        </div>
        <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
                placeholder="Find a store or owner..." 
                className="pl-10 h-12 rounded-2xl border-2 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-8">
        <TabsList className="grid grid-cols-4 w-full md:max-w-md h-12 bg-black/5 p-1 rounded-2xl border">
          <TabsTrigger value="all" className="rounded-xl font-black text-[10px] uppercase">All</TabsTrigger>
          <TabsTrigger value="restaurants" className="rounded-xl font-black text-[10px] uppercase">Dining</TabsTrigger>
          <TabsTrigger value="salons" className="rounded-xl font-black text-[10px] uppercase">Salon</TabsTrigger>
          <TabsTrigger value="retail" className="rounded-xl font-black text-[10px] uppercase">Retail</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
<<<<<<< HEAD
            {isFetchingStores && allStores.length === 0 ? (
=======
            {isFetching && !isInitialized ? (
>>>>>>> 4742da82200849f40d246aaabc747352d08f8b8e
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    <Skeleton className="h-64 w-full rounded-3xl" />
                    <Skeleton className="h-64 w-full rounded-3xl" />
                    <Skeleton className="h-64 w-full rounded-3xl" />
                </div>
            ) : filteredStores.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredStores.map((store) => (
                        <StoreCard key={store.id} store={store} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-black/5 opacity-40">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-20" />
                    <p className="text-[10px] font-black uppercase tracking-widest">No hubs detected</p>
                </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
