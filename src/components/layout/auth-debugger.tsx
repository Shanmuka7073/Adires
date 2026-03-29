'use client';

import { useEffect, useRef, useState } from 'react';
import { useFirebase, errorEmitter } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

/**
 * GLOBAL RUNTIME VERIFICATION LAYER
 * Monitors auth and profile states for invalid configurations or deadlocks.
 */
export function AuthDebugger() {
  const { user, profile, authLoading, profileLoading, appReady } = useFirebase();
  const { toast } = useToast();
  const pathname = usePathname();
  const loadingTimerRef = useRef<NodeJS.Timeout | null>(null);
  
  // State for Visual Health Indicator
  const [healthStatus, setHealthStatus] = useState<'ready' | 'syncing' | 'anomaly'>('syncing');

  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    // 1. GLOBAL AUTH STATE LOGGER
    console.log('[AUTH_STATE]', {
      userId: user?.uid || 'null',
      email: user?.email || 'none',
      authLoading,
      profileLoading,
      appReady,
      accountType: profile?.accountType || 'undefined',
      route: pathname
    });

    // 2. INVALID STATE DETECTION
    
    // A. accountType undefined after profile load
    if (!profileLoading && user && profile && !profile.accountType) {
      console.warn("Invalid state: accountType missing after profile load");
      setHealthStatus('anomaly');
    }

    // B. appReady true but user null (Check if this is intentional for specific routes)
    if (appReady && !user && !['/login', '/signup', '/'].includes(pathname)) {
      console.warn("Invalid state: app ready but no user in protected context");
    }

    // C. Loading Deadlock Detection (>5s)
    if (profileLoading) {
      if (!loadingTimerRef.current) {
        loadingTimerRef.current = setTimeout(() => {
          console.error("Possible loading deadlock: profileLoading stuck > 5 seconds");
          setHealthStatus('anomaly');
          toast({
            variant: 'destructive',
            title: 'System state error detected',
            description: 'Profile loading time exceeded 5 seconds. Check Firestore connection.',
          });
        }, 5000);
      }
    } else {
      if (loadingTimerRef.current) {
        clearTimeout(loadingTimerRef.current);
        loadingTimerRef.current = null;
      }
    }

    // D. Auth/Profile Mismatch
    if (!authLoading && profileLoading && !user) {
        console.warn("Auth/Profile mismatch: profileLoading is true but user is null");
    }

    // Update Status for Badge
    if (appReady) {
        setHealthStatus(prev => prev === 'anomaly' ? 'anomaly' : 'ready');
    } else {
        setHealthStatus('syncing');
    }

  }, [user, profile, authLoading, profileLoading, appReady, pathname, toast]);

  // 4. FIRESTORE FAILURE DETECTION (Listen to Global Emitter)
  useEffect(() => {
    const handleFirestoreError = (err: any) => {
        console.error("[FIRESTORE_ERROR]", err.message);
        setHealthStatus('anomaly');
    };
    errorEmitter.on('permission-error', handleFirestoreError);
    return () => errorEmitter.off('permission-error', handleFirestoreError);
  }, []);

  // 5. MANUAL TEST FUNCTION: window.runAppTest()
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).runAppTest = () => {
        console.log("%c --- INITIATING SYSTEM AUDIT --- ", "background: #1e293b; color: #10b981; font-weight: bold; padding: 4px;");
        
        const results = {
            authStatus: user ? "AUTHENTICATED" : "GUEST",
            profileLoaded: !!profile,
            accountType: profile?.accountType || "MISSING",
            isReady: appReady,
            environment: process.env.NODE_ENV
        };

        console.table(results);

        let failed = false;
        if (user && !profile) { console.error("FAIL: Authenticated but profile document missing."); failed = true; }
        if (user && profile && !profile.accountType) { console.error("FAIL: Profile document exists but accountType is undefined."); failed = true; }
        if (!appReady && !authLoading && !profileLoading) { console.error("FAIL: App is not ready but loading states are finished."); failed = true; }

        if (!failed) {
            console.log("%c SYSTEM VALIDATION PASSED ", "background: #10b981; color: #fff; font-weight: bold; padding: 2px 8px; border-radius: 4px;");
        } else {
            console.error("SYSTEM VALIDATION FAILED - CHECK ANOMALIES ABOVE");
        }
      };
    }
  }, [user, profile, appReady, authLoading, profileLoading]);

  // Render Visual Health Badge (Development Only)
  if (process.env.NODE_ENV !== 'development') return null;

  return (
    <div className="fixed top-2 right-2 z-[9999] pointer-events-none">
      <div className={cn(
        "px-2 py-1 rounded-md text-[8px] font-black uppercase tracking-widest text-white shadow-xl flex items-center gap-1.5 transition-all duration-500",
        healthStatus === 'ready' ? "bg-green-500" :
        healthStatus === 'syncing' ? "bg-amber-500" :
        "bg-red-600 animate-pulse scale-110"
      )}>
        <div className={cn(
            "h-1.5 w-1.5 rounded-full bg-white",
            healthStatus !== 'ready' && "animate-pulse"
        )} />
        {healthStatus === 'ready' ? 'Auth Ready' : 
         healthStatus === 'syncing' ? 'Syncing...' : 'Anomaly Detected'}
      </div>
    </div>
  );
}
