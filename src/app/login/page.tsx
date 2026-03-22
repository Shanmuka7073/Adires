
'use client';

import { useEffect, useTransition } from 'react';
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
 * Enforces email verification for all users except platform admins.
 */
export default function LoginPage() {
  const { user, isUserLoading, firestore, auth } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  const [isChecking, startChecking] = useTransition();
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  // REDIRECTION ENGINE
  useEffect(() => {
    if (isUserLoading || isProfileLoading) return;

    const isAdmin = user && (user.email === ADMIN_EMAIL || user.email === 'admin2@gmail.com');
    const isVerified = user && (user.emailVerified || isAdmin);

    if (user && userData && isVerified) {
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
        toast({ 
            title: "Verification Sent!", 
            description: "Check your spam folder if you don't see it." 
        });
      } catch (err: any) {
        toast({ variant: 'destructive', title: "System Busy", description: err.message });
      }
    }
  };

  const handleCheckVerification = async () => {
    if (user) {
      startChecking(async () => {
        try {
          // Force Firebase to refresh the user's ID token and profile data
          await user.reload();
          
          if (user.emailVerified) {
            toast({ 
              title: "Account Verified!", 
              description: "Success! Taking you to your dashboard." 
            });
            // Force a full page reload to refresh the context with the now-verified user
            window.location.reload();
          } else {
            toast({ 
              variant: 'destructive', 
              title: "Not Verified Yet", 
              description: "Please check your inbox and click the verification link first." 
            });
          }
        } catch (err: any) {
          console.error("Verification check failed:", err);
          toast({ 
            variant: 'destructive', 
            title: "Check Failed", 
            description: err.message 
          });
        }
      });
    }
  };

  const handleLogout = async () => {
    if (auth) await signOut(auth);
  };

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

  // VERIFICATION BLOCKER UI (PROFESSIONAL)
  if (user && !user.emailVerified && user.email !== ADMIN_EMAIL) {
    return (
        <div className="container mx-auto flex min-h-screen items-center justify-center py-12 px-4">
            <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-amber-500 rounded-[2.5rem] overflow-hidden bg-white animate-in zoom-in-95 duration-500">
                <CardHeader className="text-center pt-10">
                    <CardTitle className="text-3xl font-black font-headline tracking-tighter uppercase italic text-amber-600">Activate Account</CardTitle>
                    <CardDescription className="font-black opacity-40 uppercase text-[10px] tracking-[0.2em] mt-1">Verification Required</CardDescription>
                </CardHeader>
                <CardContent className="p-8 space-y-8 text-center">
                    <div className="mx-auto w-20 h-20 rounded-[2rem] bg-amber-50 flex items-center justify-center text-amber-500 shadow-inner">
                        <Mail className="h-10 w-10" />
                    </div>
                    <div className="space-y-2">
                        <p className="text-sm text-gray-600 font-bold leading-relaxed">
                            Hello, <strong>{user.displayName || 'Friend'}</strong>.
                        </p>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            We've sent a secure activation link to <span className="font-bold text-gray-900">{user.email}</span>.
                            Please verify your inbox to unlock your dashboard.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3">
                        <Button 
                            onClick={handleCheckVerification} 
                            disabled={isChecking}
                            className="w-full h-14 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-amber-500/20"
                        >
                            {isChecking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                            I've Verified My Email
                        </Button>
                        <Button 
                            variant="outline" 
                            onClick={handleResendEmail} 
                            className="w-full h-12 rounded-xl font-black uppercase text-[10px] tracking-widest border-2"
                        >
                            Resend Activation Link
                        </Button>
                        <button 
                            onClick={handleLogout} 
                            className="text-[10px] font-black uppercase tracking-widest opacity-40 hover:opacity-100 flex items-center justify-center gap-2 pt-4 transition-opacity"
                        >
                            <LogOut className="h-3 w-3" /> Sign Out & Switch Account
                        </button>
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
