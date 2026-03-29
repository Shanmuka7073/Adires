'use client';

import { useState, useEffect, useTransition, Suspense } from 'react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mail, Lock, Chrome } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { useSearchParams } from 'next/navigation';

function SignupContent() {
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isPending, startTransition] = useTransition();
  const [signupSource, setSignupSource] = useState<'merchant' | 'customer'>('merchant');

  useEffect(() => {
      if (redirectTo?.startsWith('/menu/')) {
          setSignupSource('customer');
      }
  }, [redirectTo]);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password || !firestore) return;

    startTransition(async () => {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          const accountType = signupSource === 'customer' ? 'customer' : 'restaurant';

          await setDoc(doc(firestore, "users", user.uid), {
            id: user.uid,
            email: user.email,
            uid: user.uid,
            accountType: accountType,
            firstName: '',
            lastName: '',
            phoneNumber: '',
            address: ''
          });

          toast({ title: 'Account Created' });
          // Routing is handled by global AuthGuard
        } catch (error: any) {
            toast({
                variant: 'destructive',
                title: 'Signup Failed',
                description: error.code === 'auth/email-already-in-use' ? "Email already registered." : "Could not create account.",
            });
        }
    });
  };

  const handleGoogleSignup = async () => {
    if (!auth || !firestore) return;
    
    startTransition(async () => {
        try {
          const provider = new GoogleAuthProvider();
          const result = await signInWithPopup(auth, provider);
          const user = result.user;

          const userRef = doc(firestore, 'users', user.uid);
          const snap = await getDoc(userRef);

          if (!snap.exists()) {
              const accountType = signupSource === 'customer' ? 'customer' : 'restaurant';
              await setDoc(userRef, {
                  id: user.uid,
                  uid: user.uid,
                  email: user.email,
                  accountType: accountType,
                  firstName: user.displayName?.split(' ')[0] || '',
                  lastName: user.displayName?.split(' ')[1] || '',
                  phoneNumber: user.phoneNumber || '',
                  address: ''
              }, { merge: true });
          }
          
          toast({ title: 'Welcome!' });
          // Routing is handled by global AuthGuard
        } catch (error: any) {
            toast({ variant: 'destructive', title: 'Google Error', description: error.message });
        }
    });
  };

  return (
    <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl">
      <CardContent className="p-8 space-y-8">
        <div className="text-center space-y-2">
            <h2 className="text-2xl font-black uppercase tracking-tight italic">Create Account</h2>
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                Role: {signupSource === 'merchant' ? 'Business Owner' : 'Personal Member'}
            </p>
        </div>
        <form onSubmit={handleSignup} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Email ID</label>
            <div className="relative">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
              <Input 
                type="email"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-14 rounded-2xl border-2 pl-12 font-bold"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Password</label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
              <Input 
                type="password"
                placeholder="••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-14 rounded-2xl border-2 pl-12 font-bold"
                required
              />
            </div>
          </div>

          <Button 
            type="submit" 
            disabled={isPending}
            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20"
          >
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign Up'}
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-black/5" /></div>
          <div className="relative flex justify-center"><span className="bg-white px-4 text-[8px] font-black uppercase tracking-[0.3em] opacity-20">Identity Provider</span></div>
        </div>

        <Button onClick={handleGoogleSignup} variant="outline" disabled={isPending} className="w-full h-14 rounded-2xl border-2 font-bold gap-3">
          <Chrome className="h-5 w-5 text-blue-500" />
          <span>Sign up with Google</span>
        </Button>

        <div className="text-center">
            <p className="text-xs text-gray-500">
                Already have an account?{' '}
                <Link href={`/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`} className="font-medium text-primary hover:underline">Log In</Link>
            </p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCF7] py-12 px-4">
      <div className="w-full max-w-md mx-auto">
        <Suspense fallback={<Loader2 className="animate-spin h-8 w-8 opacity-20 mx-auto" />}>
          <SignupContent />
        </Suspense>
      </div>
    </div>
  );
}
