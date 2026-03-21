
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { User, Store as StoreType, Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { Search, MapPin, ChevronDown, ArrowRight, LayoutGrid, Beef, Scissors, Loader2 } from 'lucide-react';
import Link from 'next/link';
import StoreCard from '@/components/store-card';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { RecipeCard } from '@/components/features/recipe-card';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

function HomepageContent({ onSearchChange, user }: { onSearchChange: (term: string) => void, user: User | null }) {
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
                        <p className="text-2xl font-black text-gray-900 tracking-tighter italic">{deliveryTime} mins</p>
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

function RecentActivity({ orders, stores }: { orders: Order[] | null, stores: StoreType[] }) {
    if (!orders || orders.length === 0) return null;

    return (
        <section className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex justify-between items-end px-1">
                <div>
                    <h2 className="text-xl font-black font-headline uppercase tracking-tighter text-gray-950">Recent Activity</h2>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Pick up where you left off</p>
                </div>
                <Button asChild variant="link" className="h-auto p-0 font-black text-[9px] uppercase tracking-widest text-primary">
                    <Link href="/dashboard/customer/my-orders">View All <ArrowRight className="ml-1 h-3 w-3" /></Link>
                </Button>
            </div>
            <ScrollArea className="w-full whitespace-nowrap pb-4">
                <div className="flex gap-4 px-1">
                    {orders.map(order => {
                        const store = stores.find(s => s.id === order.storeId);
                        return (
                            <Link key={order.id} href={`/menu/${order.storeId}`} className="block w-64 flex-shrink-0 group">
                                <Card className="rounded-[2rem] border-0 shadow-lg overflow-hidden group-hover:shadow-xl transition-all border-2 border-transparent group-hover:border-primary/20">
                                    <CardContent className="p-4 flex items-center gap-4">
                                        <div className="relative h-12 w-12 rounded-2xl overflow-hidden border shrink-0">
                                            <Image src={store?.imageUrl || ADIRES_LOGO} alt={store?.name || 'Store'} fill className="object-cover" />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-black text-xs uppercase truncate text-gray-900">{store?.name || 'Verified Store'}</p>
                                            <div className="flex items-center gap-2 mt-1">
                                                <Badge variant={order.status === 'Delivered' || order.status === 'Completed' ? 'default' : 'secondary'} className="text-[7px] font-black uppercase h-4 px-1.5">{order.status}</Badge>
                                                <span className="text-[9px] font-bold opacity-40">₹{order.totalAmount.toFixed(0)}</span>
                                            </div>
                                        </div>
                                        <ArrowRight className="h-4 w-4 opacity-20 group-hover:translate-x-1 group-hover:opacity-100 transition-all" />
                                    </CardContent>
                                </Card>
                            </Link>
                        )
                    })}
                </div>
                <ScrollBar orientation="horizontal" className="opacity-0" />
            </ScrollArea>
        </section>
    )
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
  const { isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
  const router = useRouter();
  const { loading: isAppLoading, isInitialized, stores, deviceId, fetchInitialData } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  const userDocRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);

  const historyQuery = useMemoFirebase(() => {
      if (!firestore) return null;
      const identifier = user?.uid || deviceId;
      if (!identifier) return null;
      return query(
          collection(firestore, 'orders'),
          where(user?.uid ? 'userId' : 'deviceId', '==', identifier),
          orderBy('orderDate', 'desc'),
          limit(5)
      );
  }, [firestore, user?.uid, deviceId]);
  const { data: recentOrders } = useCollection<Order>(historyQuery);

  useEffect(() => { if (firestore && !isInitialized) fetchInitialData(firestore, user?.uid); }, [firestore, isInitialized, fetchInitialData, user?.uid]);
  useEffect(() => { if (!isRoleLoading && isRestaurantOwner) router.replace('/dashboard/restaurant'); }, [isRoleLoading, isRestaurantOwner, router]);

  const filteredStores = useMemo(() => searchTerm ? stores.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : stores, [searchTerm, stores]);

  if (isRoleLoading || isRestaurantOwner) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <HomepageContent onSearchChange={setSearchTerm} user={userData} />
      
      {!searchTerm && <HubNavigation />}

      <main className="p-4 space-y-8">
        {isAppLoading && !isInitialized ? (
            <div className="space-y-6">
                <Skeleton className="h-40 w-full rounded-3xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-48 w-full rounded-2xl" />
                    <Skeleton className="h-48 w-full rounded-2xl" />
                </div>
            </div>
        ) : (
             <div className="space-y-10">
                {!searchTerm && <RecentActivity orders={recentOrders} stores={stores} />}

                <section className="space-y-4">
                    <div className="flex justify-between items-end px-1">
                        <div>
                            <h2 className="text-xl font-black font-headline uppercase tracking-tighter text-gray-950">Marketplace Hub</h2>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Verified Local Businesses</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {filteredStores.map(store => (
                            <StoreCard key={store.id} store={store} />
                        ))}
                        {filteredStores.length === 0 && (
                            <div className="col-span-full p-12 text-center bg-white rounded-3xl border-2 border-dashed opacity-40">
                                <p className="text-xs font-bold uppercase tracking-widest">No matching businesses found</p>
                            </div>
                        )}
                    </div>
                </section>

                <RecipeCard />
            </div>
        )}
      </main>
    </div>
  );
}
