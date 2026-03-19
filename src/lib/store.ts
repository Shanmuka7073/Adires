
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup } from './types';
import { getStores } from './data';
import { useEffect, RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { initializeTranslations, Locales, getAllAliases as getAliasesFromLocales } from '@/lib/locales';
import { generalCommands as defaultGeneralCommands, CommandGroup } from '@/lib/locales/commands';
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
  userStore: Store | null; 
  locales: Locales;
  commands: Record<string, CommandGroup>;
  loading: boolean;
  isInitialized: boolean;
  appReady: boolean;
  error: Error | null;
  language: string;
  activeStoreId: string | null;
  readCount: number;
  writeCount: number;
  incrementReadCount: (count?: number) => void;
  incrementWriteCount: (count?: number) => void;
  setLanguage: (lang: string) => void;
  setActiveStoreId: (storeId: string | null) => void;
  setUserStore: (store: Store | null) => void;
  setAppReady: (ready: boolean) => void;
  fetchInitialData: (db: Firestore, userId?: string) => Promise<void>;
  getAllAliases: (key: string) => Record<string, string[]>;
  setLocales: (newLocales: Locales) => void;
  setCommands: (newCommands: Record<string, CommandGroup>) => void;
  // Deprecated/Purged Grocery Methods
  masterProducts: any[];
  productPrices: any;
  fetchProductPrices: any;
  getProductName: any;
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
      productPrices: {},
      locales: {},
      commands: {},
      loading: false,
      isInitialized: false,
      appReady: false,
      error: null,
      language: getInitialLanguage(),
      activeStoreId: null,
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
      setLocales: (newLocales: Locales) => set({ locales: newLocales }),
      setCommands: (newCommands: Record<string, CommandGroup>) => set({ commands: newCommands }),
      setActiveStoreId: (storeId: string | null) => set({ activeStoreId: storeId }),

      fetchInitialData: async (db: Firestore, userId?: string) => {
        if (get().loading) return;
        set({ loading: true, error: null });
        
        try {
          const [storesSnap, commandDocs] = await Promise.all([
            getDocs(collection(db, 'stores')),
            getDocs(collection(db, 'voiceCommands'))
          ]);
          
          const allStores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
          
          // FILTER: Only Restaurants and Salons. We don't cache grocery stores.
          const businessStores = allStores.filter(s => 
            s.businessType === 'restaurant' || 
            s.businessType === 'salon' ||
            ['hotel', 'mess', 'salon', 'saloon', 'parlour', 'bakery'].some(kw => s.name.toLowerCase().includes(kw))
          );

          let userStore = get().userStore; 
          if (userId && (!userStore || userStore.ownerId !== userId)) {
              userStore = businessStores.find(s => s.ownerId === userId) || null;
          }

          const dbCommands = commandDocs.docs.reduce((acc, doc) => {
              acc[doc.id] = doc.data() as CommandGroup;
              return acc;
          }, {} as Record<string, CommandGroup>);
          
          const enrichedCommands = { ...defaultGeneralCommands, ...dbCommands };

          initializeTranslations({}); // No aliases cached locally anymore

          set({
            stores: businessStores,
            userStore,
            commands: enrichedCommands,
            isInitialized: true,
            appReady: true,
            loading: false,
            // Explicitly clear legacy grocery data
            masterProducts: [],
            locales: {}
          });
          
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          set({ error: error as Error, loading: false, isInitialized: true, appReady: true });
        }
      },

      getAllAliases: (key: string) => {
        return getAliasesFromLocales(get().locales, key);
      },

      // Purged grocery logic
      fetchProductPrices: async () => {},
      fetchExtendedData: async () => {},
      getProductName: (product: any) => product.name,
    }),
    {
      name: 'localbasket-app-storage-v3',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
          userStore: state.userStore,
          language: state.language,
          activeStoreId: state.activeStoreId,
      }),
    }
  )
);

export const useInitializeApp = () => {
    const { firestore, user, isUserLoading } = useFirebase();
    const { fetchInitialData, loading, userStore, setAppReady } = useAppStore();

    useEffect(() => {
        if (userStore) {
            setAppReady(true);
        }
        if (firestore && !isUserLoading && !loading) {
            fetchInitialData(firestore, user?.uid);
        }
    }, [firestore, user?.uid, isUserLoading, loading, fetchInitialData, userStore, setAppReady]);

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
