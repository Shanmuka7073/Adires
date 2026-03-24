'use client';

import { 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  type Firestore
} from 'firebase/firestore';
import { getFirebaseApp } from './app';

/**
 * MODULAR FIRESTORE GETTER
 * Initialized with persistent local cache for high-performance offline support.
 */
export function getFirestoreInstanceInternal(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;
  
  return initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    ignoreUndefinedProperties: true,
  });
}
