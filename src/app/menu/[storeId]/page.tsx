
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
      description: '',
      storeId,
      category: item.category,
      imageId: 'cat-restaurant',
      isMenuItem: true,
      price: item.price,
    };

    const variant: ProductVariant = {
      sku: `${storeId}-${item.name}`,
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
      ? `${(ing.baseQuantity * quantity).toFixed(0)}${ing.unit}`
      : ing.quantity;

  const nutrition = useMemo(() => {
    if (!details?.nutrition) return { calories: 0, protein: 0 };
    return {
      calories: Math.round(details.nutrition.calories * quantity),
      protein: Math.round(details.nutrition.protein * quantity),
    };
  }, [details, quantity]);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-0">
        <div className="relative h-48 w-full">
          <Image
            src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&q=80&seed=${item.name}`}
            alt={item.name}
            fill
            className="object-cover rounded-t-lg"
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
              <Input value={quantity} className="w-16 text-center font-bold" />
              <Button size="icon" variant="outline" onClick={() => setQuantity(q => q + 1)}>
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-2xl font-extrabold text-primary">₹{item.price * quantity}</p>
          </div>

          {isGenerating ? (
            <Skeleton className="h-20 w-full" />
          ) : details?.isSuccess ? (
            <>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Flame className="h-4 w-4 text-orange-500" /> {nutrition.calories} kcal
                </span>
                <span className="flex items-center gap-1">
                  <Zap className="h-4 w-4 text-yellow-500" /> {nutrition.protein}g Protein
                </span>
              </div>

              <div>
                <h4 className="font-semibold flex items-center gap-2 mb-2">
                  <Salad className="h-4 w-4 text-green-600" />
                  Ingredients
                </h4>
                <div className="flex flex-wrap gap-2">
                  {details.ingredients.slice(0, 5).map(ing => (
                    <Badge key={ing.name}>
                      {ing.name} ({formatQty(ing)})
                    </Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Ingredients & nutrition values are approximate.
                </p>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground flex gap-2 items-center">
              <Info className="h-4 w-4" /> Details unavailable
            </p>
          )}

          <Button onClick={handleAddToCart} className="w-full h-12">
            <ShoppingCart className="mr-2 h-5 w-5" /> Add to Cart
          </Button>

          <Button variant="ghost" asChild className="w-full">
            <Link href={`/live-order/${storeId}`}>
              <Eye className="mr-2 h-4 w-4" /> See preparation
            </Link>
          </Button>

          <p className="text-xs text-center text-muted-foreground italic flex justify-center gap-2">
            <Mic className="h-4 w-4" /> Say “add {item.name.toLowerCase()}”
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* =========================
   PUBLIC MENU PAGE (FIXED UI)
========================= */

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
      acc[cat] = acc[cat] || [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menu]);

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

      <div className="min-h-screen bg-gray-50 px-4 py-6">
        <div className="max-w-2xl mx-auto space-y-8">
          <h1 className="text-3xl font-bold text-center">{store.name}</h1>

          {Object.entries(menuByCategory).map(([category, items]) => (
            <section key={category}>
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
                        src={`https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=150&h=150&fit=crop&q=80&seed=${item.name}`}
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
