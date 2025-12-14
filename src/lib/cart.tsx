
'use client';

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
  useEffect,
} from 'react';

import type { CartItem, Product, ProductVariant, UnidentifiedCartItem, Order } from './types';
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
