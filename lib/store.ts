'use client';

/**
 * ROOT LEVEL PROXY
 * Ensures all hooks and state are accessible via both root and @ aliases.
 */

import { useAppStore as useAppStoreInternal, useInitializeApp as useInitializeAppInternal } from '@/lib/store';

export const useAppStore = useAppStoreInternal;
export const useInitializeApp = useInitializeAppInternal;
export type { AppState } from '@/lib/store';
