'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup, CommandGroup } from './types';
import { initializeTranslations, Locales, buildLocalesFromAliasGroups } from './locales';
import { generalCommands as defaultGeneralCommands } from './locales/commands';

export interface AppState {
  stores: Store[];
  userStore: Store | null; 
  isFetchingStores: boolean;
  isFetchingUserStore: boolean;
  isInitialized: boolean;
  isUserDataLoaded: boolean; 
  appReady: boolean;
  error: Error | null;
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
  setAppReady: (ready: boolean) => void;
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
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      stores: [],
      masterProducts: [],
      productPrices: {},
      userStore: null,
      locales: {},
      commands: defaultGeneralCommands,
      isFetchingStores: false,
      isFetchingUserStore: false,
      isInitialized: false,
      isUserDataLoaded: false,
      appReady: false,
      error: null,
      language: 'en',
      activeStoreId: null,
      deviceId: null, 
      isCartOpen: false,
      readCount: 0,
      writeCount: 0,

      incrementReadCount: (count = 1) => set(state => ({ readCount: state.readCount + count })),
      incrementWriteCount: (count = 1) => set(state => ({ writeCount: state.writeCount + count })),

      setLanguage: (lang: string) => set({ language: lang }),
      setUserStore: (store: Store | null) => set({ userStore: store }),
      setAppReady: (isReady: boolean) => set({ appReady: isReady }),
      setDeviceId: (id: string) => set({ deviceId: id }),
      setActiveStoreId: (storeId: string | null) => set({ activeStoreId: storeId }),
      setCartOpen: (open: boolean) => set({ isCartOpen: open }),

      /**
       * SECURE LOGOUT PROTOCOL
       * Purges all memory-resident and cached state to prevent session bleeding.
       */
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
              error: null
          });
          if (typeof window !== 'undefined') {
              localStorage.removeItem('adires-ops-storage');
          }
      },

      fetchInitialData: async (db: Firestore, userId?: string) => {
        if (get().isFetchingStores) return;
        set({ isFetchingStores: true, error: null });
        
        try {
          const storesSnap = await getDocs(query(collection(db, 'stores'), limit(50)));
          const storesList = storesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Store));
          
          set({
            stores: storesList,
            isInitialized: true,
            isFetchingStores: false,
            readCount: get().readCount + storesSnap.docs.length
          });

          // Trigger nested profile sync if a user is logged in
          if (userId) {
              await get().fetchUserStore(db, userId);
          } else {
              set({ isUserDataLoaded: true, appReady: true });
          }
          
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          set({ error: error as Error, isFetchingStores: false, isInitialized: true, isUserDataLoaded: true, appReady: true });
        }
      },

      fetchUserStore: async (db: Firestore, userId: string) => {
        if (!userId || get().isFetchingUserStore) return;
        set({ isFetchingUserStore: true, error: null });

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
                appReady: true,
                readCount: get().readCount + 1
            });
        } catch (error) {
            console.error("fetchUserStore failed:", error);
            set({ error: error as Error, isFetchingUserStore: false, isUserDataLoaded: true, appReady: true });
        }
      }
    }),
    {
      name: 'adires-ops-storage', 
      storage: createJSONStorage(() => localStorage),
      // PERSISTENCE POLICY: Strictly exclude user/business data to ensure clean slate on re-login
      partialize: (state) => ({ 
          language: state.language,
          deviceId: state.deviceId
      }),
    }
  )
);

/**
 * IDENTITY INITIALIZATION HOOK
 * Synchronizes operational hubs with authenticated identity.
 */
export const useInitializeApp = () => {
    const { fetchInitialData, isInitialized, isFetchingStores } = useAppStore();
    // Implementation deferred to turned-level lifecycle managers (e.g. useAdminAuth)
};
