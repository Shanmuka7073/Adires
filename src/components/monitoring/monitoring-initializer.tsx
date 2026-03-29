
'use client';

import { useEffect, useRef } from 'react';
import { useFirebase } from '@/firebase';
import { logEvent } from '@/lib/monitoring/logger';
import { usePathname } from 'next/navigation';

/**
 * Global Monitoring System
 * Detects network state, global errors, performance, and auth anomalies.
 */
export function MonitoringInitializer() {
  const { firestore, user, profile, authLoading, profileLoading, appReady } = useFirebase();
  const pathname = usePathname();
  
  // Track start time for performance
  const startTimeRef = useRef(Date.now());
  const redirectTracker = useRef<{ path: string; count: number; lastTime: number }>({ path: '', count: 0, lastTime: 0 });
  const loadLogged = useRef(false);

  useEffect(() => {
    if (!firestore) return;

    // 1. Global Error Handlers
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

    // 2. Network Monitoring
    const handleOffline = () => {
      logEvent(firestore, {
        message: 'Device disconnected from network',
        type: 'network_disconnected',
        severity: 'warning',
        route: window.location.pathname,
        userId: user?.uid
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('offline', handleOffline);
    };
  }, [firestore, user, profile]);

  // 3. Performance & Auth Anomaly Monitoring
  useEffect(() => {
    if (!firestore) return;

    // Detect startup performance
    if (appReady && !loadLogged.current) {
      const loadTime = Date.now() - startTimeRef.current;
      loadLogged.current = true;
      
      if (loadTime > 2000) {
        logEvent(firestore, {
          message: `Slow app ready state: ${loadTime}ms`,
          type: 'slow_startup',
          severity: 'warning',
          route: pathname,
          metadata: { loadTimeMs: loadTime }
        });
      }
    }

    // Detect loading deadlock
    if (profileLoading) {
      const timer = setTimeout(() => {
        if (profileLoading) {
          logEvent(firestore, {
            message: 'Profile load hanging > 5s',
            type: 'loading_deadlock',
            severity: 'critical',
            route: pathname,
            userId: user?.uid
          });
        }
      }, 5000);
      return () => clearTimeout(timer);
    }

    // Detect role inconsistency
    if (appReady && user && !profile) {
      logEvent(firestore, {
        message: 'Auth/Profile mismatch: User exists but profile document missing',
        type: 'auth_mismatch',
        severity: 'critical',
        route: pathname,
        userId: user.uid
      });
    }
  }, [appReady, profileLoading, user, profile, firestore, pathname]);

  // 4. Redirect Loop Detection
  useEffect(() => {
    if (!firestore) return;
    
    const now = Date.now();
    if (redirectTracker.current.path === pathname) {
      if (now - redirectTracker.current.lastTime < 3000) {
        redirectTracker.current.count++;
      } else {
        redirectTracker.current.count = 1;
      }
    } else {
      redirectTracker.current = { path: pathname, count: 1, lastTime: now };
    }

    if (redirectTracker.current.count > 3) {
      logEvent(firestore, {
        message: `Redirect loop detected on path: ${pathname}`,
        type: 'redirect_loop',
        severity: 'critical',
        route: pathname,
        userId: user?.uid
      });
    }
    
    redirectTracker.current.lastTime = now;
  }, [pathname, firestore, user]);

  return null;
}
