
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, where, doc, getDoc, limit } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup } from './types';
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
  // LEGACY STUBS
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

/**
 * ADIRES GLOBAL DATA STORE
 */
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
        if (get().loading) return;
        set({ loading: true, error: null });
        
        try {
          // Parallel fetch of system metadata with defensive error handling per collection
          const [aliasDocs, commandDocs] = await Promise.all([
            getDocs(collection(db, 'voiceAliasGroups')).catch(err => {
                console.warn("Permission denied for voiceAliasGroups. Using empty set.");
                return { docs: [] };
            }),
            getDocs(collection(db, 'voiceCommands')).catch(err => {
                console.warn("Permission denied for voiceCommands. Using empty set.");
                return { docs: [] };
            })
          ]);

          let userStore = get().userStore;
          if (userId) {
              const q = query(collection(db, 'stores'), where('ownerId', '==', userId), limit(1));
              const storeSnap = await getDocs(q).catch(() => ({ empty: true, docs: [] }));
              if (!(storeSnap as any).empty) {
                  userStore = { id: (storeSnap as any).docs[0].id, ...(storeSnap as any).docs[0].data() } as Store;
              }
          }

          if (!get().deviceId) {
              const newId = Math.random().toString(36).substring(2, 15);
              set({ deviceId: newId });
          }

          const voiceAliasGroups = aliasDocs.docs.map((doc: any) => ({ id: doc.id, ...doc.data() } as VoiceAliasGroup));
          const locales = buildLocalesFromAliasGroups(voiceAliasGroups);
          
          const dbCommands = commandDocs.docs.reduce((acc: any, doc: any) => {
              acc[doc.id] = doc.data() as CommandGroup;
              return acc;
          }, {} as Record<string, CommandGroup>);
          
          const enrichedCommands = { ...defaultGeneralCommands, ...dbCommands };

          initializeTranslations(locales); 

          set({
            userStore,
            locales,
            commands: enrichedCommands,
            isInitialized: true,
            appReady: true,
            loading: false,
          });
          
        } catch (error) {
          console.error("fetchInitialData critical failure:", error);
          // Unlock app even on error to prevent white screen for non-admin users
          set({ error: error as Error, loading: false, isInitialized: true, appReady: true });
        }
      },
      
      masterProducts: [],
      productPrices: {},
      locales: {},
      commands: {},
      getAllAliases: (key: string) => ({}),
      fetchProductPrices: async () => {},
      getProductName: (product: any) => product?.name || '',
    }),
    {
      name: 'adires-ops-storage-v5',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
          userStore: state.userStore,
          language: state.language,
          deviceId: state.deviceId,
      }),
    }
  )
);

export const useInitializeApp = () => {
    const { firestore, user, isUserLoading } = useFirebase();
    const { fetchInitialData, loading, isInitialized, userStore, setAppReady } = useAppStore();

    useEffect(() => {
        if (isInitialized || userStore) {
            setAppReady(true);
        }
        
        if (firestore && !isUserLoading && !loading && !isInitialized) {
            fetchInitialData(firestore, user?.uid);
        }
    }, [firestore, user?.uid, isUserLoading, loading, fetchInitialData, isInitialized, userStore, setAppReady]);

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
