
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
 * Main Login Route.
 * Handles the page layout and automated redirection based on user role.
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

  // AUTHORITY REDIRECTION ENGINE
  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && userData) {
       if (user.email === ADMIN_EMAIL) {
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
                <p className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">Verifying Authority...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-160px)] items-center justify-center py-12 px-4">
      <LoginForm />
    </div>
  );
}
