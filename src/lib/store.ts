
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, limit } from 'firebase/firestore';
import { Store, Product, ProductPrice, CommandGroup } from './types';
import { Locales } from './locales';
import { generalCommands as defaultGeneralCommands } from './locales/commands';

export interface AppState {
  stores: Store[];
  isFetchingStores: boolean;
  isInitialized: boolean;
  language: string;
  activeStoreId: string | null;
  deviceId: string | null; 
  isCartOpen: boolean;
  readCount: number;
  writeCount: number;
  
  // Actions
  incrementReadCount: (count?: number) => void;
  incrementWriteCount: (count?: number) => void;
  setLanguage: (lang: string) => void;
  setActiveStoreId: (storeId: string | null) => void;
  setDeviceId: (id: string) => void;
  setCartOpen: (open: boolean) => void;
  resetApp: () => void;
  
  // Fetching
  fetchInitialData: (db: Firestore) => Promise<void>;
  
  // Helpers
  locales: Locales;
  commands: Record<string, CommandGroup>;
  masterProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
}

/**
 * REFACTORED APP STORE
 * Removed User Profile and Account Type from persistence.
 * LocalStorage is now only used for non-critical UI preferences (Language, DeviceID).
 */
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      stores: [],
      masterProducts: [],
      productPrices: {},
      locales: {},
      commands: defaultGeneralCommands,
      isFetchingStores: false,
      isInitialized: false,
      language: 'en',
      activeStoreId: null,
      deviceId: null, 
      isCartOpen: false,
      readCount: 0,
      writeCount: 0,

      incrementReadCount: (count = 1) => set(state => ({ readCount: state.readCount + count })),
      incrementWriteCount: (count = 1) => set(state => ({ writeCount: state.writeCount + count })),

      setLanguage: (lang: string) => set({ language: lang }),
      setDeviceId: (id: string) => set({ deviceId: id }),
      setActiveStoreId: (storeId: string | null) => set({ activeStoreId: storeId }),
      setCartOpen: (open: boolean) => set({ isCartOpen: open }),

      resetApp: () => {
          set({
              stores: [],
              isInitialized: false,
              activeStoreId: null,
              isCartOpen: false,
              isFetchingStores: false,
              readCount: 0,
              writeCount: 0,
          });
          if (typeof window !== 'undefined') {
              localStorage.removeItem('adires-ops-v6');
          }
      },

      fetchInitialData: async (db: Firestore) => {
        if (get().isFetchingStores) return;
        set({ isFetchingStores: true });
        
        try {
          const storesSnap = await getDocs(query(collection(db, 'stores'), limit(50)));
          const storesList = storesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Store));
          
          set({
            stores: storesList,
            isInitialized: true,
            isFetchingStores: false,
            readCount: get().readCount + storesSnap.docs.length
          });
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          set({ isFetchingStores: false, isInitialized: true });
        }
      },

      fetchProductPrices: async () => Promise.resolve(),
    }),
    {
      name: 'adires-ops-v6', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
          language: state.language,
          deviceId: state.deviceId,
      }),
    }
  )
);
