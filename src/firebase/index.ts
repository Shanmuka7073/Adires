'use client';

/**
 * FIREBASE HUB (OPTIMIZED V3)
 * Implements full lazy-loading for all services to minimize initial bundle size.
 */

import { getFirebaseApp } from './app';
import { getAuthInstance } from './auth';

export { getFirebaseApp, getAuthInstance };

// Dynamic loaders for heavy services
export async function getFirestoreInstance() {
    const { getFirestoreInstanceInternal } = await import('./firestore');
    return getFirestoreInstanceInternal();
}

export async function getStorageInstance() {
    const { getStorageInstanceInternal } = await import('./storage');
    return getStorageInstanceInternal();
}

export async function initializeAppCheckDeferred() {
    const { initAppCheck } = await import('./appcheck');
    return initAppCheck();
}

// Re-export common hooks and utilities
export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './errors';
export * from './error-emitter';
