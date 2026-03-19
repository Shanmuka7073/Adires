
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { User, Store as StoreType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { Search, Mic, ChevronDown, MapPin, User as UserCircle, Globe, Download, Loader2, Sparkles, ArrowRight, Store as StoreIcon, LayoutGrid, Beef, Scissors, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import StoreCard from '@/components/store-card';
import { doc } from 'firebase/firestore';
import { useVoiceCommanderContext } from '@/components/layout/voice-commander-context';
import { Button } from '@/components/ui/button';
import { CartIcon } from '@/components/cart/cart-icon';
import { useInstall } from '@/components/install-provider';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

function HomepageHeader({ onSearchChange, user, onMicClick }: { onSearchChange: (term: string) => void, user: User | null, onMicClick: () => void }) {
    const { onCartOpenChange, isCartOpen, voiceEnabled } = useVoiceCommanderContext();
    const { canInstall, triggerInstall } = useInstall();
    const { isRestaurantOwner } = useAdminAuth();
    const { userStore } = useAppStore();

    const logoUrl = userStore?.imageUrl || ADIRES_LOGO;
    const brandName = userStore?.name || "Adires";

    return (
        <header className="bg-background sticky top-0 z-20 px-4 pt-4 pb-2 border-b">
            <div className="flex justify-between items-center mb-3">
                <div className="flex items-center gap-3">
                    <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-primary bg-white shadow-sm">
                        <Image src={logoUrl} alt={brandName} fill className="object-cover" priority />
                    </div>
                    <div>
                        <p className="text-[8px] font-black text-primary uppercase tracking-widest">Business Hub</p>
                        <p className="text-lg font-black text-gray-900 leading-none">{brandName}</p>
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
                <input type="text" placeholder={`Search for restaurants or salons...`} className="w-full bg-transparent outline-none text-sm font-medium placeholder:text-gray-400" onChange={(e) => onSearchChange(e.target.value)} />
            </div>
        </header>
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
  const { isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
  const router = useRouter();
  const { loading: isAppLoading, isInitialized, stores, fetchInitialData } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  const { onToggleVoice } = useVoiceCommanderContext();
  
  const userDocRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);

  useEffect(() => { if (firestore && !isInitialized) fetchInitialData(firestore, user?.uid); }, [firestore, isInitialized, fetchInitialData, user?.uid]);
  useEffect(() => { if (!isRoleLoading && isRestaurantOwner) router.replace('/dashboard/restaurant'); }, [isRoleLoading, isRestaurantOwner, router]);

  const filteredStores = useMemo(() => searchTerm ? stores.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : stores, [searchTerm, stores]);

  if (isRoleLoading || isRestaurantOwner) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" /></div>;

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <HomepageHeader onSearchChange={setSearchTerm} user={userData} onMicClick={onToggleVoice} />
      
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
             <div className="space-y-8">
                <section className="space-y-4">
                    <div className="flex justify-between items-end px-1">
                        <div>
                            <h2 className="text-xl font-black font-headline uppercase tracking-tighter text-gray-950">Marketplace Hub</h2>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Verified Business Owners</p>
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

                <Card className="bg-gradient-to-br from-primary/10 to-blue-50 border-0 rounded-[2.5rem] shadow-xl overflow-hidden">
                    <CardHeader className="pb-2">
                        <div className="flex items-center gap-2 text-primary mb-1">
                            <Mic className="h-5 w-5" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Voice Concierge</span>
                        </div>
                        <CardTitle className="text-2xl font-black tracking-tight text-gray-950">Need assistance?</CardTitle>
                        <CardDescription className="font-bold text-gray-600">Just ask. I'll find the right service for you.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="p-4 bg-white/60 backdrop-blur-sm rounded-2xl border border-white/40 space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary text-xs">1</div>
                                <p className="text-xs font-bold text-gray-800">Tap the Mic</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center font-black text-primary text-xs">2</div>
                                <p className="text-xs font-bold text-gray-800 italic">"Book a haircut at Diva Salon"</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        )}
      </main>
    </div>
  );
}
