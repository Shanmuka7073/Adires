
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Product as ProductType, ProductPrice } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useFirebase } from '@/firebase';
import { Search, Menu as MenuIcon, ShoppingCart, User as UserIcon, Mic, Package2, MicOff, Globe, Box, LogOut, LayoutDashboard, Store as StoreIcon, Truck } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { t } from '@/lib/locales';
import { useCart } from '@/lib/cart';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { getAuth, signOut } from 'firebase/auth';
import { CartIcon } from '@/components/cart/cart-icon';
import { useVoiceCommanderContext } from '@/components/layout/main-layout';
import ProductCard from '@/components/product-card';

const ADMIN_EMAIL = 'admin@gmail.com';


function LanguageSwitcher() {
    const { language, setLanguage } = useAppStore();

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="rounded-xl shadow-sm bg-white">
                    <Globe className="h-5 w-5" />
                    <span className="sr-only">Change language</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
                <DropdownMenuLabel>Select Language</DropdownMenuLabel>
                <DropdownMenuRadioGroup value={language} onValueChange={setLanguage}>
                    <DropdownMenuRadioItem value="en">
                        English
                    </DropdownMenuRadioItem>
                    <DropdownMenuRadioItem value="te">
                        Telugu
                    </DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

function UserMenu() {
  const { user, isUserLoading } = useFirebase();
  const isAdmin = user && user.email === ADMIN_EMAIL;
  const dashboardHref = isAdmin ? '/dashboard/admin' : '/dashboard';

  const handleLogout = async () => {
    const auth = getAuth();
    await signOut(auth);
  };

  if (isUserLoading) {
    return <Skeleton className="h-10 w-10 rounded-full" />;
  }

  if (!user) {
    return (
      <Button asChild variant="outline" className="rounded-xl shadow-sm bg-white">
        <Link href="/login">{t('login')}</Link>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" className="rounded-full bg-white shadow-sm">
          <UserIcon className="h-5 w-5" />
          <span className="sr-only">Toggle user menu</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>{t('my-account')}</DropdownMenuLabel>
        <DropdownMenuItem disabled>{user.email}</DropdownMenuItem>
        <DropdownMenuSeparator />
        <Link href={dashboardHref} passHref>
          <DropdownMenuItem>
              <LayoutDashboard className="mr-2 h-4 w-4" />
              <span>{t('dashboard')}</span>
          </DropdownMenuItem>
        </Link>
        <DropdownMenuSeparator />
         <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
            <LogOut className="mr-2 h-4 w-4" />
            <span>{t('logout')}</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}


/* ---------------- HEADER ---------------- */
function Header() {
  const { voiceEnabled, onToggleVoice, isCartOpen, onCartOpenChange } = useVoiceCommanderContext();
    
  return (
    <div className="bg-white/50 backdrop-blur-md sticky top-0 z-30 border-b border-green-50 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        
        {/* Left icons */}
        <div className="flex items-center gap-3">
          <button className="p-2 bg-white rounded-xl shadow-sm">
            <MenuIcon className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Center search bar - desktop */}
        <div className="hidden md:flex items-center bg-white rounded-xl px-3 py-2 shadow-sm w-80">
          <Search className="w-4 h-4 text-green-600 mr-2" />
          <input 
            placeholder="Search products"
            className="w-full outline-none text-sm bg-transparent"
          />
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <Button variant={voiceEnabled ? 'secondary' : 'outline'} size="icon" onClick={onToggleVoice} className="relative rounded-xl shadow-sm bg-white">
                {voiceEnabled ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5 text-green-600" />}
                {voiceEnabled && <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
                <span className="sr-only">{voiceEnabled ? 'Stop voice commands' : 'Start voice commands'}</span>
            </Button>
            <CartIcon open={isCartOpen} onOpenChange={onCartOpenChange} />
            <UserMenu />
        </div>

      </div>
    </div>
  );
}


/* ---------------- SIDEBAR ---------------- */
function CategorySidebar({
  categories,
  activeCategory,
  onSelectCategory,
  isLoading
}: {
  categories: { id: string; name: string; icon?: string }[];
  activeCategory: string;
  onSelectCategory: (name: string) => void;
  isLoading: boolean;
}) {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!sidebarRef.current || !activeRef.current) return;
    const sidebar = sidebarRef.current;
    const item = activeRef.current;
    sidebar.scrollTo({
      top: item.offsetTop - sidebar.clientHeight / 2 + item.clientHeight / 2,
      behavior: 'smooth'
    });
  }, [activeCategory]);

  return (
    <aside
      ref={sidebarRef}
      className="w-[100px] bg-white/70 backdrop-blur-sm rounded-3xl shadow-sm p-3 h-[calc(100vh-7rem)] overflow-y-auto no-scrollbar"
    >
      <div className="flex flex-col gap-3">

        {isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="p-3 rounded-xl bg-white shadow-sm flex gap-3">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="w-16 h-4" />
              </div>
            ))
          : categories.map(cat => {
              const active = cat.name === activeCategory;
              return (
                <button
                  key={cat.id}
                  ref={active ? activeRef : null}
                  onClick={() => onSelectCategory(cat.name)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-2xl w-full transition-all duration-200 text-left",
                    active
                      ? "bg-green-500 text-white shadow-lg transform scale-[1.02]"
                      : "bg-white border border-gray-200 hover:bg-green-50"
                  )}
                >
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center overflow-hidden', active ? 'bg-white/20' : 'bg-white')}>
                    {cat.icon ? (
                      <Image src={cat.icon} alt={cat.name} width={48} height={48} className="object-cover w-full h-full" />
                    ) : (
                      <Skeleton className="w-full h-full rounded-full" />
                    )}
                  </div>
                  <span className="text-sm font-medium">{cat.name}</span>
                </button>
              );
            })}

      </div>
    </aside>
  );
}

/* ---------------- MAIN PAGE ---------------- */
export default function LocalBasketHomepage() {
  const { masterProducts, productPrices, loading: isAppLoading, fetchProductPrices, fetchInitialData } = useAppStore();
  const { firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeCategory, setActiveCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryIcons, setCategoryIcons] = useState<{ id: string; name: string; icon?: string }[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState(true);

  // Load initial data on mount
  useEffect(() => {
    if (firestore && !useAppStore.getState().isInitialized) {
      fetchInitialData(firestore);
    }
  }, [firestore, fetchInitialData]);

  // Build categories from masterProducts
  const categories = useMemo(() => {
    if (!masterProducts) return [];
    return [...new Set(masterProducts.map(p => p.category).filter(Boolean))].map(name => ({
      id: name,
      name,
      icon: ''
    }));
  }, [masterProducts]);

  // Default active category from URL
  useEffect(() => {
    const urlCat = searchParams.get('category');
    if (categories.length > 0) {
      setActiveCategory(urlCat && categories.some(c => c.name === urlCat) ? urlCat : categories[0].name);
    }
  }, [categories, searchParams]);

  // Fetch category icons once categories available
  useEffect(() => {
    let mounted = true;
    const fetchIcons = async () => {
      if (categories.length === 0) return setSidebarLoading(false);
      try {
        setSidebarLoading(true);
        const promises = categories.map(async cat => {
          // Build image id the same as earlier; fallback if not present
          const imageId = `cat-${cat.name.toLowerCase().replace(/ /g, '-')}`;
          try {
            const { imageUrl } = await getProductImage(imageId);
            return { ...cat, icon: imageUrl };
          } catch {
            return { ...cat, icon: '' };
          }
        });
        const icons = await Promise.all(promises);
        if (!mounted) return;
        setCategoryIcons(categories.map((cat, i) => ({ ...cat, icon: icons[i]?.imageUrl || '' })));
      } catch (err) {
        setCategoryIcons(categories.map(cat => ({ ...cat, icon: '' })));
      } finally {
        setSidebarLoading(false);
      }
    };
    fetchIcons();
    return () => {
      mounted = false;
    };
  }, [categories]);

  // Filtered products based on search / category
  const filteredProducts = useMemo(() => {
    if (!masterProducts) return [];
    if (searchTerm) {
      return masterProducts.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    if (activeCategory) {
      return masterProducts.filter(p => p.category === activeCategory);
    }
    return masterProducts.slice(0, 18);
  }, [masterProducts, activeCategory, searchTerm]);

  // Fetch prices for visible products
  useEffect(() => {
    if (!firestore || filteredProducts.length === 0) return;
    const names = filteredProducts.map(p => p.name);
    fetchProductPrices(firestore, names);
  }, [firestore, filteredProducts, fetchProductPrices]);

  const title = t(activeCategory.toLowerCase(), 'en') || 'Featured Products';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3fff3] to-[#e8f8ea]">

      <Header />

      <div className="max-w-6xl mx-auto px-4 flex gap-4 mt-4">

        {/* Sidebar */}
        <CategorySidebar
          categories={categoryIcons.length ? categoryIcons : categories}
          activeCategory={activeCategory}
          onSelectCategory={setActiveCategory}
          isLoading={sidebarLoading}
        />

        {/* Main Content */}
        <div className="flex-1">

          {/* Title */}
          <div className="mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-600">{filteredProducts.length} products</p>
          </div>

          {/* Search - mobile */}
          <div className="md:hidden mb-4">
            <div className="flex items-center bg-white rounded-xl px-3 py-2 shadow-sm">
              <Search className="w-4 h-4 text-green-600 mr-2" />
              <input
                aria-label="Search products"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="w-full text-sm outline-none bg-transparent"
              />
            </div>
          </div>

          {/* Product Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {isAppLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-56 w-full rounded-2xl" />
                ))
              : filteredProducts.map(p => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    priceData={productPrices[p.name.toLowerCase()]}
                  />
                ))}
          </div>

        </div>
      </div>
    </div>
  );
}
