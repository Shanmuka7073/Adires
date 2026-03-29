
'use client';

import { useAdminAuth } from '@/hooks/use-admin-auth';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import GlobalLoader from './global-loader';

/**
 * CENTRALIZED ROUTING ENGINE
 * The only place in the app where automated redirects occur.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, isAdmin, isMerchant, isLoading, error } = useAdminAuth();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    // 1. PUBLIC ROUTES (Login, Signup, Menus)
    const isPublicRoute = ['/login', '/signup', '/'].includes(pathname) || pathname.startsWith('/menu/');
    
    // 2. AUTHENTICATION REDIRECTS
    if (!user && !isPublicRoute) {
      router.replace(`/login?redirectTo=${pathname}`);
      return;
    }

    // 3. LOGGED IN REDIRECTS (Auto-Dashboard)
    if (user && pathname === '/login') {
      if (isAdmin) router.replace('/dashboard/admin');
      else if (isMerchant) router.replace('/dashboard');
      else router.replace('/');
      return;
    }

    // 4. MERCHANT ACCESS RESTRICTION
    if (user && pathname.startsWith('/dashboard') && !pathname.startsWith('/dashboard/customer')) {
        if (!isMerchant && !isAdmin) {
            router.replace('/');
        }
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
