
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup, CommandGroup } from './types';
import { useEffect, useCallback, RefObject } from 'react';
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
  fetchUserStore: (db: Firestore, userId: string) => Promise<void>;
  locales: Locales;
  commands: Record<string, CommandGroup>;
  getAllAliases: (key: string) => Record<string, string[]>;
  masterProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
  fetchProductPrices: (db: Firestore, productNames: string[]) => Promise<void>;
  getProductName: (product: Product) => string;
}

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
        set({ isFetchingStores: true, error: null });
        
        try {
          const storesSnap = await getDocs(query(collection(db, 'stores'), limit(50)));
          const stores = storesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Store));
          
          let userStore = get().userStore;
          if (userId && (!userStore || userStore.ownerId !== userId)) {
              userStore = stores.find((s: Store) => s.ownerId === userId) || null;
          }

          const id = getOrGenerateDeviceId();

          set({
            stores,
            isInitialized: true,
            isFetchingStores: false,
            userStore,
            deviceId: id,
            appReady: true,
            readCount: get().readCount + storesSnap.docs.length
          });
          
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          set({ error: error as Error, isFetchingStores: false, isInitialized: true, appReady: true });
        }
      },

      fetchUserStore: async (db: Firestore, userId: string) => {
        set({ isFetchingUserStore: true, error: null });

        try {
            const q = query(collection(db, 'stores'), where('ownerId', '==', userId), limit(1));
            const snap = await getDocs(q);
            const userStore = snap.docs.length > 0 
                ? { id: snap.docs[0].id, ...snap.docs[0].data() } as Store 
                : null;

            set({
                userStore,
                isInitialized: true,
                isFetchingUserStore: false,
                appReady: true,
                readCount: get().readCount + 1
            });
        } catch (error) {
            console.error("fetchUserStore failed:", error);
            set({ error: error as Error, isFetchingUserStore: false, isInitialized: true, appReady: true });
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
      name: 'adires-ops-v15', 
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
          userStore: state.userStore,
          language: state.language,
          isInitialized: state.isInitialized,
          deviceId: state.deviceId
      }),
    }
  )
);

export const useInitializeApp = () => {
    const { firestore, user, isUserLoading } = useFirebase();
    const fetchUserStore = useAppStore(state => state.fetchUserStore);
    const fetchInitialData = useAppStore(state => state.fetchInitialData);
    const isInitialized = useAppStore(state => state.isInitialized);
    const setAppReady = useAppStore(state => state.setAppReady);
    const userStore = useAppStore(state => state.userStore);

    useEffect(() => {
        if (!firestore || isUserLoading) return;

        const bootstrap = async () => {
            if (!isInitialized) {
                await fetchInitialData(firestore, user?.uid);
            } else if (user?.uid && !userStore) {
                await fetchUserStore(firestore, user.uid);
            }
            setAppReady(true);
        };

        bootstrap();
    }, [firestore, isUserLoading, user?.uid]); // Reduced dependencies to break loop

    return { isLoading: isUserLoading };
};
