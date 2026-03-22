
'use client';

/**
 * HOMEPAGE SOURCE CODE DISPLAY
 * This file contains the text representation of the homepage for help documentation.
 */
export const homepageCodeText = [
    {
        path: 'src/app/page.tsx',
        content: `
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { User, Store as StoreType, Order } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Image from 'next/image';
import { useFirebase, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { Search, MapPin, ChevronDown, ArrowRight, LayoutGrid, Beef, Scissors, Loader2 } from 'lucide-react';
import Link from 'next/link';
import StoreCard from '@/components/store-card';
import { doc, collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { useAdminAuth } from '@/hooks/use-admin-auth';
import { RecipeCard } from '@/components/features/recipe-card';
import { CartIcon } from '@/components/cart/cart-icon';

// Main categories for the top scroller
const mainCategories = [
  { name: 'All', icon: LayoutGrid },
  { name: 'Restaurants', icon: Beef },
  { name: 'Salons', icon: Scissors },
];

/* ---------------- MAIN PAGE ---------------- */
export default function LocalBasketHomepage() {
  const { firestore, user } = useFirebase();
  const { isRestaurantOwner, isLoading: isRoleLoading } = useAdminAuth();
  const { loading: isAppLoading, isInitialized, stores, deviceId, fetchInitialData } = useAppStore();
  const [searchTerm, setSearchTerm] = useState('');
  
  const userDocRef = useMemoFirebase(() => (!firestore || !user) ? null : doc(firestore, 'users', user.uid), [firestore, user]);
  const { data: userData } = useDoc<User>(userDocRef);

  useEffect(() => { 
    if (firestore && !isInitialized) fetchInitialData(firestore, user?.uid); 
  }, [firestore, isInitialized, fetchInitialData, user?.uid]);

  const filteredStores = useMemo(() => 
    searchTerm ? stores.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase())) : stores, 
  [searchTerm, stores]);

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <HomepageHeader onSearchChange={setSearchTerm} user={userData} />
      <main className="p-4 space-y-8">
        <section className="space-y-4">
            <h2 className="text-xl font-black">Marketplace Hub</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {filteredStores.map(store => <StoreCard key={store.id} store={store} />)}
            </div>
        </section>
      </main>
    </div>
  );
}
`,
    },
];
