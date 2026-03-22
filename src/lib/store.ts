
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup } from './types';
import { getStores, getMasterProducts } from './data';
import { useEffect, RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useFirebase } from '@/firebase';
import { buildLocalesFromAliasGroups, initializeTranslations } from './locales';
import { generalCommands as defaultGeneralCommands, CommandGroup } from './locales/commands';

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
  // LEGACY STUBS FOR TYPE COMPATIBILITY
  masterProducts: any[];
  productPrices: any;
  locales: any;
  commands: any;
  getAllAliases: (key: string) => Record<string, string[]>;
  fetchProductPrices: (db: Firestore, productNames: string[]) => Promise<void>;
  getProductName: (product: any) => string;
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
      userStore: null,
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
        // PERF: Avoid redundant fetches or loops if already in progress or completed
        if (get().loading || get().isInitialized) return;
        
        set({ loading: true, error: null });
        
        try {
          const [storesSnap, aliasDocs, commandDocs] = await Promise.all([
            getDocs(collection(db, 'stores')),
            getDocs(collection(db, 'voiceAliasGroups')),
            getDocs(collection(db, 'voiceCommands'))
          ]);

          const allStores = storesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
          
          const businessStores = allStores.filter(s => 
            s.businessType === 'restaurant' || 
            s.businessType === 'salon' ||
            ['hotel', 'mess', 'salon', 'saloon', 'parlour', 'bakery'].some(kw => s.name.toLowerCase().includes(kw))
          );

          let userStore = get().userStore; 
          if (userId && (!userStore || userStore.ownerId !== userId)) {
              userStore = businessStores.find(s => s.ownerId === userId) || null;
          }

          if (!get().deviceId) {
              const newId = Math.random().toString(36).substring(2, 15);
              set({ deviceId: newId });
          }

          const voiceAliasGroups = aliasDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as VoiceAliasGroup));
          const locales = buildLocalesFromAliasGroups(voiceAliasGroups);
          
          const dbCommands = commandDocs.docs.reduce((acc, doc) => {
              acc[doc.id] = doc.data() as CommandGroup;
              return acc;
          }, {} as Record<string, CommandGroup>);
          
          const enrichedCommands = { ...defaultGeneralCommands, ...dbCommands };

          initializeTranslations(locales); 

          set({
            stores: businessStores,
            userStore,
            locales,
            commands: enrichedCommands,
            isInitialized: true,
            appReady: true,
            loading: false,
          });
          
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          // Set isInitialized to true even on error to stop the retry loop
          set({ error: error as Error, loading: false, isInitialized: true, appReady: true });
        }
      },
      
      // LEGACY STUBS
      masterProducts: [],
      productPrices: {},
      locales: {},
      commands: {},
      getAllAliases: (key: string) => ({}),
      fetchProductPrices: async () => {},
      getProductName: (product: any) => product?.name || '',
    }),
    {
      name: 'localbasket-app-storage-v12',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
          userStore: state.userStore,
          language: state.language,
          activeStoreId: state.activeStoreId,
          deviceId: state.deviceId,
          stores: state.stores,
          isInitialized: state.isInitialized,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setAppReady(true);
        }
      }
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
        
        // Prevent infinite retry loop by only calling if not initialized and not already loading
        if (firestore && !isUserLoading && !loading && !isInitialized) {
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
