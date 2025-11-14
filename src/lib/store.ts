
'use client';

import { create } from 'zustand';
<<<<<<< HEAD
import { Firestore, collection, getDocs } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAlias } from './types';
import { getStores, getMasterProducts, getProductPrice } from './data';
import { useFirebase } from '@/firebase';
import { useEffect, RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { t as translate, initializeTranslations, Locales, getAllAliases as getAliasesFromLocales, buildLocalesFromAliases } from '@/lib/locales';
import { generalCommands as defaultGeneralCommands, CommandGroup } from '@/lib/locales/commands';
import { ProfileFormValues } from '@/app/dashboard/customer/my-profile/page';
=======
import { Firestore } from 'firebase/firestore';
import { Store, Product, ProductPrice } from './types';
import { getStores, getMasterProducts, getProductPrice } from './data';
import { useFirebase } from '@/firebase';
import { useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { ProfileFormValues } from '@/app/dashboard/customer/my-profile/page';
import { t as translate } from '@/lib/locales';
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584


export interface AppState {
  stores: Store[];
  masterProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
<<<<<<< HEAD
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

const getInitialLanguage = (): string => {
  if (typeof window !== 'undefined') {
    return localStorage.getItem('app-language') || 'en';
  }
  return 'en';
};

=======
  loading: boolean;
  error: Error | null;
  language: string; // e.g., 'en-IN', 'te-IN'
  fetchInitialData: (db: Firestore) => Promise<void>;
  fetchProductPrices: (db: Firestore, productNames: string[]) => Promise<void>;
  setLanguage: (language: string) => void;
  getProductName: (product: Product) => string;
}

>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
export const useAppStore = create<AppState>((set, get) => ({
  stores: [],
  masterProducts: [],
  productPrices: {},
<<<<<<< HEAD
  voiceAliases: [],
  locales: {},
  commands: {},
  loading: true,
  error: null,
  language: getInitialLanguage(),

  setLanguage: (lang: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('app-language', lang);
    }
    set({ language: lang });
  },

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

=======
  loading: true,
  error: null,
  language: 'en-IN', // Default language

  fetchInitialData: async (db: Firestore) => {
    // Prevent re-fetching if data is already present
    if (get().stores.length > 0 && get().masterProducts.length > 0) {
      set({ loading: false });
      return;
    }

    set({ loading: true, error: null });
    try {
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
      const [stores, masterProducts] = await Promise.all([
        getStores(db),
        getMasterProducts(db),
      ]);

      set({
        stores,
        masterProducts,
<<<<<<< HEAD
        voiceAliases,
        locales,
        commands: enrichedCommands,
=======
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
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
<<<<<<< HEAD
      }
  },

=======
          // Optionally handle price-specific errors
      }
  },

  setLanguage: (language: string) => {
    // We no longer store the language in localStorage as it's now dynamic
    set({ language });
  },

>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
  getProductName: (product: Product) => {
    if (!product || !product.name) return '';
    const lang = get().language;
    return translate(product.name.toLowerCase().replace(/ /g, '-'), lang);
  },
<<<<<<< HEAD

  getAllAliases: (key: string) => {
    return getAliasesFromLocales(key);
  }
=======
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
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
  form: UseFormReturn<ProfileFormValues> | null;
  setForm: (form: UseFormReturn<ProfileFormValues> | null) => void;
<<<<<<< HEAD
  // This can be simplified or removed if not strictly needed by voice commander
=======
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
}

export const useProfileFormStore = create<ProfileFormState>((set) => ({
  form: null,
  setForm: (form) => set({ form }),
}));
<<<<<<< HEAD


// --- Store for My Store Page ---
interface MyStorePageState {
  saveInventoryBtnRef: RefObject<HTMLButtonElement> | null;
  setSaveInventoryBtnRef: (ref: RefObject<HTMLButtonElement> | null) => void;
}

export const useMyStorePageStore = create<MyStorePageState>((set) => ({
  saveInventoryBtnRef: null,
  setSaveInventoryBtnRef: (ref) => set({ saveInventoryBtnRef: ref }),
}));
=======
>>>>>>> 3c2a2b0ed2e745fafc80355bb5c4d0d2fed82584
