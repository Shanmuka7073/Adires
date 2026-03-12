
'use client';

import { useFirebase, useDoc, useCollection, useMemoFirebase } from '@/firebase';
import {
  collection,
  query,
  where,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
} from 'firebase/firestore';

import type {
  Store,
  Menu,
  MenuItem,
  Order,
  OrderItem,
  MenuTheme,
  GetIngredientsOutput,
} from '@/lib/types';

import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState, useTransition } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import {
  Utensils,
  Plus,
  Receipt,
  Loader2,
  Check,
  Clock,
  Search,
  X,
  Download,
  Eye,
  Home,
  MapPin,
  Save,
  Video,
  Truck,
  CheckCircle,
  PlusCircle,
  LocateFixed,
  Trash2,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { addRestaurantOrderItem, getIngredientsForDish } from '@/app/actions';
import { useInstall } from '@/components/install-provider';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import IngredientsDialog from '@/components/IngredientsDialog';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Timestamp } from 'firebase/firestore';

/**
 * Visual tracker showing the progress of a confirmed HOME DELIVERY order.
 */
function LiveOrderTracker({ order, theme }: { order: Order; theme: MenuTheme | undefined }) {
    const statuses = ['Pending', 'Processing', 'Out for Delivery', 'Delivered', 'Completed'];
    
    const statusLabels: Record<string, string> = {
        'Pending': 'Order Received',
        'Processing': 'Preparing Food',
        'Out for Delivery': 'On the Way',
        'Delivered': 'Delivered',
        'Completed': 'Delivered'
    };

    return (
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden mb-6" style={{ backgroundColor: theme?.primaryColor + '05' }}>
            <CardContent className="p-8 text-center">
                <div className="mb-8">
                    <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full mb-6 bg-white/5 border border-white/10 shadow-xl">
                        <Clock className="h-10 w-10 animate-pulse" style={{ color: theme?.primaryColor }} />
                    </div>
                    <h2 className="text-2xl font-black mb-1" style={{color: theme?.textColor}}>{statusLabels[order.status] || order.status}</h2>
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40" style={{color: theme?.textColor}}>Order ID: {order.id.slice(0,8)}</p>
                </div>

                <div className="space-y-6 text-left max-w-[200px] mx-auto mb-8">
                    {[
                        { key: 'Pending', label: 'Order Received' },
                        { key: 'Processing', label: 'Preparing Food' },
                        { key: 'Out for Delivery', label: 'On the Way' },
                        { key: 'Delivered', label: 'Delivered' }
                    ].map((step, i, arr) => {
                        const currentIdx = statuses.indexOf(order.status);
                        const stepIdx = statuses.indexOf(step.key);
                        const isDone = currentIdx > stepIdx;
                        const isCurrent = currentIdx === stepIdx;
                        
                        return (
                            <div key={step.key} className="flex items-center gap-4 relative">
                                {i < arr.length - 1 && (
                                    <div className="absolute left-[11px] top-6 w-0.5 h-6 bg-black/10">
                                        <div className="h-full transition-all duration-1000" style={{ height: isDone ? '100%' : '0%', backgroundColor: theme?.primaryColor }} />
                                    </div>
                                )}
                                <div className={cn(
                                    "h-6 w-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all duration-500",
                                    isDone ? "bg-primary border-transparent" : isCurrent ? "border-primary animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "border-black/10"
                                )} style={{ backgroundColor: isDone ? theme?.primaryColor : '', borderColor: isCurrent ? theme?.primaryColor : '' }}>
                                    {isDone ? <Check className="h-3 w-3 text-white" /> : <div className="h-1.5 w-1.5 rounded-full bg-black/10" style={{ backgroundColor: isCurrent ? theme?.primaryColor : '' }} />}
                                </div>
                                <span className={cn(
                                    "text-[10px] font-black uppercase tracking-widest transition-all",
                                    isDone || i === currentIdx ? "opacity-100 font-extrabold" : "opacity-20"
                                )} style={{ color: theme?.textColor }}>
                                    {step.label}
                                </span>
                            </div>
                        )
                    })}
                </div>

                <div className="pt-6 border-t border-black/5">
                    <Button asChild variant="ghost" className="h-12 px-6 rounded-xl font-black text-[9px] uppercase tracking-[0.2em] transition-all hover:bg-black/5 active:scale-95" style={{ color: theme?.textColor }}>
                        <Link href={`/live-order/${order.id}`}>
                            <Video className="mr-2 h-4 w-4" /> Watch Preparation Live
                        </Link>
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
}

function LiveBillSheet({ orderId, theme }: { orderId: string; theme: MenuTheme | undefined }) {
  const { firestore } = useFirebase();
  const { toast } = useToast();
  const [closing, startClose] = useTransition();

  const orderQuery = useMemoFirebase(
    () => (firestore ? doc(firestore, 'orders', orderId) : null),
    [firestore, orderId]
  );
  
  const { data: order, isLoading } = useDoc<Order>(orderQuery);
  
  const closeBill = async () => {
    if (!firestore || !order) return;
    startClose(async () => {
      const orderRef = doc(firestore, 'orders', order.id);
      let nextStatus: Order['status'];
      
      // If it's a draft, Place the order
      if (order.status === 'Draft') {
          nextStatus = order.tableNumber ? 'Processing' : 'Pending';
      } else {
          // If it's already active, Close the bill (for table only)
          nextStatus = order.tableNumber ? 'Billed' : order.status;
      }
      
      try {
        await setDoc(orderRef, { status: nextStatus }, { merge: true });
        toast({ title: order.status === 'Draft' ? 'Order Placed!' : 'Bill requested.' });
      } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'Failed to confirm order.' });
      }
    });
  };

  const cancelOrder = async () => {
      if (!firestore || !order) return;
      try {
          await deleteDoc(doc(firestore, 'orders', order.id));
          toast({ title: 'Order Cancelled', description: 'Your draft order has been cleared.' });
      } catch (e) {
          toast({ variant: 'destructive', title: 'Failed to cancel order' });
      }
  }

  const handleRemoveItem = async (itemToRemove: OrderItem) => {
      if (!firestore || !order) return;

      const orderRef = doc(firestore, 'orders', order.id);
      const updatedItems = (order.items || []).filter(item => item.id !== itemToRemove.id);
      
      if (updatedItems.length === 0) {
          try {
              await deleteDoc(orderRef);
              toast({ description: "Bill cleared." });
          } catch (e) {}
          return;
      }

      const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

      try {
          await updateDoc(orderRef, {
              items: updatedItems,
              totalAmount: newTotal
          });
          toast({ description: `${itemToRemove.productName} removed.` });
      } catch (e) {
          console.error("Failed to remove item:", e);
          toast({ variant: 'destructive', title: 'Failed to remove item.' });
      }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="animate-spin h-8 w-8 text-muted-foreground" />
      </div>
    );
  }
  
  if (!order || !order.items?.length) {
      return (
          <div className="p-8 text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-muted rounded-full flex items-center justify-center">
                <Receipt className="h-8 w-8 text-muted-foreground opacity-20" />
              </div>
              <p className="text-muted-foreground text-sm font-medium">Your bill is currently empty.</p>
          </div>
      )
  }

  const isDraft = order.status === 'Draft';
  const isLocked = ['Completed', 'Delivered', 'Billed'].includes(order.status);

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: theme?.backgroundColor }}>
        <SheetHeader className='p-5 border-b' style={{ borderColor: theme?.primaryColor + '20' }}>
            <SheetTitle className="flex items-center gap-2 text-lg font-bold" style={{ color: theme?.primaryColor }}>
              <Receipt className="h-5 w-5" /> Live Bill
            </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
             {order.items.map((it, idx) => (
              <div key={idx} className="flex justify-between items-start text-sm pb-3 border-b last:border-0" style={{borderColor: theme?.primaryColor + '10', color: theme?.textColor}}>
                <div className="flex-1 pr-4 min-w-0">
                    <span className="font-bold leading-tight block truncate">{it.productName}</span>
                    <span className="text-[10px] opacity-60 font-bold uppercase tracking-wider">Qty: {it.quantity}</span>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right font-bold shrink-0">
                        ₹{(it.price * it.quantity).toFixed(2)}
                    </div>
                    {isDraft && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleRemoveItem(it)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    )}
                </div>
              </div>
            ))}
        </div>

        <div className="p-6 border-t space-y-4 bg-black/10 backdrop-blur-md" style={{ borderColor: theme?.primaryColor + '20' }}>
            <div className="flex justify-between items-baseline mb-2">
              <span className="text-sm font-bold uppercase tracking-widest opacity-60" style={{ color: theme?.textColor }}>Total Amount</span>
              <span className="text-2xl font-black" style={{ color: theme?.primaryColor }}>₹{order.totalAmount.toFixed(2)}</span>
            </div>
            
            <div className="pt-2">
              {isLocked ? (
                 <div className="text-center p-5 bg-primary/10 border border-white/5 rounded-2xl shadow-sm">
                    <Check className="mx-auto h-8 w-8 mb-2" style={{ color: theme?.primaryColor }} />
                    <p className="font-black text-xs uppercase tracking-widest" style={{ color: theme?.textColor }}>Bill Locked</p>
                    <p className="text-[10px] font-bold opacity-40 mt-1" style={{ color: theme?.textColor }}>Final processing in progress</p>
                </div>
              ) : (
                <div className="flex gap-2">
                    {isDraft && (
                        <Button variant="outline" className="flex-1 h-14 rounded-2xl font-bold" onClick={cancelOrder}>
                            Cancel
                        </Button>
                    )}
                    <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button className="w-full h-14 rounded-2xl text-base font-bold shadow-lg" variant="destructive" disabled={closing}>
                        {closing && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                        {isDraft ? (order.tableNumber ? 'Confirm Order' : 'Place Order') : 'Close Bill & Pay'}
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="rounded-3xl">
                        <AlertDialogHeader>
                        <AlertDialogTitle>{isDraft ? 'Place Order?' : 'Finalize your bill?'}</AlertDialogTitle>
                        <AlertDialogDescription>
                            {isDraft 
                                ? "This will send your order to the kitchen. You can't cancel it after this step." 
                                : "This will signal the staff that you're ready to pay."}
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel className="rounded-xl font-bold">Not yet</AlertDialogCancel>
                        <AlertDialogAction onClick={closeBill} className="rounded-xl font-bold">
                            Yes, Confirm
                        </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                    </AlertDialog>
                </div>
              )}
            </div>
        </div>
    </div>
  );
}


export default function PublicMenuPage() {
  const { storeId } = useParams<{ storeId: string }>();
  const searchParams = useSearchParams();
  const { firestore } = useFirebase();
  const { toast } = useToast();

  const [isAdding, startAdding] = useTransition();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isAddressMode, setIsAddressOpen] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  
  const [tableNumber, setTableNumber] = useState<string | null>(null);
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [deliveryCoords, setDeliveryCoords] = useState<{lat: number, lng: number} | null>(null);

  const [selectedItemForIngredients, setSelectedItemForIngredients] = useState<MenuItem | null>(null);
  const [ingredientsData, setIngredientsData] = useState<GetIngredientsOutput | null>(null);
  const [isFetchingIngredients, startFetchingIngredients] = useTransition();
  const [recentlyAdded, setRecentlyAdded] = useState<Set<string>>(new Set());

  const { canInstall, triggerInstall } = useInstall();

  useEffect(() => {
    const urlTable = searchParams.get('table');
    if (urlTable) {
      setTableNumber(urlTable);
      localStorage.setItem(`last_table_${storeId}`, urlTable);
    } else {
      const savedTable = localStorage.getItem(`last_table_${storeId}`);
      if (savedTable) {
        setTableNumber(savedTable);
      }
    }
    
    const savedAddress = localStorage.getItem(`last_address_${storeId}`);
    const savedName = localStorage.getItem(`last_name_${storeId}`);
    const savedPhone = localStorage.getItem(`last_phone_${storeId}`);
    const savedLat = localStorage.getItem(`last_lat_${storeId}`);
    const savedLng = localStorage.getItem(`last_lng_${storeId}`);

    if (savedAddress) setDeliveryAddress(savedAddress);
    if (savedName) setCustomerName(savedName);
    if (savedPhone) setPhone(savedPhone);
    if (savedLat && savedLng) setDeliveryCoords({lat: parseFloat(savedLat), lng: parseFloat(savedLng)});
  }, [searchParams, storeId]);

  const sessionId = useMemo(() => {
    const today = new Date();
    const dateString = `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
    const subSession = typeof window !== 'undefined' ? localStorage.getItem(`sub_session_${storeId}`) || '1' : '1';

    if (tableNumber) return `table-${tableNumber}-${dateString}-${subSession}`;
    
    let deviceId = localStorage.getItem(`device_session_${storeId}`);
    if (!deviceId) {
        deviceId = Math.random().toString(36).substring(2, 15);
        localStorage.setItem(`device_session_${storeId}`, deviceId);
    }
    return `home-${deviceId}-${dateString}-${subSession}`;
  }, [tableNumber, storeId]);

  const orderId = `${storeId}_${sessionId}`;
  const orderRef = useMemoFirebase(
    () => (firestore && sessionId ? doc(firestore, 'orders', orderId) : null),
    [firestore, orderId, sessionId]
  );
  const { data: order, isLoading: orderLoading } = useDoc<Order>(orderRef);
  const itemCount = order?.items?.length || 0;

  const storeRef = useMemoFirebase(() =>
    firestore ? doc(firestore, 'stores', storeId) : null,
  [firestore, storeId]);

  const menuQuery = useMemoFirebase(() =>
    firestore ? query(collection(firestore, `stores/${storeId}/menus`)) : null,
  [firestore, storeId]);

  const { data: store, isLoading: storeLoading } = useDoc<Store>(storeRef);
  const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);
  const menu = menus?.[0];

  const availableCategories = useMemo(() => {
    if (!menu?.items) return [];
    return Array.from(new Set(menu.items.map(item => item.category))).sort();
  }, [menu]);
  
  const groupedMenu = useMemo(() => {
    if (!menu?.items) return {};
    let filteredItems = menu.items.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.category.toLowerCase().includes(searchTerm.toLowerCase())
    );
    if (selectedCategory) filteredItems = filteredItems.filter(item => item.category === selectedCategory);
    return filteredItems.reduce((acc, item) => {
        const cat = item.category || 'Other';
        if(!acc[cat]) acc[cat] = [];
        acc[cat].push(item);
        return acc;
    }, {} as Record<string, MenuItem[]>)
  }, [menu, searchTerm, selectedCategory]);

  const handleGetLocation = () => {
    if (navigator.geolocation) {
        setIsFetchingLocation(true);
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude } = position.coords;
                setDeliveryCoords({ lat: latitude, lng: longitude });
                setDeliveryAddress(`GPS Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`);
                toast({ title: "Location Captured!", description: "We've accurately pinned your delivery spot." });
                setIsFetchingLocation(false);
            },
            () => {
                toast({ variant: 'destructive', title: "Location Error", description: "Could not retrieve GPS coordinates. Please enter address manually." });
                setIsFetchingLocation(false);
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    } else {
        toast({ variant: 'destructive', title: "Not Supported", description: "GPS is not supported by your browser." });
    }
  };

  const handleAddItem = (item: MenuItem) => {
    if (!tableNumber && (!deliveryAddress || !customerName)) {
        setIsAddressOpen(true);
        return;
    }

    startAdding(async () => {
      const result = await addRestaurantOrderItem({
        storeId,
        sessionId,
        tableNumber: tableNumber,
        item,
        quantity: 1,
        deliveryAddress,
        customerName,
        phone,
        deliveryLat: deliveryCoords?.lat,
        deliveryLng: deliveryCoords?.lng,
      });

      if (result.success) {
        toast({ title: "Dish Added", description: `${item.name} added to your bill.` });
        setRecentlyAdded(prev => new Set(prev).add(item.id));
        setTimeout(() => setRecentlyAdded(prev => {
            const newSet = new Set(prev);
            newSet.delete(item.id);
            return newSet;
        }), 2000);
      } else {
        toast({ variant: "destructive", title: "Failed to Add", description: result.error });
      }
    });
  };

  const startNewSession = () => {
      const nextSubSession = Date.now().toString(36);
      localStorage.setItem(`sub_session_${storeId}`, nextSubSession);
      window.location.reload();
  }

  const saveDetailsAndOrder = () => {
      if (!customerName || !phone || (!tableNumber && !deliveryAddress)) {
          toast({ variant: "destructive", title: "Details Required", description: "Please fill in all fields." });
          return;
      }
      localStorage.setItem(`last_address_${storeId}`, deliveryAddress);
      localStorage.setItem(`last_name_${storeId}`, customerName);
      localStorage.setItem(`last_phone_${storeId}`, phone);
      if (deliveryCoords) {
          localStorage.setItem(`last_lat_${storeId}`, deliveryCoords.lat.toString());
          localStorage.setItem(`last_lng_${storeId}`, deliveryCoords.lng.toString());
      }
      setIsAddressOpen(false);
      toast({ title: "Details Saved", description: "You can now add items to your bill." });
  }

  const handleClearSession = () => {
      if (confirm("Clear your current session? You will lose access to your current bill on this device.")) {
          localStorage.removeItem(`last_table_${storeId}`);
          localStorage.removeItem(`device_session_${storeId}`);
          localStorage.removeItem(`sub_session_${storeId}`);
          setTableNumber(null);
          window.location.reload();
      }
  }

  const handleShowIngredients = (item: MenuItem) => {
    setSelectedItemForIngredients(item);
    startFetchingIngredients(async () => {
      const response = await getIngredientsForDish({
        dishName: item.name,
        language: 'en',
      });
      
      if (response && response.isSuccess) {
        setIngredientsData(response);
      } else {
        setIngredientsData({
          isSuccess: false,
          title: item.name,
          ingredients: [],
          instructions: [],
          nutrition: { calories: 0, protein: 0 },
        });
        toast({
          variant: 'destructive',
          title: 'Ingredients Not Available',
          description: `The ingredients for "${item.name}" could not be generated at this time.`,
        });
      }
    });
  };

  if (storeLoading || menuLoading || orderLoading) return (
      <div className="p-6 space-y-6">
        <div className="flex gap-4 items-center">
            <Skeleton className="h-16 w-16 rounded-2xl" />
            <div className="space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-20" />
            </div>
        </div>
        <Skeleton className="h-10 w-full rounded-xl" />
        <div className="grid grid-cols-2 gap-4"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>
      </div>
  );
  if (!store || !menu) return <div className="p-12 text-center opacity-50">Menu unavailable.</div>;
  
  const isTableMode = !!tableNumber;
  const isHomeMode = !tableNumber;

  const isBilledTable = isTableMode && order?.status === 'Billed';
  const isCompletedTable = isTableMode && order?.status === 'Completed';
  
  const isTrackingHome = isHomeMode && ['Pending', 'Processing', 'Out for Delivery'].includes(order?.status || '');
  const isDeliveredHome = isHomeMode && ['Delivered', 'Completed'].includes(order?.status || '');

  const theme = menu.theme;

  return (
    <>
      {selectedItemForIngredients && (
        <IngredientsDialog
          open={!!selectedItemForIngredients}
          onClose={() => setSelectedItemForIngredients(null)}
          dishName={selectedItemForIngredients.name}
          price={selectedItemForIngredients.price}
          isLoading={isFetchingIngredients}
          calories={ingredientsData?.nutrition?.calories || 0}
          protein={ingredientsData?.nutrition?.protein || 0}
          ingredients={(ingredientsData?.ingredients as any) || []}
          onAdd={() => { handleAddItem(selectedItemForIngredients); setSelectedItemForIngredients(null); }}
        />
      )}

      {/* ADDRESS/DETAILS DIALOG */}
      <Dialog open={isAddressMode} onOpenChange={setIsAddressOpen}>
          <DialogContent className="rounded-3xl">
              <DialogHeader>
                  <DialogTitle>{tableNumber ? 'Confirm Table Details' : 'Order for Home Delivery'}</DialogTitle>
                  <DialogDescription>Please provide your contact information to start your bill.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                  <div className="space-y-2">
                      <Label>Your Name</Label>
                      <Input placeholder="Enter your name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                      <Label>Phone Number</Label>
                      <Input placeholder="Enter mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} />
                  </div>
                  {!tableNumber && (
                      <div className="space-y-2">
                          <Label>Delivery Address</Label>
                          <div className="flex gap-2">
                              <Textarea placeholder="Enter full address for delivery" className="min-h-[80px]" value={deliveryAddress} onChange={(e) => setDeliveryAddress(e.target.value)} />
                              <Button type="button" variant="outline" size="icon" className="h-auto w-12 rounded-xl shrink-0" onClick={handleGetLocation} disabled={isFetchingLocation}>
                                  {isFetchingLocation ? <Loader2 className="h-4 w-4 animate-spin"/> : <LocateFixed className="h-5 w-5 text-primary" />}
                              </Button>
                          </div>
                          <p className="text-[10px] text-muted-foreground">Tap the GPS icon to automatically pin your current location.</p>
                      </div>
                  )}
              </div>
              <DialogFooter>
                  <Button onClick={saveDetailsAndOrder} className="w-full h-12 rounded-2xl font-bold shadow-lg bg-primary text-white">
                      <Save className="mr-2 h-4 w-4" /> Save & Continue
                  </Button>
              </DialogFooter>
          </DialogContent>
      </Dialog>

      <div className="min-h-screen pb-24" style={{ backgroundColor: theme?.backgroundColor }}>
          <div className="container mx-auto py-6 px-4 md:px-6 max-w-2xl">
            <div className="space-y-6">
              
              {/* COMPACT HEADER */}
              <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 min-w-0">
                    {store.imageUrl && (
                        <div className="relative h-12 w-12 rounded-2xl overflow-hidden border shrink-0 shadow-sm" style={{ borderColor: theme?.primaryColor + '20' }}>
                            <Image src={store.imageUrl} alt={store.name} fill className="object-cover" />
                        </div>
                    )}
                    <div className="min-w-0">
                        <h1 className="text-base font-black font-headline truncate leading-tight" style={{ color: theme?.primaryColor }}>{store.name}</h1>
                        <div className="flex items-center gap-2 mt-0.5">
                            {tableNumber ? (
                                <Badge className="px-1.5 py-0 text-[8px] font-black rounded-sm uppercase tracking-widest" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>Table {tableNumber}</Badge>
                            ) : (
                                <Badge className="px-1.5 py-0 text-[8px] font-black rounded-sm uppercase tracking-widest bg-blue-500 text-white border-0">Home Delivery</Badge>
                            )}
                            <button onClick={handleClearSession} className="text-[8px] font-bold opacity-40 hover:opacity-100 uppercase tracking-tighter" style={{ color: theme?.textColor }}>Change Mode</button>
                        </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isSearchOpen ? (
                        <div className="relative flex items-center">
                            <Input autoFocus placeholder="Search..." className="h-8 w-28 pr-8 rounded-xl text-[10px] font-bold border-2" style={{ borderColor: theme?.primaryColor + '30', backgroundColor: 'rgba(255,255,255,0.1)', color: theme?.textColor }} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
                            <button className="absolute right-2" style={{ color: theme?.textColor }} onClick={() => { setIsSearchOpen(false); setSearchTerm(''); }}><X className="h-3 w-3" /></button>
                        </div>
                    ) : (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/5 border border-white/5" onClick={() => setIsSearchOpen(true)}><Search className="h-3.5 w-3.5" style={{ color: theme?.primaryColor }} /></Button>
                    )}
                    {canInstall && (
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-white/5 border border-white/5" onClick={triggerInstall}>
                            <Download className="h-3.5 w-3.5" style={{ color: theme?.primaryColor }} />
                        </Button>
                    )}
                  </div>
              </div>

              {/* LOGIC FOR DIFFERENT SCREEN STATES */}
              <div className="space-y-6">
                {isCompletedTable || isDeliveredHome ? (
                    <Card className="rounded-[2.5rem] border-0 shadow-2xl" style={{ backgroundColor: theme?.primaryColor + '05' }}>
                        <CardContent className="text-center py-16 px-8">
                            <div className="mx-auto h-20 w-20 flex items-center justify-center rounded-full mb-6 bg-white/5 border border-white/10 shadow-xl"><Check className="h-10 w-10" style={{ color: theme?.primaryColor }} /></div>
                            <h2 className="text-2xl font-black mb-3" style={{color: theme?.textColor}}>Thank You!</h2>
                            <p className="text-sm font-bold opacity-60 leading-relaxed" style={{color: theme?.textColor}}>{tableNumber ? 'Your visit is complete. We hope to see you again soon!' : 'Your order has been delivered. Enjoy your meal!'}</p>
                            <div className="flex flex-col gap-3 mt-8">
                                <Button onClick={startNewSession} className="rounded-xl h-12 px-8 uppercase font-black text-[10px] tracking-widest shadow-lg" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>
                                    <PlusCircle className="mr-2 h-4 w-4" /> Start New Order
                                </Button>
                                <Button asChild variant="outline" className="rounded-xl h-12 px-8 uppercase font-black text-[10px] tracking-widest" style={{ color: theme?.primaryColor, borderColor: theme?.primaryColor + '20' }}>
                                    <Link href="/">Browse All Shops</Link>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        {isBilledTable && (
                            <Card className="rounded-3xl border-0 shadow-xl overflow-hidden mb-6" style={{ backgroundColor: theme?.primaryColor + '10' }}>
                                <CardContent className="p-6 text-center">
                                    <div className="flex items-center justify-center gap-3 mb-2" style={{ color: theme?.primaryColor }}>
                                        <Receipt className="h-6 w-6" />
                                        <h2 className="text-xl font-black uppercase tracking-tight">Bill Requested</h2>
                                    </div>
                                    <p className="text-[10px] font-black uppercase opacity-40 mb-4" style={{ color: theme?.textColor }}>Table {tableNumber}</p>
                                    <div className="bg-white/40 p-4 rounded-2xl backdrop-blur-sm">
                                        <p className="text-xs font-bold opacity-60 mb-1" style={{ color: theme?.textColor }}>Bill Amount</p>
                                        <p className="text-3xl font-black" style={{ color: theme?.primaryColor }}>₹{order?.totalAmount.toFixed(2)}</p>
                                    </div>
                                    <p className="text-[9px] font-black uppercase tracking-[0.2em] mt-4 opacity-40" style={{ color: theme?.textColor }}>Visit the counter to pay. You can still add more items below.</p>
                                </CardContent>
                            </Card>
                        )}

                        {isTrackingHome && <LiveOrderTracker order={order!} theme={theme} />}

                        {/* CATEGORY BAR */}
                        <ScrollArea className="w-full whitespace-nowrap pb-2">
                            <div className="flex gap-2">
                                <Button variant="ghost" size="sm" className={cn("rounded-lg px-3 h-7 font-black text-[9px] uppercase tracking-widest border transition-all active:scale-95", !selectedCategory ? "shadow-md border-transparent" : "opacity-40 border-white/10")} style={{ backgroundColor: !selectedCategory ? theme?.primaryColor : 'transparent', color: !selectedCategory ? theme?.backgroundColor : theme?.primaryColor }} onClick={() => setSelectedCategory(null)}>All</Button>
                                {availableCategories.map(cat => (
                                    <Button key={cat} variant="ghost" size="sm" className={cn("rounded-lg px-3 h-7 font-black text-[9px] uppercase tracking-widest border transition-all active:scale-95", selectedCategory === cat ? "shadow-md border-transparent" : "opacity-40 border-white/10")} style={{ backgroundColor: selectedCategory === cat ? theme?.primaryColor : 'transparent', color: selectedCategory === cat ? theme?.backgroundColor : theme?.primaryColor }} onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}>{cat}</Button>
                                ))}
                            </div>
                            <ScrollBar orientation="horizontal" className="hidden" />
                        </ScrollArea>

                        {/* INSTALL PROMPT BANNER */}
                        {canInstall && (
                            <Card className="rounded-2xl border-dashed border-2 shadow-sm" style={{ borderColor: theme?.primaryColor + '40', backgroundColor: theme?.primaryColor + '05' }}>
                                <CardContent className="p-4 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="bg-primary/10 p-2 rounded-xl" style={{ backgroundColor: theme?.primaryColor + '20' }}>
                                            <Download className="h-5 w-5" style={{ color: theme?.primaryColor }} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black uppercase tracking-wider" style={{ color: theme?.primaryColor }}>Quick Access</p>
                                            <p className="text-xs font-bold leading-tight" style={{ color: theme?.textColor }}>Add {store.name} to Home Screen</p>
                                        </div>
                                    </div>
                                    <Button onClick={triggerInstall} size="sm" className="h-8 px-4 rounded-lg font-black text-[9px] uppercase tracking-widest" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>
                                        Install
                                    </Button>
                                </CardContent>
                            </Card>
                        )}

                        {Object.entries(groupedMenu).sort(([a], [b]) => a.localeCompare(b)).map(([category, items]) => (
                            <div key={category} className="space-y-2">
                                <h2 className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 px-1" style={{ color: theme?.textColor }}>{category}</h2>
                                <div className="grid gap-2">
                                    {items.map((item, index) => {
                                        const isRecentlyAdded = recentlyAdded.has(item.id);
                                        return (
                                        <Card key={item.id || index} className="flex justify-between items-center p-3 shadow-sm rounded-xl transition-all active:scale-[0.98] border" style={{ backgroundColor: 'transparent', borderColor: theme?.primaryColor + '15' }}>
                                            <div className="flex-1 pr-4 min-w-0">
                                                <p className="font-bold text-xs leading-tight truncate mb-0.5" style={{ color: theme?.textColor }}>{item.name}</p>
                                                <p className="text-[10px] font-black" style={{color: theme?.primaryColor}}>₹{item.price.toFixed(2)}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" onClick={() => handleShowIngredients(item)}><Eye className="h-4 w-4" style={{ color: theme?.textColor }} /></Button>
                                                <Button onClick={() => handleAddItem(item)} disabled={isAdding || isRecentlyAdded} className={cn("w-16 h-8 rounded-lg text-[9px] uppercase tracking-widest font-black shadow-sm transition-all", isRecentlyAdded ? "bg-green-600 border-0" : "")} style={{ backgroundColor: isRecentlyAdded ? '' : theme?.primaryColor, color: theme?.backgroundColor }}>{isRecentlyAdded ? <Check className="h-3 w-3" /> : (isAdding ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Add') }</Button>
                                            </div>
                                        </Card>
                                    )})}
                                </div>
                            </div>
                        ))}
                        
                        {Object.keys(groupedMenu).length === 0 && !orderLoading && (
                            <div className="text-center py-24 space-y-4">
                                <Utensils className="mx-auto h-10 w-10 opacity-10" style={{ color: theme?.textColor }} />
                                <p className="text-[10px] font-bold opacity-30 uppercase tracking-widest" style={{ color: theme?.textColor }}>No dishes found</p>
                            </div>
                        )}
                    </>
                )}
              </div>
            </div>
          </div>
          
          {itemCount > 0 && ['Pending', 'Processing', 'Out for Delivery', 'Billed', 'Draft'].includes(order?.status || '') && (
               <Sheet>
                  <SheetTrigger asChild>
                      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-[200px] px-4">
                          <Button className="h-12 w-full rounded-xl shadow-[0_15px_40px_rgba(0,0,0,0.3)] text-[10px] font-black uppercase tracking-widest transition-transform active:scale-95 border-0 bg-primary hover:bg-primary/90 text-white" style={{ backgroundColor: theme?.primaryColor, color: theme?.backgroundColor }}>
                              <Receipt className="mr-2 h-4 w-4" /> View Bill <Badge className="ml-2 h-5 min-w-[20px] rounded-md text-[9px] font-black flex items-center justify-center shadow-inner" style={{ backgroundColor: theme?.backgroundColor, color: theme?.primaryColor }}>{itemCount}</Badge>
                          </Button>
                      </div>
                  </SheetTrigger>
                  <SheetContent side="bottom" className="h-[70vh] rounded-t-[2.5rem] p-0 border-0 overflow-hidden shadow-[0_-15px_50px_rgba(0,0,0,0.25)]">
                      <LiveBillSheet orderId={order!.id} theme={theme} />
                  </SheetContent>
              </Sheet>
          )}
        </div>
    </>
  );
}
