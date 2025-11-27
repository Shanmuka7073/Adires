
'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAppStore } from '@/lib/store';
import { Product as ProductType } from '@/lib/types';
import { Skeleton } from '@/components/ui/skeleton';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { getProductImage } from '@/lib/data';
import { useFirebase } from '@/firebase';
import { Search, Menu as MenuIcon, ShoppingCart, User as UserIcon, Mic, Plus, Minus, Heart, Package2, LogOut, LayoutDashboard } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/locales';
import { useCart } from '@/lib/cart';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Sheet, SheetContent, SheetTrigger, SheetClose, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useVoiceCommanderContext } from '@/components/layout/main-layout';
import { getAuth, signOut } from 'firebase/auth';

const ADMIN_EMAIL = 'admin@gmail.com';

/* ---------------- USER MENU ---------------- */
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
function Header({ isMobileMenuOpen, setIsMobileMenuOpen, searchTerm, setSearchTerm }: { isMobileMenuOpen: boolean, setIsMobileMenuOpen: (open: boolean) => void, searchTerm: string, setSearchTerm: (term: string) => void}) {
  const { voiceEnabled, onToggleVoice, isCartOpen, onCartOpenChange } = useVoiceCommanderContext();
  const navLinks = [
    { href: '/', label: 'home' },
    { href: '/stores', label: 'stores' },
    { href: '/dashboard', label: 'dashboard' },
  ];
  
  return (
    <div className="bg-white/50 backdrop-blur-md sticky top-0 z-30 border-b border-green-50 shadow-sm">
      <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
        
        {/* Left icons & Mobile Menu */}
        <div className="flex items-center gap-3">
            <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <SheetTrigger asChild>
                <button className="p-2 bg-white rounded-xl shadow-sm md:hidden">
                    <MenuIcon className="w-5 h-5 text-gray-700" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[280px]">
                 <SheetHeader>
                    <SheetTitle>
                        <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
                            <Package2 className="h-6 w-6 text-primary" />
                            <span className="font-headline">LocalBasket</span>
                        </Link>
                    </SheetTitle>
                 </SheetHeader>
                 <nav className="grid gap-2 text-lg font-medium mt-8">
                     {navLinks.map(({ href, label }) => (
                       <SheetClose asChild key={href}>
                           <Link
                             href={href}
                             className={cn('flex items-center gap-3 rounded-lg px-3 py-2 text-muted-foreground transition-all hover:text-primary')}
                           >
                             {t(label)}
                           </Link>
                       </SheetClose>
                     ))}
                 </nav>
              </SheetContent>
            </Sheet>

            <Link href="/" className="hidden md:flex items-center gap-2">
                <Package2 className="w-6 h-6 text-primary" />
                <span className="font-bold text-xl">LocalBasket</span>
            </Link>
        </div>

        {/* Center search bar - desktop */}
        <div className="hidden md:flex items-center bg-white rounded-xl px-3 py-2 shadow-sm w-80">
          <Search className="w-4 h-4 text-green-600 mr-2" />
          <input 
            placeholder="Search products"
            className="w-full outline-none text-sm bg-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Right icons */}
        <div className="flex items-center gap-3">
            <Button variant={voiceEnabled ? 'secondary' : 'outline'} size="icon" onClick={onToggleVoice} className="relative rounded-xl shadow-sm bg-white">
                {voiceEnabled ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5 text-green-600" />}
                {voiceEnabled && <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>}
                <span className="sr-only">{voiceEnabled ? 'Stop voice commands' : 'Start voice commands'}</span>
            </Button>
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
  const sidebarRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!sidebarRef.current || !activeRef.current) return;
    const sidebar = sidebarRef.current;
    const el = activeRef.current;
    const offsetTop = el.offsetTop - sidebar.clientHeight / 2 + el.clientHeight / 2;
    sidebar.scrollTo({ top: Math.max(0, offsetTop), behavior: 'smooth' });
  }, [activeCategory]);

  return (
    <aside
      ref={sidebarRef}
      className="hidden md:block w-[96px] bg-white/60 backdrop-blur-sm shadow-sm rounded-3xl p-3 h-[calc(100vh-8rem)] overflow-y-auto no-scrollbar"
      aria-label="Categories"
    >
      <div className="flex flex-col gap-3">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-col items-center w-full p-2 rounded-xl">
                <Skeleton className="w-12 h-12 rounded-full" />
                <Skeleton className="h-3 w-10 mt-1" />
            </div>
          ))
        ) : (
          categories.map((cat) => {
            const active = cat.name === activeCategory;
            return (
              <button
                key={cat.id}
                ref={active ? activeRef : undefined}
                onClick={() => onSelectCategory(cat.name)}
                className={cn(
                  'flex flex-col items-center w-full p-2 gap-1 rounded-2xl cursor-pointer group transition-all duration-300',
                  active
                    ? 'bg-green-500 text-white shadow-lg scale-[1.05]'
                    : 'bg-white hover:shadow-md hover:bg-green-50'
                )}
                aria-pressed={active}
                title={cat.name}
              >
                <div className={cn('w-12 h-12 rounded-full flex items-center justify-center overflow-hidden', active ? 'bg-white/20' : 'bg-white')}>
                  {cat.icon ? (
                    <Image src={cat.icon} alt={cat.name} width={40} height={40} className="object-cover w-10 h-10 rounded-full" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-100" />
                  )}
                </div>
                <span className="text-[11px] font-medium text-center truncate w-full">{cat.name}</span>
              </button>
            );
          })
        )}
      </div>
      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </aside>
  );
}

/* ---------------- PRODUCT CARD ---------------- */
function ProductCard({
  product,
  priceData,
}: {
  product: ProductType;
  priceData?: { variants?: { price: number; weight: string; sku: string }[] };
}) {
  const { cartItems, addItem, updateQuantity } = useCart();
  const priceInfo = priceData?.variants?.[0] ?? null;
  const [isFavorite, setIsFavorite] = useState(false);

  const itemInCart = cartItems.find(item => item.variant.sku === priceInfo?.sku);

  const handleAddToCart = () => {
    if (priceInfo) {
      addItem(product, priceInfo, 1);
    }
  };
  
  const handleIncrease = () => {
    if (itemInCart) {
      updateQuantity(itemInCart.variant.sku, itemInCart.quantity + 1);
    }
  };

  const handleDecrease = () => {
    if (itemInCart) {
      updateQuantity(itemInCart.variant.sku, itemInCart.quantity - 1);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm p-3 transition-all hover:shadow-md flex flex-col">
      <div className="w-full h-36 bg-gray-50 rounded-xl overflow-hidden flex items-center justify-center relative group">
        {product.imageUrl ? (
          <Image src={product.imageUrl} alt={product.name} width={320} height={320} className="object-cover w-full h-full" />
        ) : (
          <div className="w-24 h-24 rounded-md bg-gray-100" />
        )}
        <Button 
            size="icon" 
            variant="ghost" 
            className="absolute top-1 right-1 h-6 w-6 rounded-full bg-white/50 backdrop-blur-sm hover:bg-white"
            onClick={() => setIsFavorite(!isFavorite)}
        >
            <Heart className={cn("h-3 w-3 text-gray-500", isFavorite && "fill-red-500 text-red-500")} />
            <span className="sr-only">Favorite</span>
        </Button>
      </div>

      <div className="mt-3 flex-1 flex flex-col">
        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2">{product.name}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{priceInfo?.weight || ''}</p>

        <div className="mt-auto pt-2 flex items-center justify-between">
            {priceInfo !== null ? (
              <div className="text-green-600 font-bold text-sm">₹{priceInfo.price.toFixed(2)}</div>
            ) : (
              <div className="text-gray-400 text-sm">—</div>
            )}
             {itemInCart ? (
                <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={handleDecrease}>
                        <Minus className="h-4 w-4" />
                    </Button>
                    <span className="w-8 text-center font-bold">{itemInCart.quantity}</span>
                    <Button size="icon" variant="outline" className="h-8 w-8 rounded-full" onClick={handleIncrease}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
            ) : (
                 <Button
                    size="icon"
                    className="h-8 w-8 rounded-full bg-green-100 text-green-700 hover:bg-green-200 shadow-none font-bold"
                    type="button"
                    aria-label={`Add ${product.name} to cart`}
                    onClick={handleAddToCart}
                >
                    <Plus className="h-4 w-4" />
                </Button>
            )}
        </div>
      </div>
    </div>
  );
}


/* ---------------- MAIN PAGE ---------------- */
export default function LocalBasketHomepage() {
  const { masterProducts, productPrices, loading: isAppLoading, fetchProductPrices, fetchInitialData } = useAppStore();
  const { firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryIcons, setCategoryIcons] = useState<{ id: string; name: string; icon?: string }[]>([]);
  const [sidebarLoading, setSidebarLoading] = useState<boolean>(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);


  // Load initial data on mount
  useEffect(() => {
    if (firestore && !useAppStore.getState().isInitialized) {
      fetchInitialData(firestore);
    }
  }, [firestore, fetchInitialData]);

  // Build categories from masterProducts
  const categories = useMemo(() => {
    if (!masterProducts) return [];
    return [...new Set(masterProducts.map((p) => p.category).filter(Boolean))].map((name) => ({
      id: name,
      name,
      icon: ''
    }));
  }, [masterProducts]);

  // Default active category from URL or fallback
  useEffect(() => {
    const categoryFromUrl = searchParams.get('category');
    if (categories.length > 0) {
      if (categoryFromUrl && categories.some((c) => c.name === categoryFromUrl)) {
        setActiveCategory(categoryFromUrl);
      } else if (!activeCategory) {
        setActiveCategory(categories[0].name);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categories, searchParams]);

  // Fetch category icons once categories available
  useEffect(() => {
    let mounted = true;
    const fetchIcons = async () => {
      if (categories.length === 0) return setSidebarLoading(false);
      try {
        setSidebarLoading(true);
        const promises = categories.map((cat) => {
          const imageId = `cat-${cat.name.toLowerCase().replace(/ & /g, '-&-').replace(/ /g, '-')}`;
          return getProductImage(imageId).catch(() => ({ imageUrl: '' }));
        });
        const icons = await Promise.all(promises);
        if (!mounted) return;
        setCategoryIcons(categories.map((cat, i) => ({ ...cat, icon: icons[i]?.imageUrl || '' })));
      } catch (err) {
        setCategoryIcons(categories.map((cat) => ({ ...cat, icon: '' })));
      } finally {
        if(mounted) setSidebarLoading(false);
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
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      return masterProducts.filter((p) => p.name.toLowerCase().includes(term));
    }
    if (activeCategory) {
      return masterProducts.filter((p) => p.category === activeCategory);
    }
    return masterProducts.slice(0, 18);
  }, [masterProducts, activeCategory, searchTerm]);

  // Fetch prices for visible products
  useEffect(() => {
    if (!firestore || filteredProducts.length === 0) return;
    const names = filteredProducts.map((p) => p.name);
    fetchProductPrices(firestore, names);
  }, [firestore, filteredProducts, fetchProductPrices]);

  // Handler when clicking category
  const handleSelectCategory = (categoryName: string) => {
    setActiveCategory(categoryName);
    setSearchTerm('');
    const { stores } = useAppStore.getState();
    const firstStoreId = stores.find((s) => s.name === 'LocalBasket')?.id;
    const path = firstStoreId ? `/stores/${firstStoreId}` : '/';
    router.push(`${path}?category=${encodeURIComponent(categoryName)}`);
  };

  const gridCols = 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4';
  const title = t(activeCategory?.toLowerCase(), 'en') || 'Featured Products';

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3fff3] to-[#e8f8ea]">
      
      <Header isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} searchTerm={searchTerm} setSearchTerm={setSearchTerm} />

      {/* Overlay for mobile menu */}
       {isMobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Main Layout */}
      <div className="max-w-6xl mx-auto px-3 md:px-6 py-6 flex gap-4">
        {/* Sidebar */}
        <CategorySidebar
          categories={categoryIcons.length ? categoryIcons : categories}
          activeCategory={activeCategory}
          onSelectCategory={handleSelectCategory}
          isLoading={sidebarLoading || isAppLoading}
        />

        {/* Main area */}
        <main className="flex-1" onClick={() => isMobileMenuOpen && setIsMobileMenuOpen(false)}>
          {/* Title section (visible on desktop) */}
          <div className="hidden md:block mb-4">
            <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-600">{filteredProducts.length} products</p>
          </div>
          
          {/* Mobile search */}
          <div className="md:hidden mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                aria-label="Search products"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search products..."
                className="w-full pl-9 pr-3 py-2 bg-white rounded-lg border border-gray-200 shadow-sm"
              />
            </div>
          </div>

          {/* Products */}
          <section>
            {isAppLoading ? (
              <div className={`grid gap-4 ${gridCols}`}>
                {Array.from({ length: 8 }).map((_, idx) => (
                  <Skeleton key={idx} className="h-56 w-full rounded-2xl" />
                ))}
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No products found.</div>
            ) : (
              <div className={`grid gap-4 ${gridCols}`}>
                {filteredProducts.map((p: ProductType) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    priceData={productPrices?.[p.name.toLowerCase()]}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

