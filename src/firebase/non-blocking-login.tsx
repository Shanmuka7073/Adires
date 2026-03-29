
'use client';

import { useState } from 'react';
import {
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { useFirebase } from '@/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Mail, Lock, Chrome, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { doc, setDoc, getDoc } from 'firebase/firestore';

/**
 * AUTHORIZED ACCESS TERMINAL
 * Implements high-performance authentication with robust error feedback.
 */
export function NonBlockingLogin() {
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password) return;

    setIsLoading(true);
    setAuthError(null);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error: any) {
      console.error("Login Fail:", error.code);
      let message = "Authentication failed. Please check your network.";
      
      if (error.code === 'auth/invalid-credential') {
          message = "Invalid email or security key. If you don't have an account, please Sign Up first.";
      } else if (error.code === 'auth/user-not-found') {
          message = "No account found. Please register to continue.";
      } else if (error.code === 'auth/wrong-password') {
          message = "Incorrect password. Please try again.";
      }
      
      setAuthError(message);
      toast({
        variant: 'destructive',
        title: 'Login Error',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth || !firestore) return;
    setIsLoading(true);
    setAuthError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      
      // MERCHANT CONTEXT SYNC
      const userRef = doc(firestore, 'users', result.user.uid);
      const snap = await getDoc(userRef);
      
      if (!snap.exists()) {
          const context = localStorage.getItem('signup_context');
          const accountType = context === 'menu_flow' ? 'customer' : 'restaurant';

          await setDoc(userRef, {
              id: result.user.uid,
              email: result.user.email,
              uid: result.user.uid,
              accountType: accountType,
              firstName: result.user.displayName?.split(' ')[0] || '',
              lastName: result.user.displayName?.split(' ')[1] || '',
              phoneNumber: '',
              address: ''
          }, { merge: true });
          
          localStorage.removeItem('signup_context');
      }
    } catch (error: any) {
      setAuthError(error.message);
      toast({
        variant: 'destructive',
        title: 'Google Sync Failed',
        description: error.message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md mx-auto animate-in fade-in slide-in-from-bottom-4 duration-700">
      <Card className="rounded-[2.5rem] border-0 shadow-2xl overflow-hidden bg-white/80 backdrop-blur-xl">
        <CardContent className="p-8 space-y-8">
          <div className="text-center space-y-2">
              <h2 className="text-2xl font-black uppercase tracking-tight italic">Authorized Access</h2>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Secure Operational Terminal</p>
          </div>

          {authError && (
              <div className="p-4 rounded-2xl bg-red-50 border-2 border-red-100 text-red-900 flex gap-3 items-start animate-in zoom-in-95">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-xs font-bold leading-relaxed uppercase">{authError}</p>
              </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Email Identity</label>
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
              <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Security Key</label>
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
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Enter Dashboard'}
            </Button>
          </form>

          <p className="text-center text-xs text-gray-500">
              New to the platform?{' '}
              <Link href="/signup" className="font-bold text-primary hover:underline uppercase tracking-tighter">
                  Create Account
              </Link>
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-black/5" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-[8px] font-black uppercase tracking-[0.3em] opacity-20">Identity Provider</span>
            </div>
          </div>

          <Button 
            onClick={handleGoogleLogin}
            variant="outline"
            disabled={isLoading}
            className="w-full h-14 rounded-2xl border-2 font-bold gap-3 hover:bg-black/5 transition-all"
          >
            <Chrome className="h-5 w-5 text-blue-500" />
            <span>Continue with Google</span>
          </Button>

          <p className="text-center text-[8px] font-black uppercase tracking-widest opacity-20 pt-4">
            Authorized Personnel Only • AES-256 Protected
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
