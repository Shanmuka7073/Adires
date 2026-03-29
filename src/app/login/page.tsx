
'use client';

import { useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import LoginForm from './login-form';
import { Loader2 } from 'lucide-react';

const ADMIN_EMAIL = 'shanmuka7073@gmail.com';

/**
 * Login Page.
 * Standardized to redirect to the Home Page (/) by default for all users.
 * This prevents mandatory dashboard loops and provides a cleaner entry point.
 */
export default function LoginPage() {
  const { user, isUserLoading, firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo') || '/';
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  useEffect(() => {
    if (isUserLoading || isProfileLoading) return;

    if (user && userData) {
       // Standardized to route everyone back to the marketplace or their intended destination.
       // Owners and Admins can access their tools via the Header dropdown.
       router.push(redirectTo);
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
