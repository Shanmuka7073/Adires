
'use client';

export const readExplosionCodeText = `
// src/lib/store.ts

// Inside the fetchInitialData function:

/**
 * 🚨 PERFORMANCE BOTTLENECK: READ EXPLOSION (N+3)
 * 
 * This function is called on every cold start. 
 * If you have 50 stores, this code triggers ~55-60 Firestore reads 
 * for EVERY user that opens the app.
 */
fetchInitialData: async (db: Firestore) => {
  if (get().loading) return;

  set({ loading: true, error: null, readCount: 0, writeCount: 0 });
  
  try {
    // 1. Initial 4 reads (Stores, Master Products, Aliases, Commands)
    const [stores, masterProducts, aliasDocs, commandDocs] = await Promise.all([
      getStores(db),
      getMasterProducts(db),
      getDocs(collection(db, 'voiceAliasGroups')),
      getDocs(collection(db, 'voiceCommands'))
    ]);

    // 🔥 THE EXPLOSION HAPPENS HERE:
    // We map over the 'stores' array and create a NEW promise for every single store ID.
    // Firestore charges 1 read for the query, even if the result is empty.
    const menuPromises = stores.map(store => 
        getDocs(query(collection(db, \`stores/\${store.id}/menus\`)))
    );

    // If 'stores' has length 100, this line launches 100 concurrent Firestore requests.
    const menuSnapshots = await Promise.all(menuPromises);
    
    // ... rest of the logic ...
  } catch (error) {
    console.error("Failed to fetch initial app data:", error);
  }
}

/**
 * STRATEGY FOR FIXING:
 * 1. Remove the menu loop from initialization.
 * 2. Fetch a store's menu ONLY when a user actually navigates to that store.
 * 3. Store the fetched menu in the Zustand state to cache it for the session.
 */
`;
