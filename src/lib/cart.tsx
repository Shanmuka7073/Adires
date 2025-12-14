
'use client';

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from 'react';

import type { CartItem, Product, ProductVariant, UnidentifiedCartItem } from './types';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';
import { signInAnonymously } from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  Timestamp,
} from 'firebase/firestore';

interface CartContextType {
  cartItems: CartItem[];
  unidentifiedItems: UnidentifiedCartItem[];
  addItem: (
    product: Product,
    variant: ProductVariant,
    quantity?: number,
    tableNumber?: string,
    sessionId?: string
  ) => void;
  removeItem: (sku: string) => void;
  updateQuantity: (sku: string, newQuantity: number) => void;
  clearCart: () => void;
  addUnidentifiedItem: (term: string) => string;
  updateUnidentifiedItem: (id: string, status: 'pending' | 'failed' | 'identified') => void;
  removeUnidentifiedItem: (id: string) => void;
  addIdentifiedItem: (product: Product, variant: ProductVariant, originalTerm: string) => void;
  placeRestaurantOrder: () => Promise<void>;
  cartCount: number;
  cartTotal: number;
  activeStoreId: string | null;
  setActiveStoreId: (id: string | null) => void;
}


const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { auth, firestore, user } = useFirebase();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [unidentifiedItems, setUnidentifiedItems] = useState<UnidentifiedCartItem[]>([]);

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
        const key = `${product.id}_${variant.sku}`;
        const existing = prev.find(
          i => `${i.product.id}_${i.variant.sku}` === key
        );

        if (existing) {
          return prev.map(i =>
            `${i.product.id}_${i.variant.sku}` === key
              ? { ...i, quantity: i.quantity + quantity }
              : i
          );
        }

        return [...prev, { product, variant, quantity, tableNumber, sessionId }];
      });

      toast({
        title: 'Added to Cart',
        description: `${product.name} (${variant.weight}) × ${quantity}`,
      });
    },
    [toast]
  );
  
  const removeItem = (sku: string) => {
    setCartItems(prev => prev.filter(item => item.variant.sku !== sku));
  };
  
  const updateQuantity = (sku: string, newQuantity: number) => {
    if (newQuantity <= 0) {
      removeItem(sku);
      return;
    }
    setCartItems(prev => prev.map(item => item.variant.sku === sku ? { ...item, quantity: newQuantity } : item));
  };
  
  const addUnidentifiedItem = (term: string) => {
    const id = `unidentified-${Date.now()}`;
    setUnidentifiedItems(prev => [...prev, { id, term, status: 'pending' }]);
    return id;
  };

  const updateUnidentifiedItem = (id: string, status: 'pending' | 'failed' | 'identified') => {
    setUnidentifiedItems(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  };

  const removeUnidentifiedItem = (id: string) => {
    setUnidentifiedItems(prev => prev.filter(item => item.id !== id));
  };
  
  const addIdentifiedItem = (product: Product, variant: ProductVariant, originalTerm: string) => {
    const productWithContext = {
      ...product,
      isAiAssisted: true,
      matchedAlias: originalTerm,
    };
    addItem(productWithContext, variant, 1);
  };


  const clearCart = () => setCartItems([]);

  /* ---------------- PLACE ORDER (CORRECT BILL LOGIC) ---------------- */
  const placeRestaurantOrder = async () => {
    if (!firestore || cartItems.length === 0) return;

    let currentUser = user;
    if (!currentUser && auth) {
      currentUser = (await signInAnonymously(auth)).user;
    }

    const base = cartItems[0];
    if (!base.sessionId || !base.product.storeId) {
      toast({ variant: 'destructive', title: 'Invalid session' });
      return;
    }

    const orderId = `${base.product.storeId}_${base.sessionId}`;
    const orderRef = doc(firestore, 'orders', orderId);
    const snap = await getDoc(orderRef);

    // Build merged items map
    const newItemsMap: Record<string, any> = {};

    cartItems.forEach(ci => {
      const key = `${ci.product.id}_${ci.variant.sku}`;
      if (!newItemsMap[key]) {
        newItemsMap[key] = {
          productId: ci.product.id,
          productName: ci.product.name,
          variantSku: ci.variant.sku,
          variantWeight: ci.variant.weight,
          price: ci.variant.price,
          quantity: 0,
        };
      }
      newItemsMap[key].quantity += ci.quantity;
    });

    const newItems = Object.values(newItemsMap);
    const addedTotal = newItems.reduce(
      (s: number, i: any) => s + i.price * i.quantity,
      0
    );

    if (!snap.exists()) {
      await setDoc(orderRef, {
        id: orderId,
        storeId: base.product.storeId,
        sessionId: base.sessionId,
        tableNumber: base.tableNumber,
        userId: 'guest',
        customerName: `Table ${base.tableNumber}`,
        items: newItems,
        totalAmount: addedTotal,
        status: 'Pending',
        orderDate: Timestamp.now(), // 🔒 NEVER CHANGE
        updatedAt: Timestamp.now(),
      });
    } else {
      const existing = snap.data();
      const merged: Record<string, any> = {};

      existing.items.forEach((i: any) => {
        merged[`${i.productId}_${i.variantSku}`] = { ...i };
      });

      newItems.forEach((i: any) => {
        const key = `${i.productId}_${i.variantSku}`;
        if (merged[key]) {
          merged[key].quantity += i.quantity;
        } else {
          merged[key] = i;
        }
      });

      await setDoc(
        orderRef,
        {
          items: Object.values(merged),
          totalAmount: existing.totalAmount + addedTotal,
          status: 'Pending',
          updatedAt: Timestamp.now(),
        },
        { merge: true }
      );
    }

    clearCart();
    toast({ title: 'Order added to bill' });
  };

  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0);
  const cartTotal = cartItems.reduce((t, i) => t + i.quantity * i.variant.price, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        unidentifiedItems,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        addUnidentifiedItem,
        updateUnidentifiedItem,
        removeUnidentifiedItem,
        addIdentifiedItem,
        placeRestaurantOrder,
        cartCount,
        cartTotal,
        activeStoreId,
        setActiveStoreId,
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
