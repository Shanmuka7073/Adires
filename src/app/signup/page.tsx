
'use client';

import { useState, useEffect } from 'react';
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
import { useRouter, useSearchParams } from 'next/navigation';


export default function SignupPage() {
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirectTo');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [signupSource, setSignupSource] = useState<'merchant' | 'customer'>('merchant');

  useEffect(() => {
      // Check if user came from a specific menu/salon flow
      const context = localStorage.getItem('signup_context');
      if (context === 'menu_flow') {
          setSignupSource('customer');
      }
  }, []);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password || !firestore) return;

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // New users from adires.vercel.app directly are Merchants.
      // New users from a menu flow are Personal Accounts (Customers).
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

      toast({
          title: 'Account Created',
          description: `You have successfully joined as a ${accountType === 'restaurant' ? 'Merchant' : 'Member'}!`,
      });

      // Clear context
      localStorage.removeItem('signup_context');
      
      // SMART REDIRECT
      if (accountType === 'restaurant') {
          router.replace('/dashboard');
      } else {
          router.replace(redirectTo || '/');
      }

    } catch (error: any) {
        let message = "Could not create your account. Please try again.";
        if (error.code === 'auth/email-already-in-use') message = "This email is already registered.";
        if (error.code === 'auth/weak-password') message = "The password is too weak.";
        if (error.code === 'auth/invalid-email') message = "Please enter a valid email address.";

        toast({
            variant: 'destructive',
            title: 'Signup Failed',
            description: message,
        });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      // Check if Firestore document exists
      const userRef = doc(firestore, 'users', user.uid);
      const snap = await getDoc(userRef);

      let finalAccountType = 'customer';

      if (!snap.exists()) {
          const accountType = signupSource === 'customer' ? 'customer' : 'restaurant';
          finalAccountType = accountType;
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
          
          toast({
              title: 'Welcome!',
              description: `Account created as a ${accountType === 'restaurant' ? 'Merchant' : 'Member'}.`,
          });
      } else {
          finalAccountType = snap.data()?.accountType || 'customer';
          toast({
              title: 'Welcome back!',
              description: "You've logged in with Google.",
          });
      }

      localStorage.removeItem('signup_context');
      
      // SMART REDIRECT
      if (finalAccountType === 'restaurant') {
          router.replace('/dashboard');
      } else {
          router.replace(redirectTo || '/');
      }
    } catch (error: any) {
        toast({
            variant: 'destructive',
            title: 'Google Signup Failed',
            description: error.message,
        });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDFCF7]">
      <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl">
          <CardContent className="p-8 space-y-8">
            <div className="text-center space-y-2">
                <h2 className="text-2xl font-black uppercase tracking-tight italic">Create Account</h2>
                <p className="text-[10px] font-bold text-primary uppercase tracking-widest">
                    Joining as: {signupSource === 'merchant' ? 'Business Owner' : 'Personal Member'}
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
                    className="h-14 rounded-2xl border-2 pl-12 font-bold focus:border-primary transition-all"
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
                    className="h-14 rounded-2xl border-2 pl-12 font-bold focus:border-primary transition-all"
                    required
                  />
                </div>
              </div>

              <Button 
                type="submit" 
                disabled={isLoading}
                className="w-full h-14 rounded-2xl bg-primary hover:bg-primary/90 text-white font-black uppercase tracking-widest text-xs shadow-xl shadow-primary/20 transition-all active:scale-95"
              >
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign Up'}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-black/5" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white px-4 text-[8px] font-black uppercase tracking-[0.3em] opacity-20">Identity Provider</span>
              </div>
            </div>

            <Button 
              onClick={handleGoogleSignup}
              variant="outline"
              disabled={isLoading}
              className="w-full h-14 rounded-2xl border-2 font-bold gap-3 hover:bg-black/5 transition-all"
            >
              <Chrome className="h-5 w-5 text-blue-500" />
              <span>Sign up with Google</span>
            </Button>

            <div className="text-center">
                <p className="text-xs text-gray-500">
                    Already have an account?{' '}
                    <Link href={`/login${redirectTo ? `?redirectTo=${encodeURIComponent(redirectTo)}` : ''}`} className="font-medium text-primary hover:underline">
                        Log In
                    </Link>
                </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
