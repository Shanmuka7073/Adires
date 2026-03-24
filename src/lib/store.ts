'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup } from './types';
import { useEffect, RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { initializeTranslations, Locales, getAllAliases as getAliasesFromLocales, buildLocalesFromAliasGroups } from './locales';
import { generalCommands as defaultGeneralCommands, CommandGroup } from './locales/commands';
import { useFirebase } from '@/firebase';

export interface ProfileFormValues {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  address?: string;
  [key: string]: any;
}

export interface AppState {
  stores: Store[];
  masterProducts: Product[];
  userStore: Store | null; 
  loading: boolean;
  isInitialized: boolean;
  appReady: boolean;
  error: Error | null;
  language: string;
  activeStoreId: string | null;
  deviceId: string | null; 
  isCartOpen: boolean;
  readCount: number;
  writeCount: number;
  incrementReadCount: (count?: number) => void;
  incrementWriteCount: (count?: number) => void;
  setLanguage: (lang: string) => void;
  setActiveStoreId: (storeId: string | null) => void;
  setUserStore: (store: Store | null) => void;
  setAppReady: (ready: boolean) => void;
  setDeviceId: (id: string) => void;
  setCartOpen: (open: boolean) => void;
  fetchInitialData: (db: Firestore, userId?: string) => Promise<void>;
  productPrices: Record<string, ProductPrice | null>;
  fetchProductPrices: (db: Firestore, productNames: string[]) => Promise<void>;
  locales: Locales;
  commands: Record<string, CommandGroup>;
  getProductName: (product: Product) => string;
  getAllAliases: (key: string) => Record<string, string[]>;
}

const getInitialLanguage = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('app-language') || 'en';
  }
  return 'en';
};

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      stores: [],
      masterProducts: [],
      userStore: null,
      locales: {},
      commands: {},
      productPrices: {},
      loading: false,
      isInitialized: false,
      appReady: false,
      error: null,
      language: getInitialLanguage(),
      activeStoreId: null,
      deviceId: null,
      isCartOpen: false,
      readCount: 0,
      writeCount: 0,

      incrementReadCount: (count = 1) => set(state => ({ readCount: state.readCount + count })),
      incrementWriteCount: (count = 1) => set(state => ({ writeCount: state.writeCount + count })),

      setLanguage: (lang: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('app-language', lang);
        }
        set({ language: lang });
      },
      
      setUserStore: (store: Store | null) => set({ userStore: store }),
      setAppReady: (isReady: boolean) => set({ appReady: isReady }),
      setDeviceId: (id: string) => set({ deviceId: id }),
      setActiveStoreId: (storeId: string | null) => set({ activeStoreId: storeId }),
      setCartOpen: (open: boolean) => set({ isCartOpen: open }),

      fetchInitialData: async (db: Firestore, userId?: string) => {
        const state = get();
        if (state.loading) return;
        
        set({ loading: true, error: null });
        
        try {
          // Fetch critical platform data
          const [storesSnap, aliasDocs, commandDocs] = await Promise.all([
            getDocs(collection(db, 'stores')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'voiceAliasGroups')).catch(() => ({ docs: [] })),
            getDocs(collection(db, 'voiceCommands')).catch(() => ({ docs: [] }))
          ]);

          set(s => ({ readCount: s.readCount + (storesSnap.docs.length || 0) + 2 }));

          const stores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
          
          let userStore = state.userStore;
          if (userId) {
              userStore = stores.find((s: Store) => s.ownerId === userId) || null;
          }

          const voiceAliasGroups = aliasDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as VoiceAliasGroup));
          const locales = buildLocalesFromAliasGroups(voiceAliasGroups);
          
          const dbCommands = commandDocs.docs.reduce((acc, doc) => {
              acc[doc.id] = doc.data() as CommandGroup;
              return acc;
          }, {} as Record<string, CommandGroup>);
          
          const enrichedCommands = { ...defaultGeneralCommands, ...dbCommands };

          initializeTranslations(locales); 

          // Device ID generation is deferred until hydration to prevent mismatch
          if (!state.deviceId && typeof window !== 'undefined') {
              const newId = Math.random().toString(36).substring(2, 15);
              set({ deviceId: newId });
          }

          set({
            stores,
            locales,
            commands: enrichedCommands,
            isInitialized: true,
            loading: false,
            appReady: true,
            userStore,
          });
          
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          set({ error: error as Error, loading: false, isInitialized: true, appReady: true });
        }
      },

      fetchProductPrices: async (db: Firestore, productNames: string[]) => {
          const { productPrices } = get();
          const namesToFetch = productNames.filter(name => name && productPrices[name.toLowerCase()] === undefined);
          if (namesToFetch.length === 0) return;
          
          try {
              const pricesToUpdate: Record<string, ProductPrice | null> = {};
              const batchSize = 30;
              for (let i = 0; i < namesToFetch.length; i += batchSize) {
                  const batchNames = namesToFetch.slice(i, i + batchSize).map(n => n.toLowerCase());
                  if (batchNames.length > 0) {
                      const priceQuery = query(collection(db, 'productPrices'), where('productName', 'in', batchNames));
                      const priceSnapshot = await getDocs(priceQuery);
                      const fetchedPrices = new Map(priceSnapshot.docs.map(doc => [doc.id, doc.data() as ProductPrice]));
                      batchNames.forEach(name => {
                          pricesToUpdate[name] = fetchedPrices.get(name) || null;
                      });
                  }
              }
              set(state => ({ productPrices: { ...state.productPrices, ...pricesToUpdate } }));
          } catch (error) {
              console.error("Failed to fetch product prices:", error);
          }
      },

      getProductName: (product: Product) => {
        if (!product || !product.name) return '';
        const lang = get().language;
        const key = product.name.toLowerCase().replace(/ /g, '-');
        const entry = get().locales[key];
        if (entry) {
            const regional = entry[lang.split('-')[0]];
            if (regional) return Array.isArray(regional) ? regional[0] : regional;
        }
        return product.name;
      },

      getAllAliases: (key: string) => {
        return getAliasesFromLocales(get().locales, key);
      }
    }),
    {
      name: 'adires-ops-v15', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
          userStore: state.userStore,
          language: state.language,
          deviceId: state.deviceId,
          isInitialized: state.isInitialized, // Persist this to prevent hydration lag
      }),
    }
  )
);

export const useInitializeApp = () => {
    const { firestore, user, isUserLoading } = useFirebase();
    const { fetchInitialData, loading, isInitialized, setAppReady } = useAppStore();

    useEffect(() => {
        if (isInitialized) {
            setAppReady(true);
        }
        
        // Only fetch if not already done or if user ID is now available
        if (firestore && !isUserLoading && !loading && (!isInitialized || (user && !useAppStore.getState().userStore))) {
            fetchInitialData(firestore, user?.uid);
        }
    }, [firestore, user?.uid, isUserLoading, loading, fetchInitialData, isInitialized, setAppReady]);

    return { isLoading: loading };
};

interface ProfileFormState {
  form: UseFormReturn<ProfileFormValues> | null;
  setForm: (form: UseFormReturn<ProfileFormValues> | null) => void;
}

export const useProfileFormStore = create<ProfileFormState>((set) => ({
  form: null,
  setForm: (form) => set({ form }),
}));

interface MyStorePageState {
  saveInventoryBtnRef: RefObject<HTMLButtonElement> | null;
  setSaveInventoryBtnRef: (ref: RefObject<HTMLButtonElement> | null) => void;
}

export const useMyStorePageStore = create<MyStorePageState>((set) => ({
  saveInventoryBtnRef: null,
  setSaveInventoryBtnRef: (ref) => set({ saveInventoryBtnRef: ref }),
}));
