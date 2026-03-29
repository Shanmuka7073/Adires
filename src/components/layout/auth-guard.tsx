'use client';

import { useAdminAuth } from '@/hooks/use-admin-auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import GlobalLoader from './global-loader';

/**
 * CENTRALIZED ROUTING ENGINE
 * Monitors and enforces access based on user role and session state.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, isMerchant, isLoading, error } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  
  // Monitoring Layer: Redirect Tracking
  const redirectCountRef = useRef(0);

  useEffect(() => {
    if (isLoading) return;

    const isPublicRoute = ['/login', '/signup', '/'].includes(pathname) || pathname.startsWith('/menu/');
    
    let redirectPath = null;

    if (!user && !isPublicRoute) {
      redirectPath = `/login?redirectTo=${pathname}`;
    } else if (user && pathname === '/login') {
      if (isAdmin) redirectPath = '/dashboard/admin';
      else if (isMerchant) redirectPath = '/dashboard';
      else redirectPath = '/';
    } else if (user && pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/customer')) {
        if (!isMerchant && !isAdmin) {
            redirectPath = '/';
        }
    }

    // Enforcement & Loop Detection
    if (redirectPath && redirectPath !== pathname) {
        if (process.env.NODE_ENV === 'development') {
            redirectCountRef.current++;
            console.log(`[AUTH_FLOW] Redirect detected: ${pathname} -> ${redirectPath} (Count: ${redirectCountRef.current})`);
            
            if (redirectCountRef.current > 3) {
                console.error(`[AUTH_FLOW] CRITICAL: Multiple redirects triggered in rapid succession. Investigate dependency loops.`);
            }
        }
        router.replace(redirectPath);
    } else {
        // Stabilization
        redirectCountRef.current = 0;
    }

  }, [user, profile, isLoading, pathname, router, isAdmin, isMerchant]);

  if (isLoading) return <GlobalLoader />;
  
  if (error) {
      return (
          <div className="flex h-screen items-center justify-center p-6 text-center">
              <div className="space-y-4">
                  <h1 className="text-2xl font-black uppercase text-red-600">Sync Error</h1>
                  <p className="text-sm opacity-60">We encountered a problem connecting to your profile.</p>
                  <button onClick={() => window.location.reload()} className="h-12 px-8 bg-primary text-white rounded-xl font-bold uppercase text-xs shadow-lg">Retry Connection</button>
              </div>
          </div>
      )
  }

  return <>{children}</>;
}
