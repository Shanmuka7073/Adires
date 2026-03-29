'use client';

import { useEffect, useRef } from 'react';
import { useFirebase, errorEmitter } from '@/firebase';
import { logEvent } from '@/lib/monitoring/logger';
import { usePathname } from 'next/navigation';

/**
 * Global Monitoring System
 * Detects network state, global errors, and performance anomalies.
 */
export function MonitoringInitializer() {
  const { firestore, user, profile, authLoading, profileLoading, appReady } = useFirebase();
  const pathname = usePathname();
  
  const startTimeRef = useRef(Date.now());
  const loadLogged = useRef(false);

  useEffect(() => {
    if (!firestore) return;

    // Capture Global Runtime Errors
    const handleError = (event: ErrorEvent) => {
      logEvent(firestore, {
        message: event.message,
        type: 'runtime_error',
        severity: 'error',
        route: window.location.pathname,
        stack: event.error?.stack,
        userId: user?.uid,
        accountType: profile?.accountType
      });
    };

    // Capture Unhandled Rejections (Async)
    const handleRejection = (event: PromiseRejectionEvent) => {
      logEvent(firestore, {
        message: event.reason?.message || 'Unhandled Promise Rejection',
        type: 'promise_rejection',
        severity: 'error',
        route: window.location.pathname,
        stack: event.reason?.stack,
        userId: user?.uid,
        accountType: profile?.accountType
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [firestore, user, profile]);

  // Firestore Failure Detection (Hook into the global emitter)
  useEffect(() => {
    if (!firestore) return;
    
    const handleFirestoreError = (err: any) => {
        logEvent(firestore, {
            message: err.message,
            type: 'firestore_permission_denied',
            severity: 'error',
            route: pathname,
            userId: user?.uid,
            metadata: { context: err.request }
        });
    };

    errorEmitter.on('permission-error', handleFirestoreError);
    return () => errorEmitter.off('permission-error', handleFirestoreError);
  }, [firestore, pathname, user]);

  return null;
}
