
'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect, useTransition } from 'react';
import type { CartItem, Product, ProductVariant, OrderItem, Order } from './types';
import { useToast } from '@/hooks/use-toast';
import { placeRestaurantOrder as placeRestaurantOrderAction } from '@/app/actions';
import { useFirebase } from '@/firebase';
import { useRouter } from 'next/navigation';
import { signInAnonymously } from 'firebase/auth';
import { doc, writeBatch } from 'firebase/firestore';

export interface UnidentifiedCartItem {
  id: string;
  term: string;
  status: 'pending' | 'failed';
}

interface CartContextType {
  cartItems: CartItem[];
  unidentifiedItems: UnidentifiedCartItem[];
  addItem: (product: Product, variant: ProductVariant, quantity?: number, tableNumber?: string, sessionId?: string) => void;
  addIdentifiedItem: (product: Product, variant: ProductVariant, quantity: number, originalTermId: string) => void;
  removeItem: (variantSku: string) => void;
  updateQuantity: (variantSku: string, quantity: number) => void;
  addUnidentifiedItem: (term: string) => string;
  updateUnidentifiedItem: (id: string, status: 'failed') => void;
  removeUnidentifiedItem: (id: string) => void;
  clearCart: () => void;
  placeRestaurantOrder: () => Promise<{ success: boolean; orderId?: string; error?: string; }>;
  cartCount: number;
  cartTotal: number;
  activeStoreId: string | null;
  setActiveStoreId: (storeId: string | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const { user, auth, firestore } = useFirebase();
  const router = useRouter();

  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [unidentifiedItems, setUnidentifiedItems] = useState<UnidentifiedCartItem[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);

  /* ------------------ Load from storage ------------------ */
  useEffect(() => {
    try {
      const cart = localStorage.getItem('localbasket-cart');
      const store = localStorage.getItem('localbasket-active-store');
      if (cart) setCartItems(JSON.parse(cart));
      if (store) setActiveStoreId(JSON.parse(store));
    } catch {}
  }, []);

  /* ------------------ Persist storage ------------------ */
  useEffect(() => {
    localStorage.setItem('localbasket-cart', JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    if (activeStoreId) {
      localStorage.setItem('localbasket-active-store', JSON.stringify(activeStoreId));
    } else {
      localStorage.removeItem('localbasket-active-store');
    }
  }, [activeStoreId]);

  /* ------------------ Cart actions ------------------ */

  const addItem = useCallback(
    (product: Product, variant: ProductVariant, quantity = 1, tableNumber?: string, sessionId?: string) => {
      setCartItems(prev => {
        // 🔒 store lock
        if (activeStoreId && product.storeId !== activeStoreId) {
          toast({
            title: 'Different store detected',
            description: 'Please clear cart before ordering from another store.',
            variant: 'destructive',
          });
          return prev;
        }

        // First item
        if (!activeStoreId) {
          setActiveStoreId(product.storeId);
        }

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

      if (!product.isMenuItem) {
        toast({
            title: 'Added to cart',
            description: `${product.name} (${variant.weight})`,
        });
      }
    },
    [activeStoreId, toast]
  );

  const removeItem = useCallback((variantSku: string) => {
    setCartItems(prev => {
      const next = prev.filter(i => i.variant.sku !== variantSku);
      if (next.length === 0 && unidentifiedItems.length === 0) {
        setActiveStoreId(null);
      }
      return next;
    });
  }, [unidentifiedItems.length]);

  const updateQuantity = useCallback(
    (variantSku: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(variantSku);
        return;
      }
      setCartItems(prev =>
        prev.map(i => (i.variant.sku === variantSku ? { ...i, quantity } : i))
      );
    },
    [removeItem]
  );

  const addUnidentifiedItem = useCallback((term: string) => {
    const id = crypto.randomUUID();
    setUnidentifiedItems(prev => [...prev, { id, term, status: 'pending' }]);
    return id;
  }, []);

  const updateUnidentifiedItem = useCallback((id: string, status: 'failed') => {
    setUnidentifiedItems(prev =>
      prev.map(i => (i.id === id ? { ...i, status } : i))
    );
  }, []);

  const removeUnidentifiedItem = useCallback((id: string) => {
    setUnidentifiedItems(prev => prev.filter(i => i.id !== id));
  }, []);

  const addIdentifiedItem = useCallback(
    (product: Product, variant: ProductVariant, quantity: number, originalTermId: string) => {
      removeUnidentifiedItem(originalTermId);
      addItem(product, variant, quantity);
    },
    [addItem, removeUnidentifiedItem]
  );

  const clearCart = useCallback(() => {
    setCartItems([]);
    setUnidentifiedItems([]);
    setActiveStoreId(null);
  }, []);
  
  const placeRestaurantOrder = async () => {
    if (!auth || !firestore || cartItems.length === 0) {
        const errorMsg = "Cannot place order: services not ready or cart is empty.";
        toast({ variant: 'destructive', title: 'Order Failed', description: errorMsg });
        return { success: false, error: errorMsg };
    }

    try {
        let currentUser = user;
        if (!currentUser) {
            const userCredential = await signInAnonymously(auth);
            currentUser = userCredential.user;
        }

        const idToken = await currentUser.getIdToken();
        const firstItem = cartItems[0];
        const storeId = firstItem.product.storeId;
        const sessionId = firstItem.sessionId;
        const tableNumber = firstItem.tableNumber;
        const totalAmount = cartItems.reduce((t, i) => t + i.quantity * i.variant.price, 0);

        const orderData: Omit<Order, 'id' | 'orderDate' | 'items'> = {
            storeId: storeId,
            sessionId: sessionId,
            tableNumber: tableNumber,
            userId: 'guest',
            customerName: `Table ${tableNumber || 'Guest'}`,
            deliveryAddress: "In-store dining",
            deliveryLat: 0,
            deliveryLng: 0,
            phone: '',
            email: '',
            status: 'Billed',
            totalAmount: totalAmount,
        };

        const batch = writeBatch(firestore);

        cartItems.forEach(cartItem => {
            const orderRef = doc(collection(firestore, 'orders'));
            const order: Order = {
                ...orderData,
                id: orderRef.id,
                totalAmount: cartItem.quantity * cartItem.variant.price,
                orderDate: new Date(),
                items: [{
                    id: doc(collection(firestore, `orders/${orderRef.id}/orderItems`)).id,
                    orderId: orderRef.id,
                    productId: cartItem.product.id,
                    productName: cartItem.product.name,
                    quantity: cartItem.quantity,
                    price: cartItem.variant.price,
                    variantSku: cartItem.variant.sku,
                    variantWeight: cartItem.variant.weight,
                }]
            };
            batch.set(orderRef, order);
        });

        await batch.commit();
        clearCart();
        return { success: true, orderId: "restaurant_order" };
        
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Order Failed',
            description: error.message,
        });
        return { success: false, error: error.message };
    }
  };


  const cartCount = cartItems.reduce((n, i) => n + i.quantity, 0);
  const cartTotal = cartItems.reduce((t, i) => t + i.quantity * i.variant.price, 0);

  return (
    <CartContext.Provider
      value={{
        cartItems,
        unidentifiedItems,
        addItem,
        addIdentifiedItem,
        removeItem,
        updateQuantity,
        addUnidentifiedItem,
        updateUnidentifiedItem,
        removeUnidentifiedItem,
        clearCart,
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
