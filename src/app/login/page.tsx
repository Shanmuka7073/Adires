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
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Loader2, AlertCircle } from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { User as AppUser } from '@/lib/types';
import { t } from '@/lib/locales';

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
                    description: 'Your account has been created successfully.',
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
      <Card className="w-full max-w-md shadow-xl border-t-4 border-t-primary rounded-3xl overflow-hidden">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-headline font-bold">
            {isSignUp ? 'Join Adires' : 'Welcome Back'}
          </CardTitle>
          <CardDescription>
            {isSignUp
              ? 'Create an account to start shopping or managing your business.'
              : 'Sign in to access your Adires dashboard.'}
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
                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Email</FormLabel>
                    <FormControl>
                        <Input id="email" type="email" placeholder="m@example.com" {...field} className="h-12 rounded-xl" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-[10px] font-black uppercase opacity-40">Password</FormLabel>
                    <FormControl>
                        <Input id="password" type="password" {...field} className="h-12 rounded-xl" />
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
                      <FormLabel className="text-[10px] font-black uppercase opacity-40">I am joining as a...</FormLabel>
                       <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-12 rounded-xl">
                            <SelectValue placeholder="Select an account type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent className="rounded-2xl">
                          <SelectItem value="groceries">Personal Account (Shop & Order)</SelectItem>
                          <SelectItem value="restaurant">Business Account (Store, Restaurant, Salon)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              )}

              {error && (
                <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-xl">
                    <AlertCircle className="h-5 w-5 shrink-0" />
                    <p className="text-sm font-medium">{error}</p>
                </div>
              )}

              <Button type="submit" className="w-full h-14 text-lg font-black uppercase tracking-widest bg-primary hover:bg-primary/90 rounded-2xl shadow-xl shadow-primary/20" disabled={isPending || isUserLoading}>
                {isPending
                  ? 'Processing...'
                  : isSignUp
                  ? 'Create My Account'
                  : 'Sign In'}
              </Button>
            </form>
          </Form>
          
          <div className="mt-8 pt-6 border-t text-center text-sm">
            {isSignUp ? (
              <p className="text-muted-foreground font-medium">
                Already have an account?{' '}
                <button 
                    onClick={() => setIsSignUp(false)}
                    className="text-primary font-black uppercase text-xs hover:underline ml-1"
                >
                  Sign In
                </button>
              </p>
            ) : (
              <p className="text-muted-foreground font-medium">
                Don't have an account?{' '}
                <button 
                    onClick={() => setIsSignUp(true)}
                    className="text-primary font-black uppercase text-xs hover:underline ml-1"
                >
                  Sign Up Free
                </button>
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
