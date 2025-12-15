
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
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
import { useEffect, useMemo, useState, useTransition, useRef } from 'react';
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { addRestaurantOrderItem } from '@/app/actions';
import type { Timestamp } from 'firebase/firestore';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { getIngredientsForDish } from '@/ai/flows/recipe-ingredients-flow';
import { getCachedRecipe, cacheRecipe } from '@/lib/recipe-cache';
import { Separator } from '@/components/ui/separator';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';


/* -------------------------------------------------------------------------- */
/*                                   LIVE BILL                                */
/* -------------------------------------------------------------------------- */

function LiveBill({ storeId, sessionId }: { storeId: string; sessionId: string }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [closing, startClose] = useTransition();
  const orderId = `${storeId}_${sessionId}`;

  const orderQuery = useMemoFirebase(
    () => (firestore ? doc(firestore, 'orders', orderId) : null),
    [firestore, orderId]
  );
  
  const { data: order, isLoading } = useDoc<Order>(orderQuery);
  
  const closeBill = async () => {
    if (!firestore || !order) return;
    startClose(async () => {
      const orderRef = doc(firestore, 'orders', order.id);
      try {
        await setDoc(orderRef, { status: 'Billed' }, { merge: true });
        toast({ title: 'Bill closed. Please proceed to the counter to pay.' });
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Failed to close bill.' });
      }
    });
  };

  if (isLoading) {
    return <Loader2 className="animate-spin mx-auto" />;
  }
  
  if (!order || !order.items?.length) {
      return (
          <Card className="bg-muted/50 rounded-xl shadow">
              <CardContent className="p-3">
                  <p className="text-muted-foreground text-center text-sm py-2">No items added to your bill yet.</p>
              </CardContent>
          </Card>
      )
  }

  return (
    <Card className="rounded-xl shadow-md overflow-hidden">
      <Accordion type="single" collapsible defaultValue="live-bill">
          <AccordionItem value="live-bill" className="border-b-0">
              <AccordionTrigger className="p-3 bg-white hover:no-underline">
                 <div className="flex justify-between items-center w-full">
                    <div className="flex items-center gap-2">
                        <Receipt className="h-5 w-5" />
                        <span className="font-semibold text-base">Live Bill</span>
                    </div>
                    <p className="font-bold text-lg pr-2">₹{order.totalAmount.toFixed(2)}</p>
                 </div>
              </AccordionTrigger>
              <AccordionContent className="p-0">
                  <div className="bg-muted/30 p-3 space-y-2 max-h-48 overflow-y-auto">
                    {order.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-sm items-center">
                        <span className="font-medium">{it.productName} <span className="text-muted-foreground">x{it.quantity}</span></span>
                        <span>₹{(it.price * it.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
              </AccordionContent>
          </AccordionItem>
      </Accordion>
       {order.status !== 'Completed' && order.status !== 'Billed' && (
          <div className="p-3 border-t">
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
          </div>
      )}
      {order.status === 'Billed' && (
         <div className="p-3 bg-green-100 text-center">
             <Clock className="mx-auto h-5 w-5 text-green-600 mb-1" />
             <p className="font-semibold text-sm text-green-800">Bill Closed. Please pay at the counter.</p>
         </div>
      )}
       {order.status === 'Completed' && (
         <div className="p-3 bg-blue-100 text-center">
             <Check className="mx-auto h-5 w-5 text-blue-600 mb-1" />
             <p className="font-semibold text-sm text-blue-800">Thank you! Visit Again.</p>
         </div>
      )}
    </Card>
  );
}

function RecipeDialog({ isOpen, onOpenChange, dishName, onAddToBill }: { isOpen: boolean, onOpenChange: (open: boolean) => void, dishName: string, onAddToBill: () => void }) {
    const [result, setResult] = useState<GetIngredientsOutput | null>(null);
    const [isGenerating, startGeneration] = useTransition();
    const { firestore } = useFirebase();

    useEffect(() => {
        if (isOpen && !result) {
            startGeneration(async () => {
                if (!firestore) return;
                let recipeData = await getCachedRecipe(firestore, dishName, 'en');
                if (!recipeData) {
                    const generatedData = await getIngredientsForDish({ dishName, language: 'en' });
                    if (generatedData.isSuccess) {
                        recipeData = generatedData;
                        await cacheRecipe(firestore, dishName, 'en', generatedData);
                    }
                }
                setResult(recipeData);
            });
        } else if (!isOpen) {
            // Reset result when dialog is closed to refetch next time
            setResult(null);
        }
    }, [isOpen, dishName, firestore, result]);


    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md w-[90vw] max-h-[85vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>{result?.title || dishName}</DialogTitle>
                    <DialogDescription>Ingredients & Instructions</DialogDescription>
                </DialogHeader>
                <ScrollArea className="flex-1 -mx-6 px-6">
                    {isGenerating ? (
                        <div className="flex items-center justify-center h-48">
                            <Loader2 className="h-8 w-8 animate-spin" />
                        </div>
                    ) : result?.isSuccess ? (
                        <div className="space-y-4">
                            <div>
                                <h4 className="font-semibold text-lg flex items-center gap-2"><Salad className="h-5 w-5 text-green-600"/> Ingredients</h4>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {result.ingredients.map((ing, i) => <Badge key={i} variant="secondary">{ing.name}</Badge>)}
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <h4 className="font-semibold text-lg">Instructions</h4>
                                <ol className="space-y-3 mt-2">
                                    {result.instructions.map((step, i) => (
                                        <li key={i}>
                                            <h5 className="font-bold">{step.title}</h5>
                                            <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                                                {step.actions.map((action, j) => <li key={j}>{action}</li>)}
                                            </ul>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        </div>
                    ) : (
                        <p>Could not find recipe details.</p>
                    )}
                </ScrollArea>
                <DialogFooter className="mt-4">
                    <Button className="w-full" onClick={() => { onAddToBill(); onOpenChange(false); }}>
                        <Plus className="mr-2 h-4 w-4" /> Add to Bill
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const tableNumber = useSearchParams().get('table');
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [isAdding, startAdding] = useTransition();
  const [sessionId, setSessionId] = useState('');
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);
  const canInstall = !!installPrompt;
  const [selectedItem, setSelectedItem] = useState<MenuItem | null>(null);
  const [isRecipeOpen, setIsRecipeOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const triggerInstall = () => {
    if (!installPrompt) return;
    (installPrompt as any).prompt();
  };

  useEffect(() => {
    const key = `session_${storeId}_${tableNumber}`;
    let id = sessionStorage.getItem(key);
    if (!id) {
      id = uuidv4();
      sessionStorage.setItem(key, id);
    }
    setSessionId(id);
  }, [storeId, tableNumber]);

  const storeRef = useMemoFirebase(() =>
    firestore ? doc(firestore, 'stores', storeId) : null,
  [firestore, storeId]);

  const menuQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null,
  [firestore, storeId]);
    
  const orderId = `${storeId}_${sessionId}`;
  const orderQuery = useMemoFirebase(() => firestore && sessionId ? doc(firestore, 'orders', orderId) : null, [firestore, orderId, sessionId]);
  
  const { data: liveOrder } = useDoc<Order>(orderQuery);
  const { data: store, isLoading: storeLoading } = useDoc<Store>(storeRef);
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);
  
  const menu = menus?.[0];
  
  const { categories, groupedMenu } = useMemo(() => {
    if (!menu?.items) return { categories: [], groupedMenu: {} };
    const categories = ['All', ...Array.from(new Set(menu.items.map(item => item.category || 'Other'))).sort()];
    const grouped = menu.items.reduce((acc, item) => {
        const cat = item.category || 'Other';
        if(!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, MenuItem[]>);
    return { categories, groupedMenu: grouped };
  }, [menu]);

  const filteredMenu = useMemo(() => {
    if (selectedCategory === 'All') {
        return groupedMenu;
    }
    return { [selectedCategory]: groupedMenu[selectedCategory] || [] };
  }, [selectedCategory, groupedMenu]);

  const handleItemClick = (item: MenuItem) => {
    setSelectedItem(item);
    setIsRecipeOpen(true);
  };
  
  const handleAddToBill = () => {
    if (!selectedItem) return;
    startAdding(async () => {
      const result = await addRestaurantOrderItem({
        storeId,
        sessionId,
        tableNumber: tableNumber || null,
        item: selectedItem,
        quantity: 1,
      });

      if (result.success) {
        toast({
          title: "Added to Bill",
          description: `${selectedItem.name} has been added to your live bill.`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Add Item",
          description: result.error || "An unknown error occurred.",
        });
      }
    });
  };

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
    <div className="min-h-screen bg-gray-50 pb-24">
      {selectedItem && (
         <RecipeDialog 
            isOpen={isRecipeOpen} 
            onOpenChange={setIsRecipeOpen} 
            dishName={selectedItem.name} 
            onAddToBill={handleAddToBill}
         />
      )}
      <header className="sticky top-0 z-40 bg-white border-b p-4">
        <div className="flex items-center gap-4">
             {store.imageUrl && (
              <Image src={store.imageUrl} alt={store.name} width={48} height={48} className="rounded-lg border" />
             )}
            <div>
              <h1 className="font-bold text-xl">{store.name}</h1>
              {tableNumber && (
                <p className="text-sm text-muted-foreground">
                  Table {tableNumber} • Live Order
                </p>
              )}
            </div>
            {canInstall && (
            <Button size="sm" variant="ghost" onClick={triggerInstall} className="ml-auto">
                <Download className="mr-2 h-4 w-4" />
                Add to Home
            </Button>
           )}
        </div>
      </header>

      {sessionId && (
          <div className="sticky top-[89px] z-30 px-4 py-2 bg-gray-50/80 backdrop-blur-sm">
            <LiveBill storeId={storeId} sessionId={sessionId} />
          </div>
      )}
      
      <div className="sticky top-[181px] z-30 bg-gray-50/95 backdrop-blur-sm py-2">
         <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex space-x-2 px-4">
                {categories.map(category => (
                    <Button
                        key={category}
                        variant={selectedCategory === category ? "default" : "outline"}
                        onClick={() => setSelectedCategory(category)}
                        className="rounded-full shadow-sm"
                    >
                        {category}
                    </Button>
                ))}
            </div>
            <ScrollBar orientation="horizontal" />
         </ScrollArea>
      </div>

      <main className="px-4 py-4 space-y-6">
        {Object.entries(filteredMenu).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
          <div key={category}>
            <h2 className="text-xl font-semibold mb-3 tracking-wide text-gray-800">{category}</h2>
            <div className="space-y-3">
              {items.map((item, index) => (
                <div
                  key={index}
                  onClick={() => handleItemClick(item)}
                  className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm active:scale-[0.98] transition-transform"
                >
                  <div>
                    <p className="font-semibold text-base">{item.name}</p>
                    <p className="text-xs text-muted-foreground">Tap to add</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-primary text-lg">
                      ₹{item.price.toFixed(2)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </main>

       {liveOrder && liveOrder.totalAmount > 0 && liveOrder.status === 'Billed' && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/80 backdrop-blur-sm border-t p-3 z-50">
          <Button className="w-full h-14 text-lg font-bold">
            Pay ₹{liveOrder.totalAmount.toFixed(0)} at Counter
          </Button>
        </div>
      )}
    </div>
  );
}
