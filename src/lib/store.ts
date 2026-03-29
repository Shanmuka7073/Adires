
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { Store, Product, ProductPrice, CommandGroup } from './types';
import { Locales } from './locales';
import { generalCommands as defaultGeneralCommands } from './locales/commands';

export interface AppState {
  stores: Store[];
  userStore: Store | null;
  isFetchingStores: boolean;
  isFetchingUserStore: boolean;
  isInitialized: boolean;
  isUserDataLoaded: boolean;
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
  setUserStore: (store: Store | null) => void;
  setDeviceId: (id: string) => void;
  setCartOpen: (open: boolean) => void;
  resetApp: () => void;
  
  // Fetching
  fetchInitialData: (db: Firestore, userId?: string) => Promise<void>;
  fetchUserStore: (db: Firestore, userId: string) => Promise<void>;
  
  // Helpers
  locales: Locales;
  commands: Record<string, CommandGroup>;
  masterProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
  fetchProductPrices: (db: Firestore, productNames: string[]) => Promise<void>;
}

/**
 * REFACTORED APP STORE
 * Restored fetchUserStore and userStore state while maintaining secure persistence.
 */
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      stores: [],
      userStore: null,
      masterProducts: [],
      productPrices: {},
      locales: {},
      commands: defaultGeneralCommands,
      isFetchingStores: false,
      isFetchingUserStore: false,
      isInitialized: false,
      isUserDataLoaded: false,
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
      setUserStore: (store: Store | null) => set({ userStore: store }),

      resetApp: () => {
          set({
              stores: [],
              userStore: null,
              isInitialized: false,
              isUserDataLoaded: false,
              activeStoreId: null,
              isCartOpen: false,
              isFetchingStores: false,
              isFetchingUserStore: false,
              readCount: 0,
              writeCount: 0,
          });
          if (typeof window !== 'undefined') {
              localStorage.removeItem('adires-ops-v6');
          }
      },

      fetchInitialData: async (db: Firestore, userId?: string) => {
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

          if (userId) {
            await get().fetchUserStore(db, userId);
          } else {
            set({ isUserDataLoaded: true });
          }
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          set({ isFetchingStores: false, isInitialized: true, isUserDataLoaded: true });
        }
      },

      fetchUserStore: async (db: Firestore, userId: string) => {
        if (!userId || get().isFetchingUserStore) return;
        set({ isFetchingUserStore: true });

        try {
          const q = query(collection(db, 'stores'), where('ownerId', '==', userId), limit(1));
          const snap = await getDocs(q);
          
          const storeData = snap.docs.length > 0 
              ? { id: snap.docs[0].id, ...snap.docs[0].data() } as Store 
              : null;

          set({
              userStore: storeData,
              isFetchingUserStore: false,
              isUserDataLoaded: true,
              readCount: get().readCount + 1
          });
        } catch (error) {
          console.error("fetchUserStore failed:", error);
          set({ isFetchingUserStore: false, isUserDataLoaded: true });
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
