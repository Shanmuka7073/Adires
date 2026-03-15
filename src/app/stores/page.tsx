
'use client';

import StoreCard from '@/components/store-card';
import { useFirebase } from '@/firebase';
import type { Store } from '@/lib/types';
import { useEffect, useState, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useAppStore } from '@/lib/store';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MapPin, Loader2, Info, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

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
  const { firestore } = useFirebase();
  const allStores = useAppStore((state) => state.stores);
  const loading = useAppStore((state) => state.loading);
  const fetchInitialData = useAppStore((state) => state.fetchInitialData);

  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [sortedStores, setSortedStores] = useState<Store[]>([]);

  useEffect(() => {
    if (firestore) fetchInitialData(firestore);
  }, [firestore, fetchInitialData]);

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
    let result = sortedStores.filter(s => s.name !== 'LocalBasket'); 
    
    if (searchTerm) {
        result = result.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            s.description.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }

    if (activeTab === 'restaurants') {
        result = result.filter(s => s.businessType === 'restaurant' || s.name.toLowerCase().includes('restaurant') || s.name.toLowerCase().includes('hotel') || s.name.toLowerCase().includes('biryani'));
    } else if (activeTab === 'salons') {
        result = result.filter(s => s.businessType === 'salon' || s.name.toLowerCase().includes('salon') || s.name.toLowerCase().includes('saloon') || s.name.toLowerCase().includes('parlour'));
    } else if (activeTab === 'retail') {
        result = result.filter(s => s.businessType === 'grocery' || (!s.name.toLowerCase().includes('salon') && !s.name.toLowerCase().includes('saloon') && !s.name.toLowerCase().includes('biryani') && !s.name.toLowerCase().includes('hotel')));
    }

    return result;
  }, [sortedStores, searchTerm, activeTab]);

  return (
    <div className="container mx-auto py-10 px-4 md:px-6 max-w-6xl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-10 border-b pb-8">
        <div className="space-y-1">
            <h1 className="text-5xl font-black font-headline tracking-tighter">Market Directory</h1>
            <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest opacity-60">Browse every business owner on the platform</p>
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

      <Tabs defaultValue="all" onValueChange={setActiveTab} className="w-full space-y-8">
        <TabsList className="grid grid-cols-4 w-full md:max-w-md h-12 bg-black/5 p-1 rounded-2xl border">
          <TabsTrigger value="all" className="rounded-xl font-black text-[10px] uppercase">All</TabsTrigger>
          <TabsTrigger value="restaurants" className="rounded-xl font-black text-[10px] uppercase">Food</TabsTrigger>
          <TabsTrigger value="salons" className="rounded-xl font-black text-[10px] uppercase">Beauty</TabsTrigger>
          <TabsTrigger value="retail" className="rounded-xl font-black text-[10px] uppercase">Retail</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-0">
            {loading ? (
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
                <div className="text-center py-32 bg-white rounded-[3rem] border-2 border-dashed border-black/5">
                    <Building2 className="h-12 w-12 mx-auto mb-4 opacity-10" />
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No businesses found in this category.</p>
                </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
