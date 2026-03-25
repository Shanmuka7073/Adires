
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, limit } from 'firebase/firestore';
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
        
        const start = performance.now();
        set({ loading: true, error: null });
        
        try {
          // OPTIMIZATION: Only fetch essential Shell data. 
          // Page-specific data (Analytics, Orders) is moved to SWR hooks in components.
          const [storesSnap, aliasDocs, commandDocs] = await Promise.all([
            getDocs(query(collection(db, 'stores'), limit(50))).catch(() => ({ docs: [] })),
            getDocs(query(collection(db, 'voiceAliasGroups'), limit(100))).catch(() => ({ docs: [] })),
            getDocs(query(collection(db, 'voiceCommands'), limit(50))).catch(() => ({ docs: [] }))
          ]);

          const stores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
          const voiceAliasGroups = aliasDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as VoiceAliasGroup));
          const locales = buildLocalesFromAliasGroups(voiceAliasGroups);
          
          const dbCommands = commandDocs.docs.reduce((acc, doc) => {
              acc[doc.id] = doc.data() as CommandGroup;
              return acc;
          }, {} as Record<string, CommandGroup>);
          
          const enrichedCommands = { ...defaultGeneralCommands, ...dbCommands };
          initializeTranslations(locales); 

          if (!state.deviceId && typeof window !== 'undefined') {
              set({ deviceId: Math.random().toString(36).substring(2, 15) });
          }

          console.log(`[PERF] App Bootstrap in ${(performance.now() - start).toFixed(0)}ms`);

          set({
            stores,
            locales,
            commands: enrichedCommands,
            isInitialized: true,
            loading: false,
            appReady: true,
            userStore: userId ? (stores.find(s => s.ownerId === userId) || null) : state.userStore,
            readCount: state.readCount + storesSnap.docs.length + 2
          });
          
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          set({ error: error as Error, loading: false, isInitialized: true, appReady: true });
        }
      },

      fetchProductPrices: async (db: Firestore, productNames: string[]) => {
          // Legacy stub
          return Promise.resolve();
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
      name: 'adires-ops-v16', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
          userStore: state.userStore,
          language: state.language,
          deviceId: state.deviceId,
          isInitialized: state.isInitialized,
      }),
    }
  )
);

export const useInitializeApp = () => {
    const { firestore, user, isUserLoading } = useFirebase();
    const { fetchInitialData, loading, isInitialized, setAppReady } = useAppStore();

    useEffect(() => {
        if (isInitialized) setAppReady(true);
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
