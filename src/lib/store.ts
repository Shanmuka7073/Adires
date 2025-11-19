
'use client';

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { Firestore, collection, getDocs, query, where, writeBatch, doc } from 'firebase/firestore';
import { Store, Product, ProductPrice, VoiceAliasGroup, FailedVoiceCommand } from './types';
import { getStores, getMasterProducts, getProductPrice } from './data';
import { useFirebase } from '@/firebase';
import { useEffect, RefObject } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { t as translate, initializeTranslations, Locales, getAllAliases as getAliasesFromLocales, buildLocalesFromAliasGroups } from '@/lib/locales';
import { generalCommands as defaultGeneralCommands, CommandGroup } from '@/lib/locales/commands';
import { ProfileFormValues } from '@/app/dashboard/customer/my-profile/page';
import { suggestAlias, SuggestAliasOutput } from '@/ai/flows/suggest-alias-flow';

const ADMIN_EMAIL = 'admin@gmail.com';

export interface AppState {
  stores: Store[];
  masterProducts: Product[];
  productPrices: Record<string, ProductPrice | null>;
  locales: Locales;
  commands: Record<string, CommandGroup>;
  loading: boolean;
  error: Error | null;
  language: string;
  setLanguage: (lang: string) => void;
  fetchInitialData: (db: Firestore, isAdmin: boolean) => Promise<void>;
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

// --- Helper function for background AI processing ---
async function processFailedCommandsInBackground(db: Firestore, allItemNames: string[]) {
    const failedCommandsQuery = query(collection(db, 'failedCommands'), where('status', '==', 'new'));
    const snapshot = await getDocs(failedCommandsQuery);
    if (snapshot.empty) {
        return; // Nothing to process
    }

    console.log(`Found ${snapshot.docs.length} new failed commands to process...`);

    const batch = writeBatch(db);

    for (const commandDoc of snapshot.docs) {
        const command = commandDoc.data() as FailedVoiceCommand;
        try {
            const suggestion = await suggestAlias({
                commandText: command.commandText,
                language: command.language,
                itemNames: allItemNames
            });

            if (suggestion.isSuggestionAvailable && suggestion.similarityScore > 0.5) {
                // High confidence: Auto-approve and add to alias group
                const aliasGroupRef = doc(db, 'voiceAliasGroups', suggestion.suggestedKey);
                
                const aliasesByLang: Record<string, any> = {};
                const originalLang = command.language.split('-')[0];
                 if (!aliasesByLang[originalLang]) aliasesByLang[originalLang] = [];
                 aliasesByLang[originalLang].push(suggestion.originalCommand);

                suggestion.suggestedAliases.forEach(aliasInfo => {
                    const lang = aliasInfo.lang;
                    if (!aliasesByLang[lang]) aliasesByLang[lang] = [];
                    aliasesByLang[lang].push(aliasInfo.alias);
                    if (aliasInfo.transliteratedAlias) {
                        aliasesByLang[lang].push(aliasInfo.transliteratedAlias);
                    }
                });

                const updates: Record<string, any> = {};
                for (const lang in aliasesByLang) {
                    updates[lang] = Array.from(new Set(aliasesByLang[lang]));
                }
                
                batch.set(aliasGroupRef, updates, { merge: true });
                batch.delete(commandDoc.ref); // Delete the processed command
                console.log(`Auto-approved and deleted: "${command.commandText}" -> "${suggestion.suggestedKey}"`);

            } else {
                // Low confidence or no suggestion: Keep for manual review
                 batch.update(commandDoc.ref, { status: 'no_suggestion' });
            }
        } catch (error) {
            console.error(`Error processing command "${command.commandText}":`, error);
            // Update status to prevent reprocessing on every load
            batch.update(commandDoc.ref, { status: 'no_suggestion', reason: `AI processing failed: ${(error as Error).message}` });
        }
    }

    await batch.commit();
    console.log("Background processing complete.");
}


export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      stores: [],
      masterProducts: [],
      productPrices: {},
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

      fetchInitialData: async (db: Firestore, isAdmin: boolean) => {
        set({ loading: true, error: null });
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
          });
          
          // --- Trigger background processing for admin ---
          if (isAdmin) {
              const allItemNames = [...new Set([...masterProducts.map(p => p.name), ...stores.map(s => s.name)])];
              // This runs in the background and does not block the UI
              processFailedCommandsInBackground(db, allItemNames).catch(console.error);
          }
          
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
    }),
    {
      name: 'localbasket-app-storage', // Name of the item in localStorage
      storage: createJSONStorage(() => localStorage), // Use localStorage
      // Only persist a subset of the state
      partialize: (state) => ({ 
          stores: state.stores, 
          masterProducts: state.masterProducts, 
          productPrices: state.productPrices,
          locales: state.locales,
          commands: state.commands,
          language: state.language
      }),
    }
  )
);


// Custom hook to initialize the store's data on app load
export const useInitializeApp = () => {
    const { firestore, user } = useFirebase();
    const fetchInitialData = useAppStore((state) => state.fetchInitialData);
    const loading = useAppStore((state) => state.loading);
    const isAdmin = user?.email === ADMIN_EMAIL;

    useEffect(() => {
        if (firestore && user) { // Ensure user context is available
            fetchInitialData(firestore, isAdmin);
        }
    }, [firestore, user, isAdmin, fetchInitialData]);

    return loading;
};

// --- Store for Profile Page Form ---
interface ProfileFormState {
  form: UseFormReturn<ProfileFormValues> | null;
  setForm: (form: UseFormReturn<ProfileFormValues> | null) => void;
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

    