
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  doc,
  setDoc,
} from 'firebase/firestore';

import type { Store, Menu, MenuItem, Order, GetIngredientsOutput, Ingredient, InstructionStep } from '@/lib/types';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import { v4 as uuidv4 } from 'uuid';

import {
  Utensils,
  Receipt,
  Loader2,
  Plus,
  Clock,
  Check,
  Salad,
  Info,
  Download,
  Copy,
  StopCircle,
  Volume2,
} from 'lucide-react';

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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetFooter,
} from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { addRestaurantOrderItem } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import type { Timestamp } from 'firebase/firestore';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';

/* -------------------------------------------------------------------------- */
/*                          INGREDIENTS DIALOG                                */
/* -------------------------------------------------------------------------- */
function IngredientsDialog({ 
    isOpen, 
    onClose, 
    item, 
    details, 
    isLoading,
    onAddItem 
}: { 
    isOpen: boolean, 
    onClose: () => void, 
    item: MenuItem | null, 
    details: GetIngredientsOutput | null, 
    isLoading: boolean,
    onAddItem: (item: MenuItem) => void 
}) {
    if (!item) return null;

    const handleAddClick = () => {
        onAddItem(item);
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Salad className="h-5 w-5 text-green-600" />
                        Ingredients for {item.name}
                    </DialogTitle>
                </DialogHeader>
                {isLoading ? (
                    <div className="flex justify-center items-center h-48">
                        <Loader2 className="h-8 w-8 animate-spin" />
                    </div>
                ) : !details || !details.isSuccess ? (
                    <div className="text-center py-8">
                        <Info className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-muted-foreground">Could not retrieve ingredients for this item.</p>
                    </div>
                ) : (
                    <ScrollArea className="max-h-[60vh] -mx-4 px-4">
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4 text-center">
                                <div className="p-3 bg-blue-50 rounded-lg">
                                    <p className="text-xs text-blue-700 font-bold">CALORIES</p>
                                    <p className="text-lg font-bold text-blue-900">{details.nutrition.calories}</p>
                                </div>
                                 <div className="p-3 bg-green-50 rounded-lg">
                                    <p className="text-xs text-green-700 font-bold">PROTEIN</p>
                                    <p className="text-lg font-bold text-green-900">{details.nutrition.protein}g</p>
                                </div>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Ingredients</h4>
                                <div className="flex flex-wrap gap-2">
                                    {details.ingredients.map((ing, i) => (
                                        <Badge key={i} variant="secondary">{ing.name} - {ing.quantity}</Badge>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-3 italic">
                                    Disclaimer: Ingredients and nutritional values are AI-generated approximations and may not be exact.
                                </p>
                            </div>
                        </div>
                    </ScrollArea>
                )}
                 <DialogFooter className="pt-4">
                    <Button variant="outline" onClick={onClose}>Close</Button>
                    <Button onClick={handleAddClick} disabled={isLoading || !details?.isSuccess}>
                        <Plus className="mr-2 h-4 w-4" /> Add to Bill
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

/* -------------------------------------------------------------------------- */
/*                            LIVE BILL COMPONENTS                            */
/* -------------------------------------------------------------------------- */

function LiveBillSheet({ order, store, onClose }: { order: Order; store: Store, onClose: () => void }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [closing, startClose] = useTransition();

  const closeBill = async () => {
    if (!firestore || !order) return;
    startClose(async () => {
      const orderRef = doc(firestore, 'orders', order.id);
      try {
        await setDoc(orderRef, { status: 'Billed' }, { merge: true });
        toast({ title: 'Bill closed. Please proceed to the counter to pay.' });
        onClose();
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Failed to close bill.' });
      }
    });
  };

  return (
    <SheetContent>
      <SheetHeader>
        <SheetTitle className="flex items-center gap-2">
          <Receipt /> Live Bill for Table {order.tableNumber}
        </SheetTitle>
      </SheetHeader>
      <div className="py-4 space-y-2">
        {order.items.map((it, idx) => (
          <div key={idx} className="border-b py-2 flex justify-between text-sm">
            <span className="font-medium">{it.productName} <span className="text-muted-foreground">x{it.quantity}</span></span>
            <span>₹{(it.price * it.quantity).toFixed(2)}</span>
          </div>
        ))}
      </div>
      <SheetFooter className="flex-col space-y-4">
        <div className="flex justify-between font-bold text-xl">
          <span>Total</span>
          <span>₹{order.totalAmount.toFixed(2)}</span>
        </div>
        {order.status === 'Completed' ? (
          <div className="text-center p-4 bg-blue-100 rounded-md">
            <Check className="mx-auto h-6 w-6 text-blue-600 mb-2" />
            <p className="font-semibold text-blue-800">Thank you! Visit Again.</p>
          </div>
        ) : order.status === 'Billed' ? (
          <div className="text-center p-4 bg-green-100 rounded-md">
            <Clock className="mx-auto h-6 w-6 text-green-600 mb-2" />
            <p className="font-semibold text-green-800">Bill Closed. Please pay at the counter.</p>
          </div>
        ) : (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button className="w-full" variant="destructive" disabled={closing}>
                {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Close Bill & Pay
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Ready to Pay?</AlertDialogTitle>
                <AlertDialogDescription>This will notify the kitchen and lock your bill for payment.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Not yet</AlertDialogCancel>
                <AlertDialogAction onClick={closeBill}>Yes, Close Bill</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </SheetFooter>
    </SheetContent>
  );
}

function LiveBillBar({ storeId, sessionId, store }: { storeId: string; sessionId: string, store: Store }) {
  const { firestore } = useFirebase();
  const orderId = `${storeId}_${sessionId}`;
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const orderRef = useMemoFirebase(
    () => (firestore ? doc(firestore, 'orders', orderId) : null),
    [firestore, orderId]
  );

  const { data: order } = useDoc<Order>(orderRef);

  if (!order || !order.items?.length) return null;

  return (
    <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-lg z-50">
        <SheetTrigger asChild>
          <button className="flex justify-between items-center px-4 py-3 w-full">
            <div>
              <p className="font-bold text-lg">₹{order.totalAmount.toFixed(0)}</p>
              <p className="text-xs text-muted-foreground">{order.items.length} items</p>
            </div>
            <div className="rounded-full px-6 py-2 bg-primary text-primary-foreground font-semibold flex items-center">
              <Receipt className="mr-2 h-4 w-4" />
              View Bill
            </div>
          </button>
        </SheetTrigger>
      </div>
      <LiveBillSheet order={order} store={store} onClose={() => setIsSheetOpen(false)} />
    </Sheet>
  );
}


/* -------------------------------------------------------------------------- */
/*                                MAIN PAGE                                   */
/* -------------------------------------------------------------------------- */

export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const tableNumber = useSearchParams().get('table');
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const { canInstall, triggerInstall } = useInstall();

  const [sessionId, setSessionId] = useState('');
  const [isAdding, startAdding] = useTransition();
  const [isIngredientsDialogOpen, setIsIngredientsDialogOpen] = useState(false);
  const [selectedItemForIngredients, setSelectedItemForIngredients] = useState<MenuItem | null>(null);
  const [ingredientDetails, setIngredientDetails] = useState<GetIngredientsOutput | null>(null);
  const [isIngredientsLoading, startIngredientsLoading] = useTransition();

  /* ---------------- SESSION ---------------- */
  useEffect(() => {
    const key = `session_${storeId}_${tableNumber}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = uuidv4();
      sessionStorage.setItem(key, id);
    }
    setSessionId(id);
  }, [storeId, tableNumber]);

  /* ---------------- DATA ---------------- */
  const storeRef = useMemoFirebase(() => (firestore ? doc(firestore, 'stores', storeId) : null), [firestore, storeId]);
  const menuQuery = useMemoFirebase(() => (firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null), [firestore, storeId]);
  const { data: store, isLoading: storeLoading } = useDoc<Store>(storeRef);
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);
  const menu = menus?.[0];

  const groupedMenu = useMemo(() => {
    if (!menu?.items) return {};
    return menu.items.reduce((acc, item) => {
      const cat = item.category || 'Other';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {} as Record<string, MenuItem[]>);
  }, [menu]);

  /* ---------------- ACTIONS ---------------- */
  const addItem = (item: MenuItem) => {
    startAdding(async () => {
      const res = await addRestaurantOrderItem({
        storeId,
        sessionId,
        tableNumber: tableNumber || null,
        item,
        quantity: 1,
      });

      if (res.success) {
        toast({ title: `${item.name} added` });
      } else {
        toast({ variant: 'destructive', title: 'Failed to add item' });
      }
    });
  };

  const handleShowIngredients = (item: MenuItem) => {
    if (!firestore) return;
    setSelectedItemForIngredients(item);
    setIsIngredientsDialogOpen(true);
    startIngredientsLoading(async () => {
        setIngredientDetails(null);
        try {
            const cached = await getCachedRecipe(firestore, item.name, 'en');
            if (cached) {
                setIngredientDetails(cached);
                return;
            }
            const details = await getIngredientsForDish({ dishName: item.name, language: 'en' });
            if (details.isSuccess) {
                setIngredientDetails(details);
                await cacheRecipe(firestore, item.name, 'en', details);
            } else {
                setIngredientDetails(null);
                toast({ variant: "destructive", title: "Could not find ingredients for this item." });
            }
        } catch (e) {
            console.error(e);
            setIngredientDetails(null);
            toast({ variant: "destructive", title: "An error occurred while fetching ingredients." });
        }
    });
  };

  /* ---------------- LOADING ---------------- */
  if (storeLoading || menuLoading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-10 w-1/2" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    );
  }

  if (!store || !menu) {
    return <div className="p-4 text-center">Menu not available</div>;
  }

  return (
    <div className="min-h-screen bg-gray-100 pb-20">
       <IngredientsDialog 
            isOpen={isIngredientsDialogOpen}
            onClose={() => setIsIngredientsDialogOpen(false)}
            item={selectedItemForIngredients}
            details={ingredientDetails}
            isLoading={isIngredientsLoading}
            onAddItem={addItem}
        />

      {/* ---------------- HEADER ---------------- */}
      <header className="sticky top-0 bg-white shadow z-40">
        <div className="flex items-center gap-3 p-4">
          {store.imageUrl && (
            <Image
              src={store.imageUrl}
              alt={store.name}
              width={48}
              height={48}
              className="rounded-full border object-cover"
            />
          )}
          <div className="flex-1">
            <h1 className="font-bold text-lg">{store.name}</h1>
            {tableNumber && (
              <p className="text-xs text-muted-foreground">Table {tableNumber}</p>
            )}
          </div>
          <Utensils className="text-primary" />
        </div>
        {canInstall && (
          <div className="px-4 pb-3">
            <Button variant="outline" size="sm" className="w-full" onClick={triggerInstall}>
              <Download className="mr-2 h-4 w-4" /> Add to Home Screen
            </Button>
          </div>
        )}
      </header>

      {/* ---------------- MENU ---------------- */}
      <main className="p-4 space-y-6">
        {Object.entries(groupedMenu).map(([category, items]) => (
          <section key={category}>
            <h2 className="text-sm font-bold uppercase text-muted-foreground mb-2">
              {category}
            </h2>

            <div className="space-y-3">
              {items.map(item => (
                <div
                  key={item.name}
                  className="bg-white rounded-xl shadow-sm p-4 flex justify-between items-center"
                >
                  <button className="text-left flex-1" onClick={() => handleShowIngredients(item)}>
                    <p className="font-semibold">{item.name}</p>
                    <p className="text-sm text-gray-500">₹{item.price}</p>
                  </button>

                  <Button
                    size="sm"
                    disabled={isAdding}
                    onClick={() => addItem(item)}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </main>

      {/* ---------------- LIVE BILL ---------------- */}
      {sessionId && <LiveBillBar storeId={storeId} sessionId={sessionId} store={store} />}
    </div>
  );
}

