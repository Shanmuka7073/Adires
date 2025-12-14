
'use client';

import { useFirebase, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  writeBatch,
  doc,
  orderBy,
  Timestamp,
  setDoc,
} from 'firebase/firestore';

import type {
  Store,
  Menu,
  MenuItem,
  Order,
  OrderItem,
  GetIngredientsOutput,
  Ingredient,
} from '@/lib/types';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

import {
  Utensils,
  Plus,
  Minus,
  Receipt,
  Loader2,
  Check,
  Clock,
  Zap,
  Flame,
  Info,
  ShoppingCart,
  Salad,
  Mic,
  Eye,
} from 'lucide-react';

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
  AlertDialogDescription,
} from '@/components/ui/alert-dialog';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import Link from 'next/link';

/* -------------------------------------------------------------------------- */
/*                               MENU ITEM DIALOG                             */
/* -------------------------------------------------------------------------- */

function MenuItemDialog({
  item,
  storeId,
  tableNumber,
  sessionId,
  isOpen,
  onClose,
}: {
  item: MenuItem;
  storeId: string;
  tableNumber: string | null;
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [details, setDetails] = useState<GetIngredientsOutput | null>(null);
  const [saving, startSaving] = useTransition();
  const [image, setImage] = useState({ imageUrl: '', imageHint: '' });

  useEffect(() => {
    if (isOpen) {
      setIsGenerating(true);
      const fetchDetails = async () => {
        try {
          if (firestore) {
            const cached = await getCachedRecipe(firestore, item.name, 'en');
            if (cached) {
              setDetails(cached);
              toast({ title: "Details loaded from cache." });
              return;
            }
          }

          const dishDetails = await getIngredientsForDish({ dishName: item.name, language: 'en' });
          if (dishDetails.isSuccess) {
            setDetails(dishDetails);
            if (firestore) {
              await cacheRecipe(firestore, item.name, 'en', dishDetails);
            }
          } else {
            toast({ variant: "destructive", title: "Could not fetch details" });
          }
        } catch (e) {
          console.error("Failed to get dish details:", e);
          toast({ variant: "destructive", title: "Error", description: "Could not fetch dish details." });
        } finally {
          setIsGenerating(false);
        }
      };

      const fetchImage = async () => {
        try {
            const unsplashUrl = `https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop&q=80&seed=${encodeURIComponent(item.name)}`;
            setImage({ imageUrl: unsplashUrl, imageHint: item.name });
        } catch (error) {
            console.error("Failed to get image", error);
        }
      };
      
      fetchDetails();
      fetchImage();
    }
  }, [isOpen, item.name, firestore, toast]);

  const placeOrder = () => {
    if (!firestore || !sessionId) return;

    startSaving(async () => {
      const orderId = uuidv4();
      const orderItemId = uuidv4();

      const order: Order = {
        id: orderId,
        storeId,
        sessionId,
        tableNumber: tableNumber ?? null,
        userId: 'guest',
        customerName: `Table ${tableNumber || 'Guest'}`,
        deliveryAddress: "In-store dining",
        deliveryLat: 0,
        deliveryLng: 0,
        phone: '',
        email: '',
        orderDate: Timestamp.now(),
        status: 'Pending',
        totalAmount: item.price * quantity,
        items: [
          {
            id: orderItemId,
            orderId: orderId,
            productId: `${storeId}-${item.name.replace(/\s+/g, '-')}`,
            productName: item.name,
            quantity,
            price: item.price,
            variantSku: `${item.name.replace(/\s+/g, '-')}-default`,
            variantWeight: '1 serving',
          },
        ],
      };

      try {
        await setDoc(doc(firestore, 'orders', orderId), order);
        toast({
          title: 'Order sent to kitchen!',
          description: `${quantity} × ${item.name}`,
        });
        onClose();
      } catch (err) {
        console.error(err);
        toast({
          variant: 'destructive',
          title: 'Failed to add order',
        });
      }
    });
  };

  const formatScaledQuantity = (ingredient: Ingredient) => {
    if (ingredient.baseQuantity && ingredient.unit) {
      const scaledQuantity = ingredient.baseQuantity * quantity;
      const unit = ingredient.unit === 'pc' && scaledQuantity > 1 ? 'pcs' : ingredient.unit;
      return `${scaledQuantity.toFixed(0)}${unit}`;
    }
    return ingredient.quantity;
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
            {image.imageUrl ? (
                <Image
                    src={image.imageUrl}
                    alt={item.name}
                    layout="fill"
                    objectFit="cover"
                    className="rounded-t-lg"
                    data-ai-hint={image.imageHint}
                />
            ) : <Skeleton className="w-full h-full" />}
        </div>
        <div className="p-6 space-y-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{item.name}</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setQuantity(q => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></Button>
              <Input type="number" value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} className="w-16 h-10 text-center text-lg font-bold" />
              <Button variant="outline" size="icon" onClick={() => setQuantity(q => q + 1)}><Plus className="h-4 w-4" /></Button>
            </div>
            <p className="text-3xl font-extrabold text-primary">₹{(item.price * quantity).toFixed(2)}</p>
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
                   <Salad className="h-5 w-5 text-green-600"/>
                   Main Ingredients (per serving)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {details.ingredients.slice(0, 5).map(ing => (
                    <Badge key={ing.name} variant="secondary">{ing.name} ({formatScaledQuantity(ing)})</Badge>
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

          <Button onClick={placeOrder} disabled={saving} className="w-full h-12 text-lg">
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <ShoppingCart className="mr-2 h-5 w-5" />
            Add to Order
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
             <Mic className="h-4 w-4" /> Say "add {item.name.toLowerCase()}" to order
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* -------------------------------------------------------------------------- */
/*                                   LIVE BILL                                */
/* -------------------------------------------------------------------------- */

function LiveBill({ storeId, sessionId }: { storeId: string; sessionId: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [closing, startClose] = useTransition();

  const ordersQuery = useMemoFirebase(() =>
    firestore
      ? query(
          collection(firestore, 'orders'),
          where('storeId', '==', storeId),
          where('sessionId', '==', sessionId),
          orderBy('orderDate', 'asc')
        )
      : null,
  [firestore, storeId, sessionId]);

  const { data: orders, isLoading } = useCollection<Order>(ordersQuery);

  const total = useMemo(
    () => orders?.reduce((s, o) => s + o.totalAmount, 0) ?? 0,
    [orders]
  );
  
  const isBilled = useMemo(() => orders?.some(o => o.status === 'Billed'), [orders]);
  const isCompleted = useMemo(() => orders?.every(o => o.status === 'Completed'), [orders]);

  const closeBill = () => {
    if (!firestore || !orders?.length) return;

    startClose(async () => {
      const batch = writeBatch(firestore);
      orders.forEach(o => {
        batch.update(doc(firestore, 'orders', o.id), { status: 'Billed' });
      });

      await batch.commit();
      toast({ title: 'Bill Closed', description: 'Notifying cashier. Please wait for payment confirmation.' });
    });
  };

  if (isCompleted) {
    return (
        <Card className="mt-6 bg-green-50 border-green-200">
            <CardHeader className="text-center">
                <Check className="mx-auto h-12 w-12 text-green-500" />
                <CardTitle className="text-green-700">Thank You!</CardTitle>
                 <p className="text-sm text-green-600">Your payment has been confirmed. Please visit again!</p>
            </CardHeader>
        </Card>
    )
  }
  
  if (isLoading && (!orders || orders.length === 0)) {
      return (
          <Card className="mt-6">
              <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Receipt /> Live Bill
                  </CardTitle>
              </CardHeader>
              <CardContent className="text-center text-muted-foreground py-8">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  <p className="mt-2">Loading your bill...</p>
              </CardContent>
          </Card>
      );
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt /> Live Bill
        </CardTitle>
      </CardHeader>

      <CardContent>
        {!orders?.length ? (
          <p className="text-muted-foreground text-center">No orders yet. Add an item to start a bill.</p>
        ) : (
          <>
            {orders.map((o, i) => (
              <div key={o.id} className="border-b py-2">
                <p className="text-sm font-semibold text-muted-foreground">Order {i + 1} at {format(new Date(o.orderDate.seconds * 1000), 'p')}</p>
                {o.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <span>{it.productName} × {it.quantity}</span>
                    <span>₹{(it.price * it.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            ))}

            <div className="flex justify-between font-bold mt-3 text-lg">
              <span>Total</span>
              <span>₹{total.toFixed(2)}</span>
            </div>
            
            <div className="mt-4">
              {isBilled ? (
                <Button className="w-full" disabled>
                  <Clock className="mr-2 h-4 w-4 animate-spin"/>
                  Waiting for payment confirmation...
                </Button>
              ) : (
                 <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="w-full" variant="destructive">
                      Close Bill & Pay
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Ready to Pay?</AlertDialogTitle>
                      <AlertDialogDescription>This will notify the kitchen that you are done ordering and ready to pay your bill.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Not yet</AlertDialogCancel>
                      <AlertDialogAction onClick={closeBill}>
                        Yes, Close Bill
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}


/* -------------------------------------------------------------------------- */
/*                                MAIN PAGE                                   */
/* -------------------------------------------------------------------------- */

export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const tableNumber = useSearchParams().get('table');
  const { firestore } = useFirebase();

  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [sessionId, setSessionId] = useState('');

  useEffect(() => {
    const key = `session_${storeId}_${tableNumber}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = uuidv4();
      sessionStorage.setItem(key, id);
    }
    setSessionId(id);
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

  const groupedMenu = useMemo(() => {
    if (!menu?.items) return {};
    return menu.items.reduce((acc, item) => {
        const cat = item.category || 'Other';
        if(!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, MenuItem[]>)
  }, [menu]);

  if (storeLoading || menuLoading) return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-8 w-1/2" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-6 w-1/4" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
  );
  if (!store || !menu) return <div className="p-4 text-center">Menu not found.</div>;

  return (
    <>
      {selectedItem && (
        <MenuItemDialog
          item={selectedItem}
          storeId={storeId}
          tableNumber={tableNumber}
          sessionId={sessionId}
          isOpen={!!selectedItem}
          onClose={() => setSelectedItem(null)}
        />
      )}

       <div className="min-h-screen bg-gray-50">
        <div className="container mx-auto py-8 px-4 md:px-6">
          <Card className="max-w-2xl mx-auto shadow-lg">
            <CardHeader className="text-center">
                <div className="flex items-center justify-center gap-2">
                    <span className="text-3xl font-bold text-green-600 font-mono">Ψ۹</span>
                    <CardTitle className="text-3xl font-bold font-headline">{store.name}</CardTitle>
                </div>
                {tableNumber && <Badge className="mx-auto mt-2">Table {tableNumber}</Badge>}
            </CardHeader>
            <CardContent className="space-y-6">
                {sessionId && <LiveBill storeId={storeId} sessionId={sessionId} />}

                {Object.entries(groupedMenu).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                    <div key={category}>
                        <h2 className="text-xl font-semibold mb-3 border-b pb-2 tracking-widest uppercase text-muted-foreground">{category}</h2>
                        <div className="space-y-2">
                            {items.map((item, index) => (
                                <button
                                    key={index}
                                    onClick={() => setSelectedItem(item)}
                                    className="w-full flex justify-between items-center py-2 text-left hover:bg-muted/50 rounded-md px-2"
                                >
                                    <p className="font-medium text-gray-800">{item.name}</p>
                                    <p className="font-semibold text-gray-600">₹{item.price.toFixed(2)}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
