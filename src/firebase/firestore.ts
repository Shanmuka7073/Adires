'use client';

import { 
  getFirestore,
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager,
  type Firestore
} from 'firebase/firestore';
import { getFirebaseApp } from './app';

// Global reference to the firestore instance
let firestoreInstance: Firestore | null = null;

/**
 * MODULAR FIRESTORE GETTER (RESILIENT)
 * Wraps persistence initialization to handle IndexedDB corruption or tab conflicts.
 */
export function getFirestoreInstanceInternal(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;

  // Return existing instance if available
  if (firestoreInstance) return firestoreInstance;

  try {
    // Attempt to initialize with multi-tab persistence
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
    console.log("Firestore initialized with Persistent Cache (Multi-Tab)");
  } catch (e: any) {
    // FALLBACK 1: If already initialized, just get the existing instance
    if (e.code === 'failed-precondition' || e.message?.includes('already been called')) {
      firestoreInstance = getFirestore(app);
    } 
    // FALLBACK 2: If IndexedDB fails (Corruption/Tab Lock), initialize with memory only
    else {
      console.warn("Firestore Persistence failed. Falling back to Memory Cache:", e.message);
      firestoreInstance = getFirestore(app);
    }
  }
  
  return firestoreInstance;
}
