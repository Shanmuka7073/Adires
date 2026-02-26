
'use client';

export const initialDataCodeText = [
    {
        path: 'src/lib/store.ts (Partial: fetchInitialData)',
        content: `
      /**
       * The primary data loading function for the application.
       * Fetches stores, master products, voice aliases, and commands in parallel.
       */
      fetchInitialData: async (db: Firestore) => {
        // Prevent re-fetching if already loading
        if (get().loading) return;

        set({ loading: true, error: null });
        
        try {
          // Parallel fetch of core platform data
          const [stores, masterProducts, aliasDocs, commandDocs] = await Promise.all([
            getStores(db),
            getMasterProducts(db),
            getDocs(collection(db, 'voiceAliasGroups')),
            getDocs(collection(db, 'voiceCommands'))
          ]);

          // Process voice aliases into the locale lookup system
          const voiceAliasGroups = aliasDocs.docs.map(doc => ({ id: doc.id, ...doc.data() } as VoiceAliasGroup));
          const locales = buildLocalesFromAliasGroups(voiceAliasGroups);
          
          // Merge database commands with hardcoded default commands
          const dbCommands = commandDocs.docs.reduce((acc, doc) => {
              acc[doc.id] = doc.data() as CommandGroup;
              return acc;
          }, {} as Record<string, CommandGroup>);
          
          const enrichedCommands = { ...defaultGeneralCommands, ...dbCommands };

          // Initialize the synchronous translation helper
          initializeTranslations(locales); 

          // Update the global state and unlock the UI
          set({
            stores,
            masterProducts,
            locales,
            commands: enrichedCommands,
            isInitialized: true,
            loading: false,
            appReady: true,
          });

          // Kick off background pricing fetch for the product catalog
          if (masterProducts.length > 0) {
            await get().fetchProductPrices(db, masterProducts.map(p => p.name));
          }
          
        } catch (error) {
          console.error("Failed to fetch initial app data:", error);
          // Unlock app even on error to prevent total lock-out
          set({ error: error as Error, loading: false, appReady: true });
        }
      },
`,
    },
];
