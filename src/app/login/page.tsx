
'use client';

import { useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import LoginForm from './login-form';
import { Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'admin@gmail.com';

/**
 * Login Page.
 * Redirects users to their dashboard once authenticated.
 * Verification is now handled via a non-blocking banner in the layout.
 */
export default function LoginPage() {
  const { user, isUserLoading, firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  // REDIRECTION ENGINE
  // We allow users into the app as soon as they are logged in.
  // Verification status is checked globally in the layout banner.
  useEffect(() => {
    if (isUserLoading || isProfileLoading) return;

    if (user && userData) {
       const isAdmin = user.email === ADMIN_EMAIL || user.email === 'admin2@gmail.com';
       
       if (isAdmin) {
            router.push('/dashboard/admin');
       } else if (userData.accountType === 'restaurant') {
            router.push('/dashboard/restaurant');
       } else {
            router.push(redirectTo);
       }
    }
  }, [user, isUserLoading, isProfileLoading, userData, router, redirectTo]);

  if (isUserLoading || (user && isProfileLoading)) {
    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Authenticating...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center py-12 px-4">
      <LoginForm />
    </div>
  );
}
