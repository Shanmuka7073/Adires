'use client';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Home, Mic, Package, ShoppingCart, Star, Store, Truck, User } from 'lucide-react';
import { useVoiceCommander } from '@/components/layout/main-layout';
import { useAppStore } from '@/lib/store';
import { useCart } from '@/lib/cart';
import ProductCard from '@/components/product-card';
import CategoryIcon from '@/components/features/CategoryIcon';
import groceryData from '@/lib/grocery-data.json';
import StoreCard from '@/components/store-card';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';


export default function LocalBasketVoiceHomepage() {
  const { cartItems } = useCart();
  const { stores, masterProducts, productPrices, loading } = useAppStore();
  const { triggerVoicePrompt, retryCommand } = useVoiceCommander();

  // We can derive "last orders" or "usuals" from a more robust source later
  const [lastOrders, setLastOrders] = useState(() => {
    try {
      const raw = localStorage.getItem("lb_last_orders");
      return raw ? JSON.parse(raw) : ["Tata Salt", "Aashirvaad Atta", "Heritage Milk"];
    } catch (e) {
      return ["Tata Salt", "Aashirvaad Atta", "Heritage Milk"];
    }
  });

  useEffect(() => {
    // save lastOrders to localStorage
    try {
      localStorage.setItem("lb_last_orders", JSON.stringify(lastOrders));
    } catch (e) {}
  }, [lastOrders]);

  const handleQuickSuggestion = (text: string) => {
    // Use the existing voice commander to process the text
    if (retryCommand) {
        retryCommand(text);
    }
  };
  
  const featuredProducts = useMemo(() => masterProducts.slice(0, 4), [masterProducts]);
  const featuredStores = useMemo(() => stores.slice(0, 4), [stores]);


  return (
    <div className="min-h-screen bg-green-50 text-gray-800 pb-20 md:pb-4">
      <header className="bg-white shadow p-3 flex items-center justify-between md:hidden">
        <div className="flex items-center gap-3">
          <div className="bg-green-100 rounded p-2">
            <ShoppingCart className="h-5 w-5 text-green-700"/>
          </div>
          <div>
            <h1 className="font-bold text-lg">LocalBasket</h1>
            <div className="text-xs text-gray-500">Your Personal Voice Shopper</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
           <Button variant="outline" size="icon" asChild>
                <Link href="/dashboard/customer/my-profile">
                    <User className="h-5 w-5" />
                </Link>
           </Button>
          <Button className="relative" asChild>
            <Link href="/cart">
                <ShoppingCart className="h-5 w-5"/>
                {cartItems.length > 0 && <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white">{cartItems.length}</span>}
            </Link>
          </Button>
        </div>
      </header>

      <main className="p-4">
        {/* Voice center */}
        <section className="bg-white rounded-xl p-4 shadow-lg flex flex-col items-center gap-4 text-center">
          <div className="mb-2">
            <div className="font-semibold text-gray-700">Say it. We add it.</div>
            <div className="text-xs text-gray-500">Examples: "Sunflower oil 1 litre", "Tata salt", "Chicken drumsticks 1 kg"</div>
          </div>

          <div className="relative my-4">
            <Button
              onClick={triggerVoicePrompt}
              className="w-28 h-28 rounded-full flex items-center justify-center shadow-lg transform transition bg-green-500 hover:bg-green-600 text-white"
              aria-label="Activate Voice Command"
            >
              <Mic size={48} />
            </Button>
          </div>

          <div className="w-full mt-4 flex gap-2 overflow-x-auto pb-2">
            {[ "Milk 1 litre", "Sugar 1 kg", "Eggs 6 pcs", "Chicken drumsticks" ].map((s) => (
              <Button key={s} onClick={() => handleQuickSuggestion(s)} variant="outline" size="sm" className="text-xs whitespace-nowrap">Try: {s}</Button>
            ))}
          </div>
        </section>

        {/* Categories */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold mb-2">Categories</h2>
           <div className="grid grid-cols-3 gap-3">
                {groceryData.categories.slice(0, 6).map((c) => (
                    <CategoryIcon key={c.categoryName} category={c} />
                ))}
            </div>
        </section>

        {/* Previously bought */}
        <section className="mt-6">
          <h2 className="text-sm font-semibold mb-2">Your Usuals</h2>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {lastOrders.map((p, i) => (
              <Card key={i} className="shadow-sm min-w-[140px] flex-shrink-0">
                  <CardContent className="p-3">
                    <div className="text-sm font-medium truncate">{p}</div>
                    <div className="text-xs text-gray-500">Tap to add</div>
                    <Button onClick={() => handleQuickSuggestion(p)} size="sm" className="w-full mt-2 bg-orange-500 hover:bg-orange-600 text-white">Add by Voice</Button>
                 </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Featured products */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Featured Products</h2>
            {stores[0] && <Link href={`/stores/${stores[0].id}`} className="text-xs text-green-600">View All</Link>}
          </div>

          <div className="grid grid-cols-2 gap-3">
             {loading ? (
                <>
                    <Skeleton className="h-64 w-full" />
                    <Skeleton className="h-64 w-full" />
                </>
             ) : featuredProducts.map((p) => (
                <ProductCard key={p.id} product={p} priceData={productPrices[p.name.toLowerCase()]} />
            ))}
          </div>
        </section>
        
         {/* Featured stores */}
        <section className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold">Featured Stores</h2>
            <Link href="/stores" className="text-xs text-green-600">View All</Link>
          </div>
            <div className="grid grid-cols-2 gap-3">
                 {loading ? (
                    <>
                        <Skeleton className="h-64 w-full" />
                        <Skeleton className="h-64 w-full" />
                    </>
                ) : featuredStores.map((store) => (
                    <StoreCard key={store.id} store={store} />
                ))}
            </div>
        </section>
      </main>

      {/* Bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t p-2 flex items-center justify-around px-4 z-50">
        <Link href="/" className="flex flex-col items-center text-xs text-green-600">
            <Home className="h-5 w-5"/> 
            <span>Home</span>
        </Link>
        <div className="-mt-8">
            <Button onClick={triggerVoicePrompt} className="w-16 h-16 rounded-full flex items-center justify-center shadow-lg bg-green-500 hover:bg-green-600 text-white">
                <Mic size={28} />
            </Button>
        </div>
        <Link href="/dashboard/customer/my-orders" className="flex flex-col items-center text-xs text-gray-600">
            <Package className="h-5 w-5" /> 
            <span>Orders</span>
        </Link>
      </nav>
    </div>
  );
}
