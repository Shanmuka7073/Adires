
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where } from 'firebase/firestore';
import type {
  Store,
  Menu,
  MenuItem,
  GetIngredientsOutput,
  Product,
  ProductVariant,
  Ingredient,
} from '@/lib/types';
import { useParams, useSearchParams } from 'next/navigation';
import {
  Utensils,
  Zap,
  Flame,
  Info,
  Plus,
  Minus,
  ShoppingCart,
  Salad,
  Mic,
  Eye,
  Soup,
  Fish,
  Wheat,
  DrumstickIcon,
  Star,
  Clock,
  MapPin,
  Check,
} from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useCart } from '@/lib/cart';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { getStoreImage } from '@/lib/data';
import { motion } from "framer-motion";
import { Label } from '@/components/ui/label';

function MenuItemDialog({
  item,
  storeId,
  isOpen,
  onClose,
  tableNumber,
}: {
  item: MenuItem;
  storeId: string;
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string | null;
}) {
  const { addItem } = useCart();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [details, setDetails] = useState<GetIngredientsOutput | null>(null);

  useEffect(() => {
    if (isOpen && !details) {
      setIsGenerating(true);
      getIngredientsForDish({ dishName: item.name, language: 'en' })
        .then(setDetails)
        .catch((e) => {
          console.error("Failed to get dish details:", e);
          toast({
            variant: 'destructive',
            title: 'Details Unavailable',
            description: "We couldn’t load ingredient details right now, but you can still order the item.",
          });
        })
        .finally(() => setIsGenerating(false));
    }
  }, [isOpen, details, item.name, toast]);

  const handleAddToCart = () => {
    const product: Product = {
      id: `${storeId}-${item.name}`,
      name: item.name,
      description: '',
      storeId,
      category: item.category,
      imageId: 'cat-restaurant',
      isMenuItem: true,
      price: item.price,
    };

    const variant: ProductVariant = {
      sku: `${storeId}-${item.name}-default`,
      weight: '1 pc',
      price: item.price,
      stock: 99,
    };

    addItem(product, variant, quantity, tableNumber || undefined);
    toast({ title: 'Added to Cart', description: `${quantity} × ${item.name}` });
    onClose();
  };

  const formatQty = (ing: Ingredient) =>
    ing.baseQuantity && ing.unit
      ? `${(ing.baseQuantity * quantity).toFixed(0)}${ing.unit}`
      : ing.quantity;

  const nutrition = useMemo(() => {
    if (!details?.nutrition) return { calories: 0, protein: 0 };
    return {
      calories: Math.round(details.nutrition.calories * quantity),
      protein: Math.round(details.nutrition.protein * quantity),
    };
  }, [details, quantity]);
  
  const hasShellfish = item.name.toLowerCase().includes('prawn');

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0">
        <div className="relative h-48 w-full">
          <Image
            src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&q=80&seed=${encodeURIComponent(item.name)}`}
            alt={item.name}
            fill
            className="object-cover rounded-t-lg"
          />
        </div>

        <div className="p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{item.name}</DialogTitle>
            <DialogDescription>Details for the selected menu item. You can adjust the quantity before adding to your cart.</DialogDescription>
          </DialogHeader>

          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <Button size="icon" variant="outline" onClick={() => setQuantity(q => Math.max(1, q - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input type="number" value={quantity} onChange={(e) => setQuantity(parseInt(e.target.value) || 1)} className="w-16 h-10 text-center font-bold text-lg" />
              <Button size="icon" variant="outline" onClick={() => setQuantity(q => q + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-3xl font-extrabold text-primary">₹{(item.price * quantity).toFixed(2)}</p>
          </div>

          {isGenerating ? (
            <div className="space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-10 w-full" />
            </div>
          ) : details?.isSuccess ? (
            <div className="space-y-4">
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1 font-semibold">
                  <Flame className="h-4 w-4 text-orange-500" /> {nutrition.calories} kcal
                </span>
                <span className="flex items-center gap-1 font-semibold">
                  <Zap className="h-4 w-4 text-yellow-500" /> {nutrition.protein}g Protein
                </span>
              </div>

              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <Salad className="h-5 w-5 text-green-600" />
                  Main Ingredients (per serving)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {details.ingredients.slice(0, 5).map(ing => (
                    <Badge key={ing.name} variant="secondary">
                      {ing.name} ({formatQty(ing)})
                    </Badge>
                  ))}
                  {hasShellfish && <Badge variant="destructive" className="bg-red-100 text-red-800">🦐 Contains Shellfish</Badge>}
                </div>
                <p className="text-xs text-muted-foreground mt-2" aria-label="Ingredients and nutrition values are approximate per serving.">
                  Ingredients & nutrition values are approximate per serving.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground flex gap-2 items-center">
              <Info className="h-4 w-4" /> Details unavailable. You can still order.
            </p>
          )}

          <Button onClick={handleAddToCart} className="w-full h-12 text-lg font-bold">
            <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
          </Button>

          <div className="flex items-center justify-center gap-4">
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
              <Link href={`/live-order/${storeId}`}>
                <Eye className="mr-2 h-4 w-4" /> See preparation
              </Link>
            </Button>
          </div>

          <p className="text-xs text-center text-muted-foreground italic flex justify-center gap-2">
            <Mic className="h-4 w-4" /> Say “add {item.name.toLowerCase()}” to order
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuickLinks({ categories, onLinkClick, activeFilter }: { categories: string[], onLinkClick: (category: string) => void, activeFilter: string | null }) {
    const scrollRef = useRef<HTMLDivElement>(null);

    return (
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-2">
             <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-3 px-4" ref={scrollRef}>
                    {categories.map(category => {
                        const Icon = Utensils; // Fallback Icon
                        const isActive = activeFilter === category;
                        return (
                             <Button 
                                key={category} 
                                variant={isActive ? "default" : "outline"} 
                                className={cn("rounded-full shadow-sm", isActive ? "ring-2 ring-primary ring-offset-2" : "bg-card")}
                                onClick={() => onLinkClick(category)}
                            >
                                <Icon className="mr-2 h-4 w-4" />
                                {category}
                            </Button>
                        )
                    })}
                </div>
                <ScrollBar orientation="horizontal" />
            </ScrollArea>
        </div>
    );
}

function MenuHeader({ store, tableNumber }: { store: Store, tableNumber: string | null }) {
    const [image, setImage] = useState({ imageUrl: '', imageHint: 'loading' });
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchImg = async () => {
            setIsLoading(true);
            const img = await getStoreImage(store);
            setImage(img);
            setIsLoading(false);
        };
        fetchImg();
    }, [store]);
    
    const rating = useMemo(() => (4 + Math.random()).toFixed(1), [store.id]);
    const deliveryTime = useMemo(() => Math.floor(Math.random() * 20) + 15, [store.id]);

    return (
        <div className="relative h-40 w-full">
            {isLoading ? <Skeleton className="w-full h-full" /> : (
                 <Image src={image.imageUrl} alt={store.name} layout="fill" className="object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
            <div className="absolute bottom-0 left-0 p-4 text-white">
                <h1 className="text-3xl font-bold">{store.name}</h1>
                <p className="text-sm text-gray-200">Order directly • No waiting</p>
                <div className="flex items-center text-xs mt-2 gap-4">
                    <div className="flex items-center gap-1">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="font-bold">{rating}</span>
                    </div>
                     <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        <span>{deliveryTime}-{deliveryTime+5} mins</span>
                    </div>
                     <div className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="truncate">{store.address}</span>
                    </div>
                </div>
                 {tableNumber && (
                    <Badge className="mt-2 text-base">Table: {tableNumber}</Badge>
                )}
            </div>
        </div>
    )
}

const MenuItemSkeleton = () => (
    <div className="bg-card text-card-foreground p-3 rounded-xl shadow-sm flex gap-3 items-center">
        <Skeleton className="h-16 w-16 bg-muted rounded-lg" />
        <div className="flex-1 text-left space-y-2">
            <Skeleton className="h-5 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
        </div>
        <Skeleton className="h-6 w-12" />
    </div>
);


export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const searchParams = useSearchParams();
  const tableNumber = searchParams.get('table');

  const { firestore } = useFirebase();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);


  const storeQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'stores'), where('__name__', '==', storeId)) : null,
  [firestore, storeId]);

  const menuQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null,
  [firestore, storeId]);

  const { data: stores, isLoading: storeLoading } = useCollection<Store>(storeQuery);
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);

  const store = stores?.[0];
  const menu = menus?.[0];

  const menuByCategory = useMemo(() => {
    if (!menu?.items) return {};
    return menu.items.reduce((acc, item) => {
      const cat = item.category || 'Others';
      if (!acc[cat]) {
        acc[cat] = [];
      }
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menu]);
  
  const quickLinkKeywords = useMemo(() => {
    if (!menu?.items) return [];
    const keywords = new Set<string>();
    const commonTerms = ['Biryani', 'Naan', 'Seafood', 'Curry', 'Starter', 'Tandoori', 'Fish', 'Rice', 'Bread', 'Soup', 'Kebab', 'Pizza'];

    Object.keys(menuByCategory).forEach(cat => keywords.add(cat));
    menu.items.forEach(item => {
        commonTerms.forEach(term => {
            if (item.name.toLowerCase().includes(term.toLowerCase())) {
                keywords.add(term);
            }
        });
    });

    return Array.from(keywords);
  }, [menu, menuByCategory]);

  const handleFilterClick = (filter: string) => {
    if (activeFilter === filter) {
        setActiveFilter(null);
    } else {
        setActiveFilter(filter);
    }
  };

  const filteredItems = useMemo(() => {
    if (!menu?.items) return [];
    if (!activeFilter) return null; 

    return menu.items.filter(item => 
        item.name.toLowerCase().includes(activeFilter.toLowerCase()) ||
        item.category.toLowerCase().includes(activeFilter.toLowerCase())
    );
  }, [menu?.items, activeFilter]);

  const isLoading = storeLoading || menuLoading;

  if (isLoading) {
    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            <Skeleton className="h-40 w-full" />
            <div className="p-4"><Skeleton className="h-10 w-full" /></div>
            <div className="max-w-3xl mx-auto space-y-8 px-4 py-6">
                <div className="space-y-4">
                    <Skeleton className="h-6 w-1/4" />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <MenuItemSkeleton />
                        <MenuItemSkeleton />
                        <MenuItemSkeleton />
                        <MenuItemSkeleton />
                    </div>
                </div>
            </div>
        </div>
    );
  }

  if (!store || !menu) return <div className="p-8 text-center">Menu not available</div>;

  return (
    <>
      {selectedItem && (
        <MenuItemDialog
          item={selectedItem}
          storeId={storeId}
          isOpen
          onClose={() => setSelectedItem(null)}
          tableNumber={tableNumber}
        />
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <MenuHeader store={store} tableNumber={tableNumber} />
          <QuickLinks categories={quickLinkKeywords} onLinkClick={handleFilterClick} activeFilter={activeFilter} />

          <div className="max-w-3xl mx-auto space-y-8 px-4 py-6">
             {filteredItems ? (
                <section>
                     <h2 className="flex items-center gap-2 text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
                        Results for "{activeFilter}"
                    </h2>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {filteredItems.length > 0 ? filteredItems.map(item => (
                            <motion.button
                                key={item.name}
                                onClick={() => setSelectedItem(item)}
                                className="bg-card text-card-foreground p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 flex gap-3 items-center"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="h-16 w-16 bg-muted rounded-lg relative overflow-hidden">
                                <Image
                                    src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&h=150&fit=crop&q=80&seed=${encodeURIComponent(item.name)}`}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                />
                                </div>
            
                                <div className="flex-1 text-left">
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-sm text-muted-foreground">Tap for details</p>
                                </div>
            
                                <p className="font-extrabold text-lg text-primary">₹{item.price.toFixed(2)}</p>
                            </motion.button>
                        )) : (
                            <p className="text-muted-foreground col-span-full text-center py-8">No items found for "{activeFilter}".</p>
                        )}
                    </div>
                </section>
             ) : (
                Object.entries(menuByCategory).map(([category, items]) => (
                    <section key={category}>
                        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
                            <Utensils className="h-4 w-4 text-muted-foreground" />
                            {category}
                        </h2>
        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {items.map(item => (
                            <motion.button
                                key={item.name}
                                onClick={() => setSelectedItem(item)}
                                className="bg-card text-card-foreground p-3 rounded-xl shadow-sm hover:shadow-md transition-shadow duration-200 flex gap-3 items-center"
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                            >
                                <div className="h-16 w-16 bg-muted rounded-lg relative overflow-hidden">
                                <Image
                                    src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&h=150&fit=crop&q=80&seed=${encodeURIComponent(item.name)}`}
                                    alt={item.name}
                                    fill
                                    className="object-cover"
                                />
                                </div>
            
                                <div className="flex-1 text-left">
                                <p className="font-semibold">{item.name}</p>
                                <p className="text-sm text-muted-foreground">Tap for details</p>
                                </div>
            
                                <p className="font-extrabold text-lg text-primary">₹{item.price.toFixed(2)}</p>
                            </motion.button>
                            ))}
                        </div>
                    </section>
                ))
             )}
          </div>
           <div className="text-center py-8 px-4 text-sm text-muted-foreground">
                <p>✓ Ingredients shown • No hidden charges • Order goes directly to kitchen</p>
           </div>
      </div>
    </>
  );
}

    
