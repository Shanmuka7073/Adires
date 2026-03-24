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
 * MODULAR FIRESTORE GETTER
 * Hardened to prevent "initializeFirestore() has already been called" errors.
 * Uses persistent local cache for high-performance offline support.
 */
export function getFirestoreInstanceInternal(): Firestore | null {
  const app = getFirebaseApp();
  if (!app) return null;

  // Return existing instance if available
  if (firestoreInstance) return firestoreInstance;

  try {
    // Attempt to initialize with persistence
    firestoreInstance = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true,
    });
  } catch (e: any) {
    // If already initialized (e.g. via HMR or other lazy loader), use getFirestore
    if (e.code === 'failed-precondition' || e.message?.includes('already been called')) {
      firestoreInstance = getFirestore(app);
    } else {
      console.error("Firestore init error:", e);
      return null;
    }
  }
  
  return firestoreInstance;
}
