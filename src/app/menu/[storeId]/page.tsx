
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, writeBatch, doc } from 'firebase/firestore';
import type {
  Store,
  Menu,
  MenuItem,
  GetIngredientsOutput,
  Product,
  ProductVariant,
  Ingredient,
  Order,
  OrderItem,
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
  Receipt,
  Loader2,
} from 'lucide-react';
import { useMemo, useState, useEffect, useRef, useTransition } from 'react';
import Image from 'next/image';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
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
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { v4 as uuidv4 } from 'uuid';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

function MenuItemDialog({
  item,
  storeId,
  isOpen,
  onClose,
  tableNumber,
  sessionId,
}: {
  item: MenuItem;
  storeId: string;
  isOpen: boolean;
  onClose: () => void;
  tableNumber: string | null;
  sessionId: string;
}) {
  const { addItem } = useCart();
  const { toast } = useToast();
  const { firestore } = useFirebase();
  const [quantity, setQuantity] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [details, setDetails] = useState<GetIngredientsOutput | null>(null);

  useEffect(() => {
    if (isOpen && !details) {
      const fetchDetails = async () => {
        setIsGenerating(true);
        try {
          if (!firestore) throw new Error("Firestore not available");
          
          const cached = await getCachedRecipe(firestore, item.name, 'en');
          if (cached && cached.isSuccess) {
            setDetails(cached);
            return;
          }

          const dishDetails = await getIngredientsForDish({ dishName: item.name, language: 'en' });
          
          if (dishDetails.isSuccess) {
            setDetails(dishDetails);
            await cacheRecipe(firestore, item.name, 'en', dishDetails);
          } else {
             toast({ variant: "destructive", title: "Details Unavailable" });
          }

        } catch (e) {
          console.error("Failed to get dish details:", e);
          toast({ variant: "destructive", title: "Details Unavailable" });
        } finally {
          setIsGenerating(false);
        }
      };
      fetchDetails();
    }
  }, [isOpen, item.name, details, toast, firestore]);

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

    addItem(product, variant, quantity, tableNumber || undefined, sessionId);
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

          <p className="text-xs text-center text-muted-foreground italic flex justify-center gap-2">
            <Mic className="h-4 w-4" /> Say “add {item.name.toLowerCase()}” to order
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LiveBill({ sessionId, storeId }: { sessionId: string; storeId: string }) {
    const { firestore } = useFirebase();
    const { toast } = useToast();
    const [isClosing, startCloseTransition] = useTransition();

    const sessionOrdersQuery = useMemoFirebase(() => {
        if (!firestore || !sessionId) return null;
        return query(
            collection(firestore, 'orders'),
            where('sessionId', '==', sessionId),
            where('storeId', '==', storeId)
        );
    }, [firestore, sessionId, storeId]);

    const { data: sessionOrders, isLoading } = useCollection<Order>(sessionOrdersQuery);

    const totalAmount = useMemo(() => {
      if (!sessionOrders) return 0;
      return sessionOrders.reduce((acc, order) => acc + order.totalAmount, 0);
    }, [sessionOrders]);
    
    const isBillClosed = useMemo(() => {
        if (!sessionOrders || sessionOrders.length === 0) return false;
        return sessionOrders.some(order => order.status === 'Billed');
    }, [sessionOrders]);

    const handleCloseBill = () => {
        if (!firestore || !sessionOrders || sessionOrders.length === 0) {
            toast({ variant: 'destructive', title: 'No orders to close.' });
            return;
        }

        startCloseTransition(async () => {
            const batch = writeBatch(firestore);
            sessionOrders.forEach(order => {
                const orderRef = doc(firestore, 'orders', order.id);
                batch.update(orderRef, { status: 'Billed' });
            });
            
            try {
                await batch.commit();
                toast({
                    title: 'Bill Closed',
                    description: 'The kitchen has been notified that you are ready to pay.',
                });
            } catch (error) {
                console.error("Failed to close bill:", error);
                toast({
                    variant: 'destructive',
                    title: 'Action Failed',
                    description: 'Could not close the bill. Please contact staff.',
                });
            }
        });
    };

    return (
        <Card className="shadow-lg mt-8">
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Receipt className="h-6 w-6 text-primary" />
                    Live Bill
                </CardTitle>
                <CardDescription>Your running total for this session. It updates automatically.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center items-center h-24">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                    </div>
                ) : !sessionOrders || sessionOrders.length === 0 ? (
                    <p className="text-center text-muted-foreground py-4">No items ordered yet.</p>
                ) : (
                    <div className="space-y-4">
                        {sessionOrders.map((order, orderIndex) => (
                             <div key={order.id} className="border-b pb-2 last:border-b-0 last:pb-0">
                                <h4 className="font-semibold text-sm mb-2 text-muted-foreground">Order #{orderIndex + 1}</h4>
                                <div className="space-y-1">
                                    {order.items.map((item, itemIndex) => (
                                        <div key={itemIndex} className="flex justify-between items-center text-sm">
                                            <p>{item.productName} <span className="text-muted-foreground">x{item.quantity}</span></p>
                                            <p className="font-medium">₹{(item.price * item.quantity).toFixed(2)}</p>
                                        </div>
                                    ))}
                                </div>
                             </div>
                        ))}
                        <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
                            <p>Total</p>
                            <p>₹{totalAmount.toFixed(2)}</p>
                        </div>
                    </div>
                )}
                 <div className="mt-6 border-t pt-4">
                    {isBillClosed ? (
                        <Button className="w-full" disabled>
                           <Check className="mr-2 h-4 w-4" /> Bill Closed & Pending Payment
                        </Button>
                    ) : (
                        <AlertDialog>
                            <AlertDialogTrigger asChild>
                                <Button className="w-full" variant="destructive" disabled={isClosing || !sessionOrders || sessionOrders.length === 0}>
                                    {isClosing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Close Bill & Pay
                                </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                                <AlertDialogHeader>
                                    <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This will close the ordering session for your table and notify the staff you are ready to pay. You won't be able to add more items.
                                    </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={handleCloseBill}>Yes, Close Bill</AlertDialogAction>
                                </AlertDialogFooter>
                            </AlertDialogContent>
                        </AlertDialog>
                    )}
                </div>
            </CardContent>
        </Card>
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

    return (
        <div className="relative h-40 w-full">
            {isLoading ? <Skeleton className="w-full h-full" /> : (
                 <Image src={image.imageUrl} alt={store.name} fill className="object-cover" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/50 to-transparent" />
            <div className="absolute bottom-0 left-0 p-4 text-white">
                <h1 className="text-3xl font-bold">{store.name}</h1>
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
  const [sessionId, setSessionId] = useState<string | null>(null);

  useEffect(() => {
    const sessionKey = `tableSession_${storeId}_${tableNumber}`;
    let currentSessionId = sessionStorage.getItem(sessionKey);
    if (!currentSessionId) {
        currentSessionId = uuidv4();
        sessionStorage.setItem(sessionKey, currentSessionId);
    }
    setSessionId(currentSessionId);
  }, [storeId, tableNumber]);

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
                    </div>
                </div>
            </div>
        </div>
    );
  }

  if (!store || !menu) return <div className="p-8 text-center">Menu not available</div>;

  return (
    <>
      {selectedItem && sessionId && (
        <MenuItemDialog
          item={selectedItem}
          storeId={storeId}
          isOpen
          onClose={() => setSelectedItem(null)}
          tableNumber={tableNumber}
          sessionId={sessionId}
        />
      )}

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
          <MenuHeader store={store} tableNumber={tableNumber} />

          <div className="max-w-3xl mx-auto space-y-8 px-4 py-6">
             {sessionId && <LiveBill sessionId={sessionId} storeId={storeId} />}
            
            {Object.entries(menuByCategory).map(([category, items]) => (
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
            ))}
          </div>
      </div>
    </>
  );
}
