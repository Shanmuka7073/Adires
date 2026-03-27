
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup, CommandGroup } from './types';
import { useEffect, RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { initializeTranslations, Locales, getAllAliases as getAliasesFromLocales, buildLocalesFromAliasGroups, t as translate } from './locales';
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
  fetchUserStore: (db: Firestore, userId: string) => Promise<void>;
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

/**
 * Sync-Safe Device ID Generator
 */
const getOrGenerateDeviceId = () => {
    if (typeof window === 'undefined') return null;
    let id = localStorage.getItem('adires-device-id');
    if (!id) {
        id = Math.random().toString(36).substring(2, 15);
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
      loading: false,
      isInitialized: false,
      appReady: false,
      error: null,
      language: getInitialLanguage(),
      activeStoreId: null,
      deviceId: getOrGenerateDeviceId(),
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
          const storesSnap = await getDocs(query(collection(db, 'stores'), limit(50)));
          const stores = storesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as Store));
          
          let userStore = state.userStore;
          if (userId && (!userStore || userStore.ownerId !== userId)) {
              userStore = stores.find((s: Store) => s.ownerId === userId) || null;
          }

          set({
            stores,
            isInitialized: true,
            loading: false,
            appReady: true,
            userStore,
            readCount: state.readCount + storesSnap.docs.length
          });
          
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          set({ error: error as Error, loading: false, isInitialized: true, appReady: true });
        }
      },

      fetchUserStore: async (db: Firestore, userId: string) => {
        const state = get();
        if (state.loading || (state.userStore && state.userStore.ownerId === userId)) {
            if (!state.appReady) set({ appReady: true });
            return;
        }

        set({ loading: true, error: null });

        try {
            const q = query(collection(db, 'stores'), where('ownerId', '==', userId), limit(1));
            const snap = await getDocs(q);
            const userStore = snap.docs.length > 0 
                ? { id: snap.docs[0].id, ...snap.docs[0].data() } as Store 
                : null;

            set({
                userStore,
                isInitialized: true,
                appReady: true,
                loading: false,
                readCount: state.readCount + 1
            });
        } catch (error) {
            console.error("fetchUserStore failed:", error);
            set({ error: error as Error, loading: false, isInitialized: true, appReady: true });
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
      name: 'adires-ops-lean-v4', 
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
    const fetchUserStore = useAppStore(state => state.fetchUserStore);
    const loading = useAppStore(state => state.loading);
    const isInitialized = useAppStore(state => state.isInitialized);
    const setAppReady = useAppStore(state => state.setAppReady);
    const userStore = useAppStore(state => state.userStore);
    const deviceId = useAppStore(state => state.deviceId);
    const setDeviceId = useAppStore(state => state.setDeviceId);

    useEffect(() => {
        // Double-lock the device identity on first load
        if (typeof window !== 'undefined') {
            const id = getOrGenerateDeviceId();
            if (id && id !== deviceId) {
                setDeviceId(id);
            }
        }
    }, [deviceId, setDeviceId]);

    useEffect(() => {
        if (isInitialized) {
            setAppReady(true);
        }
        
        if (firestore && !isUserLoading && !loading) {
            if (user) {
                if (!userStore || userStore.ownerId !== user.uid) {
                    fetchUserStore(firestore, user.uid);
                } else {
                    setAppReady(true);
                }
            } else {
                setAppReady(true);
            }
        }
    }, [firestore, user?.uid, isUserLoading, loading, fetchUserStore, isInitialized, setAppReady, userStore]);

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
