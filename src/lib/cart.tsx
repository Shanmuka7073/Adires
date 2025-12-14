
'use client';

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from 'react';

import type { CartItem, Product, ProductVariant, OrderItem } from './types';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  Timestamp,
  arrayUnion,
  increment,
  collection,
} from 'firebase/firestore';

interface CartContextType {
  cartItems: CartItem[];
  addItem: (
    product: Product,
    variant: ProductVariant,
    quantity?: number,
    tableNumber?: string,
    sessionId?: string
  ) => void;
  clearCart: () => void;
  placeRestaurantOrder: () => Promise<void>;
  // These are now part of the default useCart return but are not used by the new restaurant flow
  cartCount: number;
  cartTotal: number;
  unidentifiedItems: any[];
  activeStoreId: string | null;
  setActiveStoreId: (id: string | null) => void;
  removeItem: (sku: string) => void;
  updateQuantity: (sku: string, qty: number) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { auth, firestore, user } = useFirebase();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);


  /* ---------------- ADD ITEM ---------------- */
  const addItem = useCallback(
    (
      product: Product,
      variant: ProductVariant,
      quantity = 1,
      tableNumber?: string,
      sessionId?: string
    ) => {
      setCartItems(prev => {
        const existing = prev.find(i => i.variant.sku === variant.sku);
        if (existing) {
          return prev.map(i =>
            i.variant.sku === variant.sku
              ? { ...i, quantity: i.quantity + quantity }
              : i
          );
        }
        return [...prev, { product, variant, quantity, tableNumber, sessionId }];
      });

      toast({
        title: 'Added',
        description: `${product.name} × ${quantity}`,
      });
    },
    [toast]
  );

  /* ---------------- CLEAR CART (UI ONLY) ---------------- */
  const clearCart = () => setCartItems([]);

  /* ---------------- PLACE ORDER (UPSERT) ---------------- */
  const placeRestaurantOrder = async () => {
    if (!firestore || cartItems.length === 0) return;

    let currentUser = user;
    if (!currentUser && auth) {
      currentUser = (await signInAnonymously(auth)).user;
    }

    const item = cartItems[0];
    if (!item.sessionId || !item.product.storeId) {
        toast({variant: 'destructive', title: 'Error', description: 'Missing session or store information.'});
        return;
    }

    const sessionId = item.sessionId!;
    const orderId = `${item.product.storeId}_${sessionId}`;

    const orderRef = doc(firestore, 'orders', orderId);
    const snap = await getDoc(orderRef);

    const newItems: OrderItem[] = cartItems.map(ci => ({
      // This ID is for the subcollection, but we are not using a subcollection here.
      // It's here to satisfy the type, but can be simplified later.
      id: doc(collection(firestore, `orders/${orderId}/orderItems`)).id,
      orderId: orderId,
      productId: ci.product.id,
      productName: ci.product.name,
      quantity: ci.quantity,
      price: ci.variant.price,
      variantSku: ci.variant.sku,
      variantWeight: ci.variant.weight,
    }));

    const totalOfNewItems = newItems.reduce(
        (s, i) => s + i.price * i.quantity,
        0
    );

    if (!snap.exists()) {
      // 🔥 FIRST ORDER (create bill)
      await setDoc(orderRef, {
        id: orderId,
        storeId: item.product.storeId,
        sessionId,
        tableNumber: item.tableNumber,
        userId: 'guest',
        customerName: `Table ${item.tableNumber || 'Guest'}`,
        items: newItems,
        totalAmount: totalOfNewItems,
        status: 'Pending',
        orderDate: Timestamp.now(),
      });
    } else {
      // 🔥 APPEND TO SAME BILL
      await setDoc(
        orderRef,
        {
          items: arrayUnion(...newItems),
          totalAmount: increment(totalOfNewItems),
          // Ensure status is Pending if it was previously Completed/Billed
          status: 'Pending',
          orderDate: Timestamp.now(), // Update timestamp to show recent activity
        },
        { merge: true }
      );
    }

    clearCart(); // UI only
    toast({ title: 'Order sent to kitchen' });
  };
  
  // Dummy implementations for non-restaurant cart functions
  const removeItem = (sku: string) => {
    setCartItems(prev => prev.filter(item => item.variant.sku !== sku));
  };
  const updateQuantity = (sku: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(sku);
        return;
      }
      setCartItems(prev =>
        prev.map(i => (i.variant.sku === sku ? { ...i, quantity } : i))
      );
  }

  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0);
  const cartTotal = cartItems.reduce((t, i) => t + i.quantity * i.variant.price, 0);


  return (
    <CartContext.Provider
      value={{
        cartItems,
        addItem,
        clearCart,
        placeRestaurantOrder,
        cartCount,
        cartTotal,
        unidentifiedItems: [], // Not used in this flow
        activeStoreId,
        setActiveStoreId,
        removeItem,
        updateQuantity
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
