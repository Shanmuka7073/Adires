'use client';

import { useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import LoginForm from './login-form';
import { Loader2 } from 'lucide-react';

const ADMIN_EMAILS = ['admin@gmail.com', 'adires@gmail.com', 'shanmuka7073@gmail.com'];

/**
 * AUTHENTICATION HUB
 * Implements role-specific redirection logic to ensure operational efficiency.
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

    if (user) {
       // 1. ADMIN PRIORITY: Check email address for platform authority
       const isAdmin = ADMIN_EMAILS.includes(user.email || '');
       
       if (isAdmin) {
            router.push('/dashboard/admin');
            return;
       }

       // 2. MERCHANT SYNC: Check account type for store owners
       if (userData?.accountType === 'restaurant') {
            router.push('/dashboard');
            return;
       }

       // 3. CUSTOMER FALLBACK: Home or intended destination
       router.push(redirectTo || '/');
    }
  }, [user, isUserLoading, isProfileLoading, userData, router, redirectTo]);

  if (isUserLoading || (user && isProfileLoading)) {
    return (
        <div className="flex h-screen items-center justify-center bg-[#FDFCF7]">
            <div className="flex flex-col items-center gap-4">
                <div className="relative">
                    <div className="h-12 w-12 rounded-full border-4 border-primary/20" />
                    <div className="absolute top-0 left-0 h-12 w-12 rounded-full border-t-4 border-primary animate-spin" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Synchronizing Identity...</p>
            </div>
        </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center py-12 px-4 bg-[#FDFCF7]">
      <LoginForm />
    </div>
  );
}
