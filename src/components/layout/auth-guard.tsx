'use client';

import { useAdminAuth } from '@/hooks/use-admin-auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';
import GlobalLoader from './global-loader';
import { useToast } from '@/hooks/use-toast';

/**
 * CENTRALIZED ROUTING ENGINE
 * Monitors and enforces access based on user role and session state.
 * Includes loop detection and state validation.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, isMerchant, isLoading, error } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  
  // Monitoring Layer: Redirect Tracking
  const redirectHistory = useRef<{ path: string; count: number }>({ path: '', count: 0 });

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
        // DETECT REDIRECT LOOPS (same route triggered > 3 times)
        if (redirectHistory.current.path === redirectPath) {
            redirectHistory.current.count++;
        } else {
            redirectHistory.current = { path: redirectPath, count: 1 };
        }

        if (redirectHistory.current.count > 3) {
            console.error(`[AUTH_CRITICAL] Redirect loop detected at: ${redirectPath}`);
            toast({
                variant: 'destructive',
                title: 'System state error detected',
                description: 'A navigation loop was prevented. Please refresh the page or check your account role.',
            });
            return; // Terminate redirect to prevent browser hang
        }

        router.replace(redirectPath);
    } else {
        // Path matches or no redirect needed, stabilize history
        redirectHistory.current = { path: '', count: 0 };
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
