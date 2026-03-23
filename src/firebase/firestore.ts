'use client';

import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  Firestore
} from 'firebase/firestore';
import { app } from './app';

/**
 * MODULAR FIRESTORE SDK (HEAVY)
 * Initialized with persistent local cache for high-performance offline support.
 * This file is only loaded when data fetching is actually required.
 */
export const db: Firestore = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  ignoreUndefinedProperties: true,
});
