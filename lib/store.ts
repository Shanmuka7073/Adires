
'use client';

/**
 * ROOT LEVEL REDIRECT
 * Ensures all hooks and state are accessible via both root and @ aliases.
 */

import { useAppStore as useAppStoreInternal } from '@/lib/store';

export const useAppStore = useAppStoreInternal;
export type { AppState } from '@/lib/store';
