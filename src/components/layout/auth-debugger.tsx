'use client';

import { useEffect, useRef } from 'react';
import { useFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';

/**
 * Global Monitoring Layer for Auth and Profile States.
 * Provides real-time logging and invalid state detection.
 */
export function AuthDebugger() {
  const { user, profile, authLoading, profileLoading, appReady } = useFirebase();
  const { toast } = useToast();
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const reportedErrors = useRef<Set<string>>(new Set());

  const reportError = (key: string, message: string) => {
    if (reportedErrors.current.has(key)) return;
    reportedErrors.current.add(key);
    
    console.error(`[AUTH_CRITICAL] ${message}`);
    toast({
      variant: 'destructive',
      title: 'System state error detected',
      description: message,
    });
  };

  useEffect(() => {
    // Requirements: Log ONLY in development mode
    if (process.env.NODE_ENV === 'development') {
      const accountType = profile?.accountType;
      console.log(
        `[AUTH_FLOW] user: ${user?.uid || 'null'} (${user?.email || 'none'}), authLoading: ${authLoading}, profileLoading: ${profileLoading}, appReady: ${appReady}, accountType: ${accountType || 'undefined'}`
      );
    }

    // INVALID STATE DETECTION:
    
    // 1. Profile missing for authenticated user
    if (appReady && user && !profile) {
        reportError('profile_missing', 'User is authenticated but the Firestore profile document is missing.');
    }

    // 2. accountType is undefined after profileLoading = false
    if (appReady && user && profile && !profile.accountType) {
      reportError('account_type_missing', 'Profile loaded but accountType is undefined. This will cause routing issues.');
    }

    // 3. appReady = true but user is null (Guest Check - info only)
    if (appReady && !user && process.env.NODE_ENV === 'development') {
      console.warn('[AUTH_FLOW] App ready in Guest context.');
    }

    // 4. profileLoading stuck > 5 seconds
    if (profileLoading) {
      if (!loadingTimerRef.current) {
        loadingTimerRef.current = setTimeout(() => {
          reportError('stuck_loading', 'Profile loading has been active for more than 5 seconds. Possible network deadlock.');
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
