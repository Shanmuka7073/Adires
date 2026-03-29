
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup, CommandGroup } from './types';
import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Locales, getAllAliases as getAliasesFromLocales, buildLocalesFromAliasGroups, t as translate } from './locales';
import { generalCommands as defaultGeneralCommands } from './locales/commands';
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
  getAllAliases: (key: string) => Record<string, string[]>;
  masterProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
  fetchProductPrices: (db: Firestore, productNames: string[]) => Promise<void>;
  getProductName: (product: Product) => string;
}

const getInitialLanguage = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('app-language') || 'en';
  }
  return 'en';
};

const getOrGenerateDeviceId = () => {
    if (typeof window === 'undefined') return 'server';
    let id = localStorage.getItem('adires-device-id');
    if (!id || id === 'null' || id === 'undefined' || id === 'server') {
        id = 'dev_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('adires-device-id', id);
    }
    return id;
};

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

      resetApp: () => set({
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
      }),

      fetchInitialData: async (db: Firestore, userId?: string) => {
        const state = get();
        if (state.isFetchingStores) return;
        
        set({ isFetchingStores: true, error: null });
        
        try {
          const storesSnap = await getDocs(query(collection(db, 'stores'), limit(50)));
          const stores = storesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Store));
          
          const id = getOrGenerateDeviceId();

          set({
            stores,
            isInitialized: true,
            isFetchingStores: false,
            deviceId: id,
            appReady: true,
            readCount: state.readCount + storesSnap.docs.length
          });

          if (userId) {
              await state.fetchUserStore(db, userId);
          } else {
              set({ isUserDataLoaded: true });
          }
          
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          set({ error: error as Error, isFetchingStores: false, isInitialized: true, appReady: true, isUserDataLoaded: true });
        }
      },

      fetchUserStore: async (db: Firestore, userId: string) => {
        const state = get();
        if (state.isFetchingUserStore) return;

        set({ isFetchingUserStore: true, error: null });

        try {
            const q = query(collection(db, 'stores'), where('ownerId', '==', userId), limit(1));
            const snap = await getDocs(q);
            
            const userStore = snap.docs.length > 0 
                ? { id: snap.docs[0].id, ...snap.docs[0].data() } as Store 
                : null;

            set({
                userStore,
                isFetchingUserStore: false,
                isUserDataLoaded: true,
                readCount: state.readCount + 1
            });
        } catch (error) {
            console.error("fetchUserStore failed:", error);
            set({ error: error as Error, isFetchingUserStore: false, isUserDataLoaded: true });
        }
      },

      fetchProductPrices: async (db: Firestore, productNames: string[]) => {
          return Promise.resolve();
      },

      getProductName: (product: Product) => {
        const lang = get().language;
        return translate(product.name.toLowerCase().replace(/ /g, '-'), lang);
      },

      getAllAliases: (key: string) => {
        return getAliasesFromLocales(get().locales, key);
      }
    }),
    {
      name: 'adires-ops-v16', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
          language: state.language,
          deviceId: state.deviceId
      }),
    }
  )
);

export const useInitializeApp = () => {
    const { firestore, user, isUserLoading } = useFirebase();
    const fetchUserStore = useAppStore(state => state.fetchUserStore);
    const fetchInitialData = useAppStore(state => state.fetchInitialData);
    const isFetchingStores = useAppStore(state => state.isFetchingStores);
    const isInitialized = useAppStore(state => state.isInitialized);
    const setAppReady = useAppStore(state => state.setAppReady);

    useEffect(() => {
        if (!firestore || isUserLoading) return;

        const bootstrap = async () => {
            if (!isInitialized && !isFetchingStores) {
                await fetchInitialData(firestore, user?.uid);
            } else if (user?.uid && !isFetchingStores) {
                await fetchUserStore(firestore, user.uid);
            }
            setAppReady(true);
        };

        bootstrap();
    }, [firestore, isUserLoading, isInitialized, isFetchingStores, fetchInitialData, fetchUserStore, user?.uid, setAppReady]);

    return { isLoading: isFetchingStores };
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
