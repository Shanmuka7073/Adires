'use client';

import { useEffect, useRef } from 'react';
import { useFirebase } from '@/firebase';

/**
 * Global Monitoring Layer for Auth and Profile States.
 * Provides real-time logging and invalid state detection in development mode.
 */
export function AuthDebugger() {
  const { user, profile, authLoading, profileLoading, appReady } = useFirebase();
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Requirements: Log ONLY in development mode
    if (process.env.NODE_ENV !== 'development') return;

    const accountType = profile?.accountType;
    
    // Requirements: Output format: [AUTH_FLOW] user: ..., authLoading: ..., profileLoading: ..., appReady: ..., accountType: ...
    console.log(
      `[AUTH_FLOW] user: ${user?.uid || 'null'} (${user?.email || 'none'}), authLoading: ${authLoading}, profileLoading: ${profileLoading}, appReady: ${appReady}, accountType: ${accountType || 'undefined'}`
    );

    // INVALID STATE DETECTION:
    
    // 1. accountType is undefined after profileLoading = false
    if (user && !profileLoading && !accountType) {
      console.warn('[AUTH_FLOW] WARNING: profileLoading finished but accountType is undefined. This will cause routing issues.');
    }

    // 2. appReady = true but user is null
    if (appReady && !user) {
      console.warn('[AUTH_FLOW] WARNING: appReady is true but user is null. System is operating in Guest context.');
    }

    // 3. profileLoading stuck > 5 seconds
    if (profileLoading) {
      if (!loadingTimerRef.current) {
        loadingTimerRef.current = setTimeout(() => {
          console.error('[AUTH_FLOW] CRITICAL: profileLoading is stuck (> 5s). Possible network failure or unhandled promise.');
        }, 5000);
      }
    } else {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }
  }, [user, profile, authLoading, profileLoading, appReady]);

  return null;
}
