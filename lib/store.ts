
'use client';

/**
 * ROOT LEVEL REDIRECT
 * This file exists at the root level but delegates logic to the @/lib alias.
 * This resolves TypeScript build errors when Next.js attempts to compile the 프로젝트 root.
 */

import { useAppStore as useAppStoreInternal } from '@/lib/store';

export const useAppStore = useAppStoreInternal;
export type { AppState, ProfileFormValues } from '@/lib/store';
