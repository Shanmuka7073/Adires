'use client';

import { getStorage, FirebaseStorage } from 'firebase/storage';
import { app } from './app';

/**
 * MODULAR STORAGE SDK
 * Loaded only for asset management and image uploads.
 */
export const storage: FirebaseStorage = getStorage(app);
