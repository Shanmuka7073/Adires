
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
import { Loader2, Mail, Lock, Chrome } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';

/**
 * NON-BLOCKING LOGIN COMPONENT
 * Implements the UI from the screenshot with robust error handling.
 */
export function NonBlockingLogin() {
  const { auth } = useFirebase();
  const { toast } = useToast();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password) return;

    setIsLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // Success is handled by the global Auth listener in provider.tsx
    } catch (error: any) {
      console.error("Login Error:", error);
      let message = "Could not connect to Google Services.";
      
      if (error.code === 'auth/invalid-credential') message = "Invalid email or security key.";
      if (error.code === 'auth/user-not-found') message = "No account found with this email.";
      if (error.code === 'auth/wrong-password') message = "Incorrect security key.";
      if (error.code === 'auth/network-request-failed') message = "Network error. Check your connection.";

      toast({
        variant: 'destructive',
        title: 'Authentication Failed',
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (!auth) return;
    setIsLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Google Login Failed',
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
          <form onSubmit={handleEmailLogin} className="space-y-6">
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
              {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Open Dashboard'}
            </Button>
          </form>
          <p className="text-center text-xs text-gray-500">
              Don't have an account?{' '}
              <Link href="/signup" className="font-medium text-primary hover:underline">
                  Sign Up
              </Link>
          </p>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-black/5" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-[8px] font-black uppercase tracking-[0.3em] opacity-20">Or Authorized Identity</span>
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
            Secure Platform • AES-256 Encrypted
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
