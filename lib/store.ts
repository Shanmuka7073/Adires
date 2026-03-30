'use client';

import { create } from 'zustand';
import { collection, getDocs } from 'firebase/firestore';
import type { Store } from '@/lib/types';
import { toast } from '@/hooks/use-toast';
import { Firestore } from 'firebase/firestore';

interface AppState {
  stores: Store[];
  isFetchingStores: boolean;
  isInitialized: boolean;
  fetchInitialData: (db: Firestore) => Promise<void>;
  clearStores: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  stores: [],
  isFetchingStores: false,
  isInitialized: false,
  fetchInitialData: async (db: Firestore) => {
    if (get().isInitialized || get().isFetchingStores) return;

    set({ isFetchingStores: true });
    try {
      const querySnapshot = await getDocs(collection(db, 'stores'));
      const stores = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Store));
      set({ stores: stores, isInitialized: true });
    } catch (error) {
        toast({ variant: 'destructive', title: 'Could not fetch hubs.' });
      set({ isInitialized: false });
    } finally {
      set({ isFetchingStores: false });
    }
  },
  clearStores: () => set({ stores: [], isInitialized: false }),
}));
