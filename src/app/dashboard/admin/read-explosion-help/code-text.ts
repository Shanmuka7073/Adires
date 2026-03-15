
'use client';

export const readExplosionCodeText = `
// src/lib/store.ts

/**
 * 🚨 FIXED: PREVIOUS N+3 READ EXPLOSION
 * 
 * Previously, this function mapped over all stores and fetched menus.
 * If you had 100 stores, opening the app cost 103 reads per user.
 */
fetchInitialData: async (db: Firestore) => {
  // 1. Initial 3 lean reads (Stores, Master Products, Aliases, Commands)
  const [stores, masterProducts, aliasDocs, commandDocs] = await Promise.all([
    getStores(db),
    getMasterProducts(db),
    getDocs(collection(db, 'voiceAliasGroups')),
    getDocs(collection(db, 'voiceCommands'))
  ]);

  // ✅ FIX: The menu fetching loop has been removed from initialization.
  // Menus are now exclusively lazy-loaded at the page level.
  
  // 2. Updated Zustand state with lean data
  set({ stores, masterProducts, ... });
}

/**
 * 🚨 POS READ EXPLOSION (300 Reads)
 * 
 * If your Kitchen dashboard was reading 300+ documents for one table,
 * it means the query was missing the 'isActive' filter.
 * 
 * THE FIX:
 * Update POS query to: .where('isActive', '==', true)
 */
`;
