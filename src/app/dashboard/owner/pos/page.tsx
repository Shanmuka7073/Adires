'use client';

import { useState, useMemo, useTransition, useEffect } from 'react';
import { useFirebase, useCollection, useMemoFirebase, errorEmitter, FirestorePermissionError } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp, query, limit } from 'firebase/firestore';
import type { Store, Menu, MenuItem, Order, OrderItem } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Receipt, Loader2, ShoppingBag, ArrowLeft, Plus, Minus } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { useAppStore } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const ADIRES_LOGO = "https://i.ibb.co/fVkfNjkz/file-0000000094f07208b303c1fd91d3731b.png";

/**
 * QUICK POS TERMINAL
 * Updated header to include business branding (Logo & Correct Name).
 */
export default function QuickPOSPage() {
    const { firestore, user } = useFirebase();
    const router = useRouter();
    const { toast } = useToast();
    const { stores, userStore, incrementWriteCount } = useAppStore();
    
    const [searchTerm, setSearchTerm] = useState('');
    const [cart, setCart] = useState<Record<string, { item: MenuItem, qty: number }>>({});
    const [isPlacing, startPlace] = useTransition();

    const myStore = useMemo(() => userStore || stores.find(s => s.ownerId === user?.uid) || null, [userStore, stores, user?.uid]);

    const menuQuery = useMemoFirebase(() => (firestore && myStore) ? query(collection(firestore, `stores/${myStore.id}/menus`), limit(1)) : null, [firestore, myStore]);
    const { data: menus, isLoading: menuLoading } = useCollection<Menu>(menuQuery);
    const menu = menus?.[0];

    const filteredItems = useMemo(() => {
        if (!menu?.items) return [];
        return menu.items.filter(i => 
            i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            i.category.toLowerCase().includes(searchTerm.toLowerCase())
        );
    }, [menu, searchTerm]);

    const addToCart = (item: MenuItem) => {
        setCart(prev => ({
            ...prev,
            [item.id]: { item, qty: (prev[item.id]?.qty || 0) + 1 }
        }));
    };

    const removeFromCart = (itemId: string) => {
        setCart(prev => {
            const newCart = { ...prev };
            if (newCart[itemId].qty > 1) {
                newCart[itemId].qty -= 1;
            } else {
                delete newCart[itemId];
            }
            return newCart;
        });
    };

    const cartItems = Object.values(cart);
    const total = cartItems.reduce((acc, c) => acc + (c.item.price * c.qty), 0);

    const handleGenerateBill = () => {
        if (!firestore || !myStore || cartItems.length === 0) return;

        startPlace(async () => {
            const orderId = `counter-${Date.now()}-${myStore.id}`;
            const orderRef = doc(firestore, 'orders', orderId);
            
            const orderItems: OrderItem[] = cartItems.map(c => ({
                id: crypto.randomUUID(),
                orderId,
                productId: c.item.id,
                menuItemId: c.item.id,
                productName: c.item.name,
                variantSku: `${c.item.id}-pos`,
                variantWeight: '1 pc',
                quantity: c.qty,
                price: c.item.price,
            }));

            const orderData: any = {
                id: orderId,
                storeId: myStore.id,
                customerName: 'Counter Guest',
                orderType: 'counter',
                status: 'Billed', 
                isActive: true,
                orderDate: serverTimestamp(),
                updatedAt: serverTimestamp(),
                items: orderItems,
                totalAmount: total,
                sessionId: `pos-${Date.now()}`,
                userId: 'guest',
                deliveryAddress: 'In-store counter',
                phone: '',
                email: ''
            };

            // OPTIMISTIC NON-BLOCKING WRITE
            setDoc(orderRef, orderData).catch(async (e) => {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: orderRef.path,
                    operation: 'write',
                    requestResourceData: orderData
                }));
            });

            // Immediate UI feedback
            toast({ title: "Bill Ready!", description: `Order #${orderId.slice(-4)} created locally.` });
            incrementWriteCount(1);
            setCart({});
            router.push('/dashboard/owner/orders');
        });
    };

    if (menuLoading) return <div className="p-12 text-center opacity-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></div>;

    return (
        <div className="h-screen flex flex-col bg-[#FDFCF7]">
            <div className="p-4 bg-white border-b flex items-center justify-between gap-4 shrink-0 shadow-sm">
                <div className="flex items-center gap-2 min-w-0">
                    <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full h-10 w-10 shrink-0">
                        <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3 min-w-0">
                        <div className="relative h-9 w-9 rounded-full overflow-hidden border-2 border-primary/10 bg-white shrink-0 shadow-sm">
                            <Image src={myStore?.imageUrl || ADIRES_LOGO} alt="Logo" fill className="object-cover" />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm font-black uppercase tracking-tight truncate leading-none text-gray-950 italic">{myStore?.name || 'Rapid POS'}</h1>
                            <p className="text-[8px] font-bold opacity-40 uppercase mt-1 leading-none">Counter Terminal</p>
                        </div>
                    </div>
                </div>
                <div className="flex-1 max-w-xs relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-30" />
                    <Input 
                        placeholder="Search items..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="h-10 rounded-xl border-2 pl-9 font-bold bg-muted/10 border-black/5"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1 p-3">
                <div className="grid grid-cols-2 xs:grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                    {filteredItems.map(item => (
                        <button 
                            key={item.id}
                            onClick={() => addToCart(item)}
                            className="flex flex-col items-start p-3 bg-white rounded-2xl border-2 border-black/5 shadow-sm active:scale-95 transition-all text-left group hover:border-primary/30"
                        >
                            <p className="text-[10px] font-black uppercase text-gray-950 line-clamp-2 leading-tight h-8">{item.name}</p>
                            <div className="mt-2 flex justify-between items-center w-full">
                                <p className="text-xs font-black text-primary">₹{item.price.toFixed(0)}</p>
                                {cart[item.id] && (
                                    <Badge className="h-5 min-w-[20px] rounded-md font-black text-[9px] bg-primary text-white border-0">
                                        {cart[item.id].qty}
                                    </Badge>
                                )}
                            </div>
                        </button>
                    ))}
                </div>
            </ScrollArea>

            <div className="p-4 bg-white border-t-4 border-black/5 shadow-[0_-10px_40px_-15px_rgba(0,0,0,0.1)] shrink-0">
                <div className="max-w-md mx-auto space-y-4">
                    {cartItems.length > 0 ? (
                        <div className="space-y-3">
                            <div className="flex justify-between items-center px-1">
                                <p className="text-[10px] font-black uppercase opacity-40">Active Bill Manifest</p>
                                <button onClick={() => setCart({})} className="text-[8px] font-black uppercase text-destructive tracking-widest">Clear All</button>
                            </div>
                            <ScrollArea className="max-h-32 rounded-2xl border-2 bg-muted/20">
                                <div className="p-2 space-y-1">
                                    {cartItems.map(c => (
                                        <div key={c.item.id} className="flex justify-between items-center bg-white p-2 rounded-xl text-[10px] font-bold shadow-sm">
                                            <span className="truncate flex-1">{c.item.name}</span>
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2 bg-muted rounded-lg px-1">
                                                    <button onClick={() => removeFromCart(c.item.id)} className="h-5 w-5 flex items-center justify-center"><Minus className="h-3 w-3" /></button>
                                                    <span className="w-4 text-center">{c.qty}</span>
                                                    <button onClick={() => addToCart(c.item)} className="h-5 w-5 flex items-center justify-center"><Plus className="h-3 w-3" /></button>
                                                </div>
                                                <span className="w-12 text-right">₹{c.item.price * c.qty}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                            <Button 
                                onClick={handleGenerateBill}
                                disabled={isPlacing}
                                className="w-full h-14 rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-primary/20 bg-primary text-white"
                            >
                                {isPlacing ? <Loader2 className="animate-spin mr-2 h-5 w-5" /> : <Receipt className="mr-2 h-5 w-5" />}
                                Generate Bill • ₹{total.toFixed(0)}
                            </Button>
                        </div>
                    ) : (
                        <div className="py-6 text-center opacity-30">
                            <ShoppingBag className="h-8 w-8 mx-auto mb-2" />
                            <p className="text-[10px] font-black uppercase tracking-widest">Add items to start bill</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
