
'use client';

/**
 * ROOT LEVEL REDIRECT
 * This file exists at the root level but delegates to the consolidated @/components folder.
 * This fixes the "Cannot find module ./global-loader" error during build.
 */

import { ClientRoot as ClientRootInternal } from '@/components/layout/client-root';

export const ClientRoot = ClientRootInternal;
