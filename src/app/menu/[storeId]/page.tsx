
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
import { useParams } from 'next/navigation';
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
} from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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

/* =========================
   MENU ITEM DIALOG (UNCHANGED)
========================= */
function MenuItemDialog({
  item,
  storeId,
  isOpen,
  onClose,
}: {
  item: MenuItem;
  storeId: string;
  isOpen: boolean;
  onClose: () => void;
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
        .then((dishDetails) => {
          setDetails(dishDetails);
        })
        .catch((e) => {
          console.error('Failed to get dish details:', e);
          toast({
            variant: 'destructive',
            title: 'Could not fetch details',
            description: 'The AI is currently unavailable. Please try again later.',
          });
        })
        .finally(() => {
          setIsGenerating(false);
        });
    }
  }, [isOpen, item.name, details, toast]);

  const handleAddToCart = () => {
    if (quantity < 1) return;

    const product: Product = {
      id: `${storeId}-${item.name}`,
      name: item.name,
      description: item.description || '',
      storeId: storeId,
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

    addItem(product, variant, quantity);
    toast({
      title: 'Added to Cart!',
      description: `${quantity} x ${item.name} has been added.`,
    });
    onClose();
  };

  // Helper function to format the scaled quantity
  const formatScaledQuantity = (ingredient: Ingredient) => {
    if (ingredient.baseQuantity && ingredient.unit) {
      const scaledQuantity = ingredient.baseQuantity * quantity;
      const unit =
        ingredient.unit === 'pc' && scaledQuantity > 1
          ? 'pcs'
          : ingredient.unit;
      return `${scaledQuantity.toFixed(0)}${unit}`;
    }
    return ingredient.quantity; // Fallback to the original string
  };

  const scaledNutrition = useMemo(() => {
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
            src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&q=80&seed=${encodeURIComponent(
              item.name
            )}`}
            alt={item.name}
            layout="fill"
            objectFit="cover"
            className="rounded-t-lg"
            data-ai-hint={item.name}
          />
        </div>
        <div className="p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">
              {item.name}
            </DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              >
                <Minus className="h-4 w-4" />
              </Button>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                className="w-16 h-10 text-center text-lg font-bold"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={() => setQuantity((q) => q + 1)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-3xl font-extrabold text-primary">
              ₹{(item.price * quantity).toFixed(2)}
            </p>
          </div>

          {isGenerating ? (
            <div className="space-y-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : details && details.isSuccess ? (
            <div className="space-y-3">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1 font-medium">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>{scaledNutrition.calories} kcal</span>
                </div>
                <div className="flex items-center gap-1 font-medium">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <span>{scaledNutrition.protein}g Protein</span>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Salad className="h-5 w-5 text-green-600" />
                  Main Ingredients (per serving)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {details.ingredients.slice(0, 5).map((ing) => (
                    <Badge key={ing.name} variant="secondary">
                      {ing.name} ({formatScaledQuantity(ing)})
                    </Badge>
                  ))}
                  {hasShellfish && (
                    <Badge
                      variant="destructive"
                      className="bg-red-100 text-red-800"
                    >
                      🦐 Contains Shellfish
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Ingredients & nutrition values are approximate per serving.
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <p>Ingredient and calorie information not available.</p>
            </div>
          )}

          <Button onClick={handleAddToCart} className="w-full h-12 text-lg">
            <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
          </Button>
          <div className="flex items-center justify-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground"
              asChild
            >
              <Link href={`/live-order/${storeId}`}>
                <Eye className="mr-2 h-4 w-4" />
                See preparation
              </Link>
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground italic flex items-center justify-center gap-2">
            <Mic className="h-4 w-4" /> Say "add {item.name.toLowerCase()}" to
            order
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuickLinks({ categories, onLinkClick, activeFilter }: { categories: string[], onLinkClick: (category: string) => void, activeFilter: string | null }) {
    const iconMap: { [key: string]: React.ElementType } = {
        'Seafood': Fish,
        'Biryani': Soup,
        'Naan': Wheat,
        'Starters': DrumstickIcon,
        'Default': Utensils
    };

    return (
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-2">
             <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-3 px-4">
                    {categories.map(category => {
                        const Icon = iconMap[category] || iconMap['Default'];
                        const isActive = activeFilter === category;
                        return (
                             <Button 
                                key={category} 
                                variant={isActive ? "default" : "outline"} 
                                className={cn("rounded-full shadow-sm", isActive ? "" : "bg-card")}
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

function MenuHeader({ store }: { store: Store }) {
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
    
    // Fake rating and time for visual similarity
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
                <p className="text-sm text-gray-200">{store.description}</p>
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
            </div>
        </div>
    )
}

export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { firestore } = useFirebase();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [activeFilter, setActiveFilter] = useState<string | null>(null);


  const storeQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, 'stores'), where('__name__', '==', storeId)) : null,
  [firestore, storeId]);

  const menuQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null,
  [firestore, storeId]);

  const { data: stores } = useCollection<Store>(storeQuery);
  const { data: menus } = useCollection<Menu>(menuQuery);

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
    const commonTerms = ['Biryani', 'Naan', 'Seafood', 'Curry', 'Starter', 'Tandoori', 'Fish', 'Rice', 'Bread', 'Soup'];

    // Add main categories
    Object.keys(menuByCategory).forEach(cat => keywords.add(cat));

    // Find keywords in item names
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


  if (!store || !menu) return <div className="p-8 text-center">Menu not available</div>;

  return (
    <>
      {selectedItem && (
        <MenuItemDialog
          item={selectedItem}
          storeId={storeId}
          isOpen
          onClose={() => setSelectedItem(null)}
        />
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <MenuHeader store={store} />
          <QuickLinks categories={quickLinkKeywords} onLinkClick={handleFilterClick} activeFilter={activeFilter} />

          <div className="max-w-3xl mx-auto space-y-8 px-4 py-6">
             {filteredItems ? (
                // VIEW 1: Show filtered results
                <section>
                     <h2 className="flex items-center gap-2 text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
                        Results for "{activeFilter}"
                    </h2>
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {filteredItems.length > 0 ? filteredItems.map(item => (
                            <button
                                key={item.name}
                                onClick={() => setSelectedItem(item)}
                                className="bg-card text-card-foreground p-3 rounded-xl shadow-sm hover:shadow-md transition flex gap-3 items-center"
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
            
                                <p className="font-bold text-primary">₹{item.price}</p>
                            </button>
                        )) : (
                            <p className="text-muted-foreground col-span-full text-center py-8">No items found for "{activeFilter}".</p>
                        )}
                    </div>
                </section>
             ) : (
                // VIEW 2: Show all items grouped by category
                Object.entries(menuByCategory).map(([category, items]) => (
                    <section key={category}>
                        <h2 className="flex items-center gap-2 text-lg font-semibold mb-3 text-gray-800 dark:text-gray-200">
                            <Utensils className="h-4 w-4 text-muted-foreground" />
                            {category}
                        </h2>
        
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {items.map(item => (
                            <button
                                key={item.name}
                                onClick={() => setSelectedItem(item)}
                                className="bg-card text-card-foreground p-3 rounded-xl shadow-sm hover:shadow-md transition flex gap-3 items-center"
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
            
                                <p className="font-bold text-primary">₹{item.price}</p>
                            </button>
                            ))}
                        </div>
                    </section>
                ))
             )}
          </div>
      </div>
    </>
  );
}
