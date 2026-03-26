
'use client';

import { 
  getFirestore,
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  CACHE_SIZE_UNLIMITED,
  type Firestore
} from 'firebase/firestore';
import { getFirebaseApp } from './app';

// Global reference to the firestore instance
let firestoreInstance: Firestore | null = null;

/**
 * HARDENED OFFLINE FIRESTORE INITIALIZATION
 * Configures the database for extreme resilience and unlimited local storage.
 */
export function getFirestoreInstanceInternal(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;

  if (firestoreInstance) return firestoreInstance;

  try {
    // 1. Initialize with Multi-Tab Persistence and Unlimited Cache
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({ 
        tabManager: persistentMultipleTabManager(),
        cacheSizeBytes: CACHE_SIZE_UNLIMITED 
      }),
      ignoreUndefinedProperties: true,
    });
    console.log("Adires: Firestore Persistence Enabled (Unlimited)");
  } catch (e: any) {
    // 2. Error Recovery: If already initialized or IndexedDB is locked
    if (e.code === 'failed-precondition' || e.message?.includes('already been called')) {
      firestoreInstance = getFirestore(app);
    } 
    // 3. Failover: If browser refuses IndexedDB, use Memory fallback
    else {
      console.warn("Adires: Persistence fallback to Memory:", e.message);
      firestoreInstance = getFirestore(app);
    }
  }
  
  return firestoreInstance;
}
