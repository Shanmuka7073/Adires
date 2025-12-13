
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
  DrumstickIcon
} from 'lucide-react';
import { useMemo, useState, useEffect, useRef } from 'react';
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
        .then(setDetails)
        .catch(() =>
          toast({
            variant: 'destructive',
            title: 'Could not fetch details',
            description: 'Please try again later.',
          }),
        )
        .finally(() => setIsGenerating(false));
    }
  }, [isOpen, details, item.name, toast]);

  const handleAddToCart = () => {
    const product: Product = {
      id: `${storeId}-${item.name}`,
      name: item.name,
      description: item.description || '',
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

    addItem(product, variant, quantity);
    toast({ title: 'Added to Cart', description: `${quantity} × ${item.name}` });
    onClose();
  };

  const formatQty = (ing: Ingredient) =>
    ing.baseQuantity && ing.unit
      ? `${(ing.baseQuantity * quantity).toFixed(0)}${ing.unit === 'pc' && quantity > 1 ? 's' : ing.unit}`
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
            <DialogTitle className="text-2xl font-bold">{item.name}</DialogTitle>
          </DialogHeader>

          <div className="flex justify-between items-center">
            <div className="flex gap-2 items-center">
              <Button size="icon" variant="outline" onClick={() => setQuantity(q => Math.max(1, q - 1))}>
                <Minus className="h-4 w-4" />
              </Button>
              <Input value={quantity} className="w-16 h-10 text-center text-lg font-bold" onChange={e => setQuantity(parseInt(e.target.value) || 1)} />
              <Button size="icon" variant="outline" onClick={() => setQuantity(q => q + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-3xl font-extrabold text-primary">₹{(item.price * quantity).toFixed(2)}</p>
          </div>

          {isGenerating ? (
            <div className="space-y-4">
               <Skeleton className="h-4 w-3/4" />
               <Skeleton className="h-4 w-1/2" />
               <Skeleton className="h-10 w-full" />
            </div>
          ) : details?.isSuccess ? (
            <div className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1 font-medium">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <span>{nutrition.calories} kcal</span>
                    </div>
                    <div className="flex items-center gap-1 font-medium">
                        <Zap className="h-4 w-4 text-yellow-500" />
                        <span>{nutrition.protein}g Protein</span>
                    </div>
                </div>
                <div>
                    <h4 className="font-semibold mb-2 flex items-center gap-2">
                       <Salad className="h-5 w-5 text-green-600"/>
                       Main Ingredients (per serving)
                    </h4>
                    <div className="flex flex-wrap gap-2">
                        {details.ingredients.slice(0, 5).map(ing => (
                            <Badge key={ing.name} variant="secondary">{ing.name} ({formatQty(ing)})</Badge>
                        ))}
                        {hasShellfish && <Badge variant="destructive" className="bg-red-100 text-red-800">🦐 Contains Shellfish</Badge>}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">Ingredients & nutrition values are approximate per serving.</p>
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
            <Button variant="ghost" size="sm" className="text-muted-foreground" asChild>
                <Link href={`/live-order/${storeId}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    See preparation
                </Link>
            </Button>
          </div>
           <p className="text-xs text-center text-muted-foreground italic flex items-center justify-center gap-2">
             <Mic className="h-4 w-4" /> Say “add {item.name.toLowerCase()}” to order
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function QuickLinks({ categories, onLinkClick }: { categories: string[], onLinkClick: (category: string) => void }) {
    const iconMap: { [key: string]: React.ElementType } = {
        'Seafood': Fish,
        'Biryani': Soup,
        'Naan': Wheat,
        'Starters': DrumstickIcon,
        'Default': Utensils
    };

    return (
        <div className="sticky top-0 z-10 bg-gray-50/80 backdrop-blur-sm py-2">
             <ScrollArea className="w-full whitespace-nowrap">
                <div className="flex gap-3 px-4">
                    {categories.map(category => {
                        const Icon = iconMap[category] || iconMap['Default'];
                        return (
                             <Button key={category} variant="outline" className="rounded-full shadow-sm bg-white" onClick={() => onLinkClick(category)}>
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

export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const { firestore } = useFirebase();
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);

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
  
  const categoryRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const quickLinkKeywords = useMemo(() => {
    if (!menu?.items) return [];
    const keywords = new Set<string>();
    const commonTerms = ['Biryani', 'Naan', 'Seafood', 'Curry', 'Starter', 'Tandoori', 'Fish'];

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

  const handleLinkClick = (category: string) => {
    const ref = categoryRefs.current[category];
    if (ref) {
      ref.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };


  if (!store || !menu) return <div className="p-8 text-center">Menu not available</div>;

  return (
    <>
      {selectedItem && (
        <MenuItemDialog
          item={selectedItem}
          storeId={storeId}
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

      <div className="min-h-screen bg-gray-50">
          <div className="max-w-2xl mx-auto space-y-8 py-6">
              <h1 className="text-3xl font-bold text-center">{store.name}</h1>
          </div>
          
          <QuickLinks categories={quickLinkKeywords} onLinkClick={handleLinkClick} />

          <div className="max-w-2xl mx-auto space-y-8 px-4 py-6">
              {Object.entries(menuByCategory).map(([category, items]) => (
                <section key={category} ref={el => categoryRefs.current[category] = el}>
                  <h2 className="flex items-center gap-2 text-lg font-semibold mb-3">
                    <Utensils className="h-4 w-4 text-muted-foreground" />
                    {category}
                  </h2>
    
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {items.map(item => (
                      <button
                        key={item.name}
                        onClick={() => setSelectedItem(item)}
                        className="bg-white p-3 rounded-xl shadow-sm hover:shadow-md transition flex gap-3 items-center"
                      >
                        <div className="h-16 w-16 bg-gray-100 rounded-lg relative overflow-hidden">
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
              ))}
          </div>
      </div>
    </>
  );
}

