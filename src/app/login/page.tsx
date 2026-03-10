
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
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import type { AuthError } from 'firebase/auth';
import { 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword,
    signInWithCustomToken,
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Fingerprint, Loader2, AlertCircle, Info } from 'lucide-react';
import { startAuthentication } from '@simplewebauthn/browser';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { User as AppUser } from '@/lib/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import Link from 'next/link';

const ADMIN_EMAIL = 'admin@gmail.com';
const CHICKEN_ADMIN_EMAIL = 'chickenadmin@gmail.com';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  accountType: z.enum(['groceries', 'restaurant']).optional(),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isWebAuthnPending, startWebAuthnTransition] = useTransition();
  const { auth, user, isUserLoading, firestore } = useFirebase();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const redirectTo = searchParams.get('redirectTo') || '/dashboard';
  
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);
  
  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);


  useEffect(() => {
    if (!isUserLoading && !isProfileLoading && user && userData) {
       if (user.email === ADMIN_EMAIL) {
            router.push('/dashboard/admin');
       } else if (user.email === CHICKEN_ADMIN_EMAIL) {
            router.push('/dashboard/chicken-admin');
       } else if (userData.accountType === 'restaurant') {
            router.push('/dashboard/restaurant');
       } else {
            router.push(redirectTo);
       }
    }
  }, [user, isUserLoading, isProfileLoading, userData, router, redirectTo]);


  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '', accountType: 'groceries' },
  });

  const { email } = form.watch();

  const handleWebAuthnLogin = async () => {
    if (!email) {
      setError("Please enter your email to sign in with your fingerprint.");
      return;
    }
    
    setError(null);
    startWebAuthnTransition(async () => {
      try {
        // 1. Get options from server
        const respOptions = await fetch('/api/auth/webauthn/generate-authentication-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        const options = await respOptions.json();

        if (!respOptions.ok) {
          throw new Error(options.error || 'Failed to get authentication options.');
        }
        
        // 2. Sign the challenge
        const assertion = await startAuthentication(options);

        // 3. Verify the assertion with the server
        const verificationResp = await fetch('/api/auth/webauthn/verify-authentication', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...assertion, email }),
        });
        
        const verificationJSON = await verificationResp.json();
        
        if (verificationJSON && verificationJSON.verified) {
            if (!auth) throw new Error("Authentication service not available.");
            await signInWithCustomToken(auth, verificationJSON.customToken);
            toast({ title: 'Welcome back!', description: 'Successfully signed in with your fingerprint.' });
        } else {
            throw new Error(verificationJSON.error || 'Fingerprint verification failed.');
        }

      } catch (error: any) {
        console.error("WebAuthn Error:", error);
        setError(error.message);
        toast({
          variant: 'destructive',
          title: 'Biometric Login Error',
          description: error.message,
        });
      }
    });
  };

  const onSubmit = (data: LoginFormValues) => {
    setError(null);
    if (!auth) {
        setError("Authentication service is not available.");
        return;
    }
    startTransition(() => {
        if (isSignUp) {
          if (!firestore) {
              setError("Database service is not available.");
              return;
          }
          createUserWithEmailAndPassword(auth, data.email, data.password)
            .then(async (userCredential) => {
                const newUser = userCredential.user;
                const userDocRef = doc(firestore, 'users', newUser.uid);
                await setDoc(userDocRef, {
                    id: newUser.uid,
                    email: newUser.email,
                    firstName: '',
                    lastName: '',
                    address: '',
                    phoneNumber: '',
                    accountType: data.accountType,
                });

                toast({
                    title: 'Account Created!',
                    description: 'Your account has been successfully created. You can now enable fingerprint login in your profile.',
                });
                setIsSignUp(false);
                form.reset();
            })
            .catch((err: AuthError) => {
                setError(err.message);
            });
        } else {
          signInWithEmailAndPassword(auth, data.email, data.password)
            .catch((err: AuthError) => {
              setError(err.message);
          });
        }
    });
  };

  return (
    <div className="container mx-auto flex min-h-[calc(100vh-200px)] items-center justify-center py-12 px-4">
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline font-bold">
            {isSignUp ? 'Create an Account' : 'Welcome Back'}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? 'Enter your details to get started with LocalBasket.'
              : 'Sign in to continue to your dashboard.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                        <Input id="email" type="email" placeholder="m@example.com" {...field} className="h-12 text-lg" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            
              {!isSignUp && (
                <div className="space-y-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full h-14 text-lg border-2 hover:bg-primary/5 transition-all group"
                      onClick={handleWebAuthnLogin}
                      disabled={isWebAuthnPending}
                    >
                      {isWebAuthnPending ? (
                        <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                      ) : (
                        <Fingerprint className="mr-2 h-6 w-6 text-primary group-hover:scale-110 transition-transform" />
                      )}
                      Sign in with Fingerprint
                    </Button>
                    
                    {error === 'No fingerprint registered for this email.' && (
                        <Alert className="bg-blue-50 border-blue-200">
                            <Info className="h-4 w-4 text-blue-600" />
                            <AlertTitle className="text-blue-800 text-sm">Need to register?</AlertTitle>
                            <AlertDescription className="text-blue-700 text-xs">
                                Log in with your password first, then go to your Profile to enable Fingerprint Login for this device.
                            </AlertDescription>
                        </Alert>
                    )}
                </div>
              )}

              {!isSignUp && (
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground font-semibold">Or continue with</span>
                    </div>
                </div>
              )}

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                        <Input id="password" type="password" {...field} className="h-12" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {isSignUp && (
                <FormField
                  control={form.control}
                  name="accountType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>I am joining as a...</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12">
                            <SelectValue placeholder="Select an account type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="groceries">Grocery Customer / Store Owner</SelectItem>
                          <SelectItem value="restaurant">Restaurant Owner</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {error && error !== 'No fingerprint registered for this email.' && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-md">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full h-12 text-lg font-bold bg-primary hover:bg-primary/90" disabled={isPending || isUserLoading}>
                {isPending
                  ? 'Please wait...'
                  : isSignUp
                  ? 'Create My Account'
                  : 'Sign In with Password'}
              </Button>
            </form>
          </Form>
          
          <div className="mt-8 pt-6 border-t text-center text-sm">
            {isSignUp ? (
              <p className="text-muted-foreground">
                Already have an account?{' '}
                <button 
                    onClick={() => setIsSignUp(false)}
                    className="text-primary font-bold hover:underline ml-1"
                >
                  Sign In here
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground">
                Don't have an account?{' '}
                <button 
                    onClick={() => setIsSignUp(true)}
                    className="text-primary font-bold hover:underline ml-1"
                >
                  Sign Up for free
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
