
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, where, limit } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup } from './types';
import { getStores, getMasterProducts } from './data';
import { useEffect, RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { initializeTranslations, Locales, getAllAliases as getAliasesFromLocales, buildLocalesFromAliasGroups } from '@/lib/locales';
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
  masterProducts: Product[];
  userStore: Store | null; 
  productPrices: Record<string, ProductPrice | null>;
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
  fetchExtendedData: (db: Firestore) => Promise<void>;
  fetchProductPrices: (db: Firestore, productNames: string[]) => Promise<void>;
  getProductName: (product: Product) => string;
  getAllAliases: (key: string) => Record<string, string[]>;
  setLocales: (newLocales: Locales) => void;
  setCommands: (newCommands: Record<string, CommandGroup>) => void;
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
        // Prevent parallel loads
        if (get().loading) return;
        
        set({ loading: true, error: null });
        
        try {
          // Parallel fetch of core platform data
          // These calls automatically use Firestore's persistent cache (IndexedDB) if offline
          const [stores, commandDocs] = await Promise.all([
            getStores(db),
            getDocs(collection(db, 'voiceCommands'))
          ]);
          
          let userStore = get().userStore; 
          // If we have a user but no persisted store profile, or the profile is for a different user, look it up.
          if (userId && (!userStore || userStore.ownerId !== userId)) {
              const ownerQuery = query(collection(db, 'stores'), where('ownerId', '==', userId), limit(1));
              const ownerSnap = await getDocs(ownerQuery);
              if (!ownerSnap.empty) {
                  userStore = { id: ownerSnap.docs[0].id, ...ownerSnap.docs[0].data() } as Store;
              } else {
                  userStore = null;
              }
          }

          const dbCommands = commandDocs.docs.reduce((acc, doc) => {
              acc[doc.id] = doc.data() as CommandGroup;
              return acc;
          }, {} as Record<string, CommandGroup>);
          
          const enrichedCommands = { ...defaultGeneralCommands, ...dbCommands };

          // Update memory state. 
          // PERSISTENCE NOTE: 'stores' is NOT saved to localStorage anymore to prevent QuotaExceeded errors.
          set({
            stores,
            userStore,
            commands: enrichedCommands,
            isInitialized: true,
            appReady: true,
            loading: false,
          });

          // Background fetch for heavy data (Aliases, master product names)
          // This keeps the primary UI unlock very fast.
          get().fetchExtendedData(db);
          
        } catch (error) {
          console.error("fetchInitialData failed:", error);
          // Unlock app even on error to prevent total lock-out in bad network conditions
          set({ error: error as Error, loading: false, isInitialized: true, appReady: true });
        }
      },

      fetchExtendedData: async (db: Firestore) => {
          try {
              // Large data sets are fetched and kept in memory. 
              // They are backed by Firestore's persistent cache (100MB+ limit)
              // instead of localStorage (5MB limit).
              const [masterProducts, aliasDocs] = await Promise.all([
                getMasterProducts(db),
                getDocs(collection(db, 'voiceAliasGroups')),
              ]);

              const voiceAliasGroups = aliasDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as VoiceAliasGroup));
              const locales = buildLocalesFromAliasGroups(voiceAliasGroups);
              initializeTranslations(locales); 

              set({ masterProducts, locales });

              if (masterProducts.length > 0) {
                await get().fetchProductPrices(db, masterProducts.map(p => p.name));
              }
          } catch (e) {
              console.error("fetchExtendedData failed:", e);
          }
      },
      
      fetchProductPrices: async (db: Firestore, productNames: string[]) => {
          const { productPrices, incrementReadCount } = get();
          const namesToFetch = productNames.filter(name => name && productPrices[name.toLowerCase()] === undefined);
          if (namesToFetch.length === 0) return;
          
          try {
              const pricesToUpdate: Record<string, ProductPrice | null> = {};
              const batchSize = 30;
              let totalReads = 0;

              for (let i = 0; i < namesToFetch.length; i += batchSize) {
                  const batchNames = namesToFetch.slice(i, i + batchSize).map(n => n.toLowerCase());
                  if (batchNames.length > 0) {
                      const priceQuery = query(collection(db, 'productPrices'), where('productName', 'in', batchNames));
                      const priceSnapshot = await getDocs(priceQuery);
                      totalReads++;
                      const fetchedPrices = new Map(priceSnapshot.docs.map(doc => [doc.id, doc.data() as ProductPrice]));
                      batchNames.forEach(name => {
                          pricesToUpdate[name] = fetchedPrices.get(name) || null;
                      });
                  }
              }

              incrementReadCount(totalReads);
              set(state => ({
                  productPrices: { ...state.productPrices, ...pricesToUpdate }
              }));
          } catch (error) {
              console.error("fetchProductPrices failed:", error);
          }
      },

      getProductName: (product: Product) => {
        if (!product || !product.name) return '';
        const lang = get().language;
        const { t } = require('@/lib/locales');
        return t(product.name.toLowerCase().replace(/ /g, '-'), lang);
      },

      getAllAliases: (key: string) => {
        return getAliasesFromLocales(get().locales, key);
      }
    }),
    {
      name: 'localbasket-app-storage-v2',
      storage: createJSONStorage(() => localStorage),
      // CRITICAL: We only persist lightweight "Identity" and "Settings" data.
      // Heavy items like 'stores', 'masterProducts', and 'locales' are managed
      // by Firestore's IndexedDB persistent cache, which has a much larger quota.
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
    const { fetchInitialData, isInitialized, loading, userStore, setAppReady } = useAppStore();

    useEffect(() => {
        // If we have a persisted business identity, we can unlock the UI immediately
        // while the background data fetch handles updating the live state.
        if (userStore) {
            setAppReady(true);
        }
        
        // Start the background synchronization
        if (firestore && !isUserLoading && !loading) {
            fetchInitialData(firestore, user?.uid);
        }
    }, [firestore, user?.uid, isUserLoading, loading, fetchInitialData, userStore, setAppReady]);

    return { isLoading: !isInitialized && loading };
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
