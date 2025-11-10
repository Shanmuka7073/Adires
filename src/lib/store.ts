

'use client';

import { create } from 'zustand';
import { Firestore, collection, getDocs } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAlias } from './types';
import { getStores, getMasterProducts, getProductPrice } from './data';
import { useFirebase } from '@/firebase';
import { useEffect, RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { t as translate, initializeTranslations, Locales, getAllAliases as getAliasesFromLocales, buildLocalesFromAliases } from '@/lib/locales';
import { generalCommands as defaultGeneralCommands, CommandGroup } from '@/lib/locales/commands';


export interface AppState {
  stores: Store[];
  masterProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
  voiceAliases: VoiceAlias[];
  locales: Locales;
  commands: Record<string, CommandGroup>;
  loading: boolean;
  error: Error | null;
  language: string;
  setLanguage: (lang: string) => void;
  fetchInitialData: (db: Firestore) => Promise<void>;
  fetchProductPrices: (db: Firestore, productNames: string[]) => Promise<void>;
  getProductName: (product: Product) => string;
  getAllAliases: (key: string) => Record<string, string[]>;
}

export const useAppStore = create<AppState>((set, get) => ({
  stores: [],
  masterProducts: [],
  productPrices: {},
  voiceAliases: [],
  locales: {},
  commands: {},
  loading: true,
  error: null,
  language: 'en', // Default language is English

  setLanguage: (lang: string) => set({ language: lang }),

  fetchInitialData: async (db: Firestore) => {
    if (!get().loading && get().stores.length > 0) return; // Already fetched

    set({ loading: true, error: null });
    try {
      const aliasCollection = collection(db, 'voiceAliases');
      const aliasSnapshot = await getDocs(aliasCollection);
      const voiceAliases = aliasSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as VoiceAlias));
      const locales = buildLocalesFromAliases(voiceAliases);
      
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
        voiceAliases,
        locales,
        commands: enrichedCommands,
        loading: false,
      });
    } catch (error) {
      console.error("Failed to fetch initial app data:", error);
      set({ error: error as Error, loading: false });
    }
  },
  
  fetchProductPrices: async (db: Firestore, productNames: string[]) => {
      const existingPrices = get().productPrices;
      const namesToFetch = productNames.filter(name => existingPrices[name.toLowerCase()] === undefined);

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
    return getAliasesFromLocales(key);
  }
}));

// Custom hook to initialize the store's data on app load
export const useInitializeApp = () => {
    const { firestore } = useFirebase();
    const fetchInitialData = useAppStore((state) => state.fetchInitialData);
    const loading = useAppStore((state) => state.loading);

    useEffect(() => {
        if (firestore) {
            fetchInitialData(firestore);
        }
    }, [firestore, fetchInitialData]);

    return loading;
};

// --- Store for Profile Page Form ---
interface ProfileFormState {
  form: any | null; // Using 'any' for simplicity as UseFormReturn is complex
  setForm: (form: any | null) => void;
  // This can be simplified or removed if not strictly needed by voice commander
}

export const useProfileFormStore = create<ProfileFormState>((set) => ({
  form: null,
  setForm: (form) => set({ form }),
}));


// --- Store for My Store Page ---
interface MyStorePageState {
  saveInventoryBtnRef: RefObject<HTMLButtonElement> | null;
  setSaveInventoryBtnRef: (ref: RefObject<HTMLButtonElement> | null) => void;
}

export const useMyStorePageStore = create<MyStorePageState>((set) => ({
  saveInventoryBtnRef: null,
  setSaveInventoryBtnRef: (ref) => set({ saveInventoryBtnRef: ref }),
}));

    