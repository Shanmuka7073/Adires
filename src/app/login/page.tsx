
'use client';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useState, useTransition, useEffect } from 'react';
import { useFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import { logLoginAttempt } from '@/app/actions';
import type { AuthError } from 'firebase/auth';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword 
} from 'firebase/auth';

const ADMIN_EMAIL = 'admin@gmail.com';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { auth, user, isUserLoading } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const redirectTo = searchParams.get('redirectTo') || '/dashboard';

  useEffect(() => {
    // If user is already logged in, redirect them away from the login page.
    if (!isUserLoading && user) {
       if (user.email === ADMIN_EMAIL) {
        router.push('/dashboard/admin');
      } else {
        router.push(redirectTo);
      }
    }
  }, [user, isUserLoading, router, redirectTo]);


  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const handleAuthError = (err: AuthError, email: string) => {
    setError(err.message);
    logLoginAttempt(email, 'failure', undefined, err.code);
  };

  const onSubmit = (data: LoginFormValues) => {
    setError(null);
    startTransition(() => {
        if (isSignUp) {
          createUserWithEmailAndPassword(auth, data.email, data.password)
            .then((userCredential) => {
                toast({
                    title: 'Account Created!',
                    description: 'Your account has been successfully created. Please log in.',
                });
                setIsSignUp(false); // Switch to login view after signup
                form.reset();
            })
            .catch((err: AuthError) => {
                // We don't log sign-up failures as malicious attempts.
                setError(err.message);
            });
        } else {
          signInWithEmailAndPassword(auth, data.email, data.password)
            .then(async (userCredential) => {
              // On successful sign-in, log the attempt and let the useEffect handle redirection.
              await logLoginAttempt(data.email, 'success', userCredential.user.uid);
            })
            .catch((err: AuthError) => {
              handleAuthError(err, data.email);
          });
        }
    });
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-200px)] items-center justify-center py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline">
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? 'Enter your details to get started.'
              : 'Sign in to continue.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                {...form.register('email')}
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                {...form.register('password')}
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.password.message}
                </p>
              )}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isPending || isUserLoading}>
              {isPending
                ? 'Processing...'
                : isSignUp
                ? 'Create Account'
                : 'Sign In'}
            </Button>
          </form>
          <div className="mt-6 text-center text-sm">
            {isSignUp ? (
              <>
                Already have an account?{' '}
                <Button variant="link" onClick={() => setIsSignUp(false)}>
                  Sign In
                </Button>
              </>
            ) : (
              <>
                Don't have an account?{' '}
                <Button variant="link" onClick={() => setIsSignUp(true)}>
                  Sign Up
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
