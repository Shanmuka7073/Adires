'use client';

import { getStorage, type FirebaseStorage } from 'firebase/storage';
import { getFirebaseApp } from './app';

/**
 * MODULAR STORAGE GETTER
 */
export function getStorageInstanceInternal(): FirebaseStorage | null {
  const app = getFirebaseApp();
  if (!app) return null;
  return getStorage(app);
}
