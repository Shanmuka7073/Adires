
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, writeBatch, doc } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup } from './types';
import { getStores, getMasterProducts, getProductPrice } from './data';
import { useFirebase } from '@/firebase';
import { useEffect, RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { t as translate, initializeTranslations, Locales, getAllAliases as getAliasesFromLocales, buildLocalesFromAliasGroups } from '@/lib/locales';
import { generalCommands as defaultGeneralCommands, CommandGroup } from '@/lib/locales/commands';
import { ProfileFormValues } from '@/app/dashboard/customer/my-profile/page';

export interface AppState {
  stores: Store[];
  masterProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
  locales: Locales;
  commands: Record<string, CommandGroup>;
  loading: boolean;
  isInitialized: boolean;
  error: Error | null;
  language: string;
  setLanguage: (lang: string) => void;
  fetchInitialData: (db: Firestore) => Promise<void>;
  fetchProductPrices: (db: Firestore, productNames: string[]) => Promise<void>;
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
      productPrices: {},
      locales: {},
      commands: {},
      loading: true,
      isInitialized: false,
      error: null,
      language: getInitialLanguage(),

      setLanguage: (lang: string) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('app-language', lang);
        }
        set({ language: lang });
      },

      fetchInitialData: async (db: Firestore) => {
        // Prevent re-fetching if already initialized
        if (get().isInitialized) {
            return; 
        }
        // Set loading to true only if it's not already loading
        if (!get().loading) {
          set({ loading: true });
        }
        
        set({ error: null });
        try {
          const aliasGroupCollection = collection(db, 'voiceAliasGroups');
          const aliasSnapshot = await getDocs(aliasGroupCollection);
          const voiceAliasGroups = aliasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VoiceAliasGroup));
          const locales = buildLocalesFromAliasGroups(voiceAliasGroups);
          
          const commandsCollection = collection(db, 'voiceCommands');
          const commandsSnapshot = await getDocs(commandsCollection);
          const dbCommands = commandsSnapshot.docs.reduce((acc, doc) => {
              acc[doc.id] = doc.data() as CommandGroup;
              return acc;
          }, {} as Record<string, CommandGroup>);
          
          const enrichedCommands = { ...defaultGeneralCommands, ...dbCommands };

          initializeTranslations(locales); 

          const [stores, masterProducts] = await Promise.all([
            getStores(db),
            getMasterProducts(db),
          ]);
          
          set({
            stores,
            masterProducts,
            locales,
            commands: enrichedCommands,
            loading: false,
            isInitialized: true,
          });
          
        } catch (error) {
          console.error("Failed to fetch initial app data:", error);
          set({ error: error as Error, loading: false });
        }
      },
      
      fetchProductPrices: async (db: Firestore, productNames: string[]) => {
          const existingPrices = get().productPrices;
          const namesToFetch = productNames.filter(name => name && existingPrices[name.toLowerCase()] === undefined);

          if (namesToFetch.length === 0) {
              return;
          }
          
          try {
              const pricePromises = namesToFetch.map(name => getProductPrice(db, name));
              const results = await Promise.all(pricePromises);

              const newPrices = namesToFetch.reduce((acc, name, index) => {
                  acc[name.toLowerCase()] = results[index];
                  return acc;
              }, {} as Record<string, ProductPrice | null>);

              set(state => ({
                  productPrices: { ...state.productPrices, ...newPrices }
              }));

          } catch (error) {
              console.error("Failed to fetch product prices:", error);
          }
      },

      getProductName: (product: Product) => {
        if (!product || !product.name) return '';
        const lang = get().language;
        return translate(product.name.toLowerCase().replace(/ /g, '-'), lang);
      },

      getAllAliases: (key: string) => {
        return getAliasesFromLocales(get().locales, key);
      }
    }),
    {
      name: 'localbasket-app-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ language: state.language }),
    }
  )
);


export const useInitializeApp = () => {
    const { firestore, user } = useFirebase();
    const { fetchInitialData, isInitialized, loading } = useAppStore();

    useEffect(() => {
        // Trigger fetch only if we have the necessary firebase services and user is logged in,
        // and we haven't already initialized the data.
        if (firestore && user && !isInitialized && !loading) {
            fetchInitialData(firestore);
        }
    }, [firestore, user, isInitialized, loading, fetchInitialData]);

    // The hook now correctly represents the loading state for the *initialization* process.
    return loading && !isInitialized;
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

