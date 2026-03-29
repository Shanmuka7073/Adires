
'use client';

import {
  createContext,
  useContext,
  useState,
  ReactNode,
  useCallback,
} from 'react';

import type { CartItem, Product, ProductVariant, UnidentifiedCartItem, CustomizationOption } from './types';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase';

interface CartContextType {
  cartItems: CartItem[];
  unidentifiedItems: UnidentifiedCartItem[];
  addItem: (
    product: Product,
    variant: ProductVariant,
    quantity?: number,
    tableNumber?: string,
    sessionId?: string,
    customizations?: Record<string, CustomizationOption[]>
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
  sessionId: string | null;
  setSessionId: (id: string | null) => void;
}


const CartContext = createContext<CartContextType | undefined>(undefined);

// Utility to play a crisp "tick" sound using Web Audio API
export const playTickSound = () => {
  if (typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    
    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.type = 'sine';
    // Short high frequency for a "tick"
    oscillator.frequency.setValueAtTime(1500, audioCtx.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);

    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);

    oscillator.start();
    oscillator.stop(audioCtx.currentTime + 0.05);
  } catch (e) {
    // Fail silently if audio is blocked by browser policy
  }
};

export function CartProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [activeStoreId, setActiveStoreId] = useState<string | null>(null);
  const [unidentifiedItems, setUnidentifiedItems] = useState<UnidentifiedCartItem[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);

  /* ---------------- ADD ITEM ---------------- */
  const addItem = useCallback(
    (
      product: Product,
      variant: ProductVariant,
      quantity = 1,
      tableNumber?: string,
      sId?: string,
      customizations?: Record<string, CustomizationOption[]>
    ) => {
      // Play interaction sound
      playTickSound();

      setCartItems(prev => {
        const customsString = customizations ? JSON.stringify(customizations) : '';
        const uniqueKey = `${product.id}_${variant.sku}_${customsString}`;
        
        const existing = prev.find(i => {
            const iCustoms = i.selectedCustomizations ? JSON.stringify(i.selectedCustomizations) : '';
            const iKey = `${i.product.id}_${i.variant.sku}_${iCustoms}`;
            return iKey === uniqueKey;
        });

        if (existing) {
          return prev.map(i => {
            const iCustoms = i.selectedCustomizations ? JSON.stringify(i.selectedCustomizations) : '';
            const iKey = `${i.product.id}_${i.variant.sku}_${iCustoms}`;
            return iKey === uniqueKey
              ? { ...i, quantity: i.quantity + quantity }
              : i
          });
        }

        return [...prev, { product, variant, quantity, tableNumber, sessionId: sId || sessionId || undefined, selectedCustomizations: customizations }];
      });

      toast({
        title: 'Added to Order',
        description: `${product.name} × ${quantity}`,
      });
    },
    [toast, sessionId]
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
        sessionId,
        setSessionId
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
