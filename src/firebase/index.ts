'use client';

/**
 * FIREBASE HUB (OPTIMIZED V2)
 * Re-exports services from modular files to support tree-shaking.
 * Heavweight services (Firestore, Storage, App Check) are strictly lazy-loaded.
 */

export { app as firebaseApp } from './app';
export { auth } from './auth';

// Dynamic loaders for heavy services
export async function getFirestoreInstance() {
    const { db } = await import('./firestore');
    return db;
}

export async function getStorageInstance() {
    const { storage } = await import('./storage');
    return storage;
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
