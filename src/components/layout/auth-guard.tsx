'use client';

import { useAdminAuth } from '@/hooks/use-admin-auth';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, Suspense } from 'react';
import GlobalLoader from './global-loader';

/**
 * INTERNAL ROUTING LOGIC
 * Encapsulated to allow Suspense wrapping for useSearchParams.
 */
function AuthRoutingInternal({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, isMerchant, isLoading } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const redirectTracker = useRef<{ lastPath: string; count: number; lastTimestamp: number }>({ 
    lastPath: '', 
    count: 0, 
    lastTimestamp: 0 
  });

  useEffect(() => {
    if (isLoading || !pathname) return;

    const isPublicRoute = ['/login', '/signup', '/', '/offline'].includes(pathname) || pathname.startsWith('/menu/');
    const redirectTo = searchParams.get('redirectTo');
    
    let redirectPath: string | null = null;

    // 1. ANONYMOUS ACCESS CONTROL
    if (!user && !isPublicRoute) {
      redirectPath = `/login?redirectTo=${encodeURIComponent(pathname)}`;
    } 
    // 2. POST-AUTH LANDING LOGIC
    else if (user && (pathname === '/login' || pathname === '/signup')) {
      if (isAdmin) {
          redirectPath = '/dashboard/admin';
      } else if (isMerchant) {
          redirectPath = '/dashboard';
      } else {
          // Customers go back to original destination or home
          // Ensure it's a relative path to prevent 404s on absolute URLs
          let target = redirectTo || '/';
          if (target.startsWith('http')) {
              try { target = new URL(target).pathname; } catch(e) { target = '/'; }
          }
          redirectPath = target;
      }
    } 
    // 3. ROLE-BASED AREA PROTECTION
    else if (user && pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/customer')) {
        if (!isMerchant && !isAdmin) {
            redirectPath = '/';
        }
    }

    // 4. EXECUTE REDIRECT WITH LOOP PROTECTION
    if (redirectPath && redirectPath !== pathname) {
        const now = Date.now();
        const tracker = redirectTracker.current;

        if (tracker.lastPath === redirectPath && (now - tracker.lastTimestamp < 3000)) {
            tracker.count++;
        } else {
            tracker.count = 1;
            tracker.lastPath = redirectPath;
        }
        
        tracker.lastTimestamp = now;

        if (tracker.count > 3) {
            console.error("[ROUTING] High-frequency redirect detected. Aborting to prevent infinite loop.");
            return; 
        }

        router.replace(redirectPath);
    }

  }, [user, profile, isLoading, pathname, router, isAdmin, isMerchant, searchParams]);

  if (isLoading) return <GlobalLoader />;
  
  return <>{children}</>;
}

/**
 * GLOBAL AUTH GUARD
 * Centralized authority for session-based routing.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
    return (
        <Suspense fallback={<GlobalLoader />}>
            <AuthRoutingInternal>
                {children}
            </AuthRoutingInternal>
        </Suspense>
    );
}
