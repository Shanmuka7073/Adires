'use client';

import { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import type { CartItem, Product, ProductVariant } from './types';
import { useToast } from '@/hooks/use-toast';

export interface UnidentifiedCartItem {
  id: string;
  term: string;
  status: 'pending' | 'failed';
}


interface CartContextType {
  cartItems: CartItem[];
  unidentifiedItems: UnidentifiedCartItem[];
  addItem: (product: Product, variant: ProductVariant, quantity?: number) => void;
  addIdentifiedItem: (product: Product, variant: ProductVariant, quantity: number, originalTermId: string) => void;
  removeItem: (variantSku: string) => void;
  updateQuantity: (variantSku: string, quantity: number) => void;
  addUnidentifiedItem: (term: string) => string;
  updateUnidentifiedItem: (id: string, status: 'failed') => void;
  removeUnidentifiedItem: (id: string) => void;
  clearCart: () => void;
  cartCount: number;
  cartTotal: number;
  activeStoreId: string | null;
  setActiveStoreId: (storeId: string | null) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [cartItems, setCartItemsState] = useState<CartItem[]>([]);
  const [unidentifiedItems, setUnidentifiedItems] = useState<UnidentifiedCartItem[]>([]);
  const [activeStoreId, setActiveStoreIdState] = useState<string | null>(null);

  const { toast } = useToast();

  useEffect(() => {
    try {
      const storedCart = localStorage.getItem('localbasket-cart');
      const storedStoreId = localStorage.getItem('localbasket-active-store');
      if (storedCart) {
        setCartItemsState(JSON.parse(storedCart));
      }
      if (storedStoreId) {
        setActiveStoreIdState(JSON.parse(storedStoreId));
      }
    } catch (error) {
      console.error("Failed to parse cart from localStorage", error);
    }
  }, []);

  const setCartItems = (items: CartItem[] | ((prev: CartItem[]) => CartItem[])) => {
    setCartItemsState(prevItems => {
        const newItems = typeof items === 'function' ? items(prevItems) : items;
        try {
            localStorage.setItem('localbasket-cart', JSON.stringify(newItems));
        } catch (error) {
            console.error("Failed to save cart to localStorage", error);
        }
        return newItems;
    });
  };

  const setActiveStoreId = (storeId: string | null) => {
      setActiveStoreIdState(storeId);
      try {
          if (storeId) {
              localStorage.setItem('localbasket-active-store', JSON.stringify(storeId));
          } else {
              localStorage.removeItem('localbasket-active-store');
          }
      } catch (error) {
           console.error("Failed to save active storeId to localStorage", error);
      }
  }


  const removeUnidentifiedItem = useCallback((id: string) => {
      setUnidentifiedItems(prev => {
        const newItems = prev.filter(item => item.id !== id);
        if (newItems.length === 0 && cartItems.length === 0) {
            setActiveStoreId(null);
        }
        return newItems;
      });
  }, [cartItems.length]);


  const addItem = useCallback((product: Product, variant: ProductVariant, quantity = 1) => {
    setCartItems((prevItems) => {
        if (prevItems.length > 0 && activeStoreId && product.storeId !== activeStoreId) {
            if (window.confirm("You have items from another store. Do you want to clear your current cart and start a new one with this item?")) {
                setActiveStoreId(product.storeId);
                toast({
                    title: 'New cart started!',
                    description: `${product.name} (${variant.weight}) has been added.`,
                });
                return [{ product, variant, quantity }];
            }
            return prevItems;
        }

        if (prevItems.length === 0) {
            setActiveStoreId(product.storeId);
        }

        const existingItem = prevItems.find((item) => item.variant.sku === variant.sku);
        let newItems;
        if (existingItem) {
            newItems = prevItems.map((item) =>
                item.variant.sku === variant.sku
                    ? { ...item, quantity: item.quantity + quantity }
                    : item
            );
        } else {
            newItems = [...prevItems, { product, variant, quantity }];
        }

        toast({
            title: 'Item added to cart',
            description: `${product.name} (${variant.weight}) has been added.`,
        });

        return newItems;
    });
  }, [toast, activeStoreId]);

  const removeItem = useCallback((variantSku: string) => {
    setCartItems((prevItems) => {
        const newItems = prevItems.filter((item) => item.variant.sku !== variantSku);
        if (newItems.length === 0 && unidentifiedItems.length === 0) {
            setActiveStoreId(null);
        }
        return newItems;
    });
    toast({
      title: 'Item removed from cart',
      variant: 'destructive'
    });
  }, [toast, unidentifiedItems.length]);



  const addIdentifiedItem = useCallback((product: Product, variant: ProductVariant, quantity: number, originalTermId: string) => {
    removeUnidentifiedItem(originalTermId);
    addItem(product, variant, quantity);
  }, [addItem, removeUnidentifiedItem]);

  const updateQuantity = useCallback((variantSku: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(variantSku);
      return;
    }
    setCartItems((prevItems) =>
      prevItems.map((item) =>
        item.variant.sku === variantSku ? { ...item, quantity } : item
      )
    );
  }, [removeItem]);

  const addUnidentifiedItem = useCallback((term: string) => {
    const newItem: UnidentifiedCartItem = {
        id: `unidentified-${Date.now()}-${Math.random()}`,
        term,
        status: 'pending',
    };
    setUnidentifiedItems(prev => [...prev, newItem]);
    return newItem.id;
  }, []);

  const updateUnidentifiedItem = useCallback((id: string, status: 'failed') => {
      setUnidentifiedItems(prev => prev.map(item => item.id === id ? { ...item, status } : item));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
    setUnidentifiedItems([]);
    setActiveStoreId(null);
  }, []);

  const cartCount = cartItems.reduce((count, item) => count + item.quantity, 0);

  const cartTotal = cartItems.reduce(
    (total, item) => total + item.variant.price * item.quantity,
    0
  );

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
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
