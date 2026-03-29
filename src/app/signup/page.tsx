
'use client';

import { useState } from 'react';
import {
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mail, Lock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { doc, setDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';


export default function SignupPage() {
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();
  const router = useRouter();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password || !firestore) return;

    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(firestore, "users", user.uid), {
        email: user.email,
        uid: user.uid,
        accountType: 'customer', // Default account type
      });

      toast({
          title: 'Account Created',
          description: "You have been successfully signed up!",
      });

      router.replace('/login');

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl">
          <CardContent className="p-8 space-y-8">
            <h2 className="text-2xl font-bold text-center">Create an Account</h2>
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
            <p className="text-center text-xs text-gray-500">
                Already have an account?{' '}
                <Link href="/login" className="font-medium text-primary hover:underline">
                    Log In
                </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
