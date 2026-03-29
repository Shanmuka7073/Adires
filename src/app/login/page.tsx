
'use client';

import { useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import LoginForm from './login-form';
import { Loader2 } from 'lucide-react';

const ADMIN_EMAILS = ['admin@gmail.com', 'adires@gmail.com'];

/**
 * Login Page.
 * Implements role-based redirection:
 * - Admins -> Decision Hub
 * - Merchants -> Merchant Hub (Dashboard)
 * - Customers -> Home Page
 */
export default function LoginPage() {
  const { user, isUserLoading, firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  useEffect(() => {
    if (isUserLoading || isProfileLoading) return;

    if (user && userData) {
       const isAdmin = ADMIN_EMAILS.includes(user.email || '');
       
       if (isAdmin) {
            router.push('/dashboard/admin');
       } else if (userData.accountType === 'restaurant') {
            router.push('/dashboard');
       } else {
            // Customers go to the intended page or the marketplace home
            router.push(redirectTo || '/');
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
