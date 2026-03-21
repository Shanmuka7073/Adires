'use client';

import { useEffect } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import LoginForm from './login-form';
import { Loader2, Mail, RefreshCw, LogOut } from 'lucide-react';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

const ADMIN_EMAIL = 'admin@gmail.com';

/**
 * Enhanced Login Page.
 * Blocks dashboard access for unverified users and displays a custom verification prompt.
 */
export default function LoginPage() {
  const { user, isUserLoading, firestore, auth } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  // REDIRECTION ENGINE
  useEffect(() => {
    const isAdmin = user && user.email === ADMIN_EMAIL;
    const isVerified = user && (user.emailVerified || isAdmin);

    if (!isUserLoading && !isProfileLoading && user && userData && isVerified) {
       if (isAdmin) {
            router.push('/dashboard/admin');
       } else if (userData.accountType === 'restaurant') {
            router.push('/dashboard/restaurant');
       } else {
            router.push(redirectTo);
       }
    }
  }, [user, isUserLoading, isProfileLoading, userData, router, redirectTo]);

  const handleResendEmail = async () => {
    if (user) {
      try {
        await sendEmailVerification(user);
        toast({ title: "Email Sent!", description: "Check your inbox for the link." });
      } catch (err: any) {
        toast({ variant: 'destructive', title: "Failed", description: err.message });
      }
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
  };

  if (isUserLoading || (user && isProfileLoading)) {
    return (
        <div className="flex h-screen items-center justify-center bg-background">
            <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
        </div>
    );
  }

  // VERIFICATION BLOCKER UI
  if (user && !user.emailVerified && user.email !== ADMIN_EMAIL) {
    return (
        <div className="container mx-auto flex min-h-screen items-center justify-center py-12 px-4">
            <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-amber-500 rounded-[2.5rem] overflow-hidden bg-white">
                <CardHeader className="text-center pt-8">
                    <CardTitle className="text-3xl font-black font-headline tracking-tighter uppercase italic text-amber-600">Verify Email</CardTitle>
                    <CardDescription className="font-bold opacity-40 uppercase text-[10px] tracking-widest">Activation Required</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-6 text-center">
                    <div className="mx-auto w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2">
                        <Mail className="h-8 w-8" />
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                        We've sent a verification link to <strong>{user.email}</strong>. 
                        Please click the link to activate your account.
                    </p>
                    <div className="flex flex-col gap-3">
                        <Button onClick={() => window.location.reload()} className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg">
                            <RefreshCw className="mr-2 h-4 w-4" /> I've Verified
                        </Button>
                        <Button variant="outline" onClick={handleResendEmail} className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-2">
                            Resend Link
                        </Button>
                        <Button variant="ghost" onClick={handleLogout} className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest opacity-40">
                            <LogOut className="mr-2 h-4 w-4" /> Sign Out
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <div className="container mx-auto flex min-h-screen items-center justify-center py-12 px-4">
      <LoginForm />
    </div>
  );
}