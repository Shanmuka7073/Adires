
'use client';

import { useState, useTransition } from 'react';
import { useFirebase } from '@/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle, UserPlus, LogIn, KeyRound, Store, ShieldCheck } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * MERCHANT LOGIN PORTAL
 * Dedicated entry point for Business Owners and Employees.
 */
export function NonBlockingLogin() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isPending, startTransition] = useTransition();
  const [isResetPending, startResetTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth || !firestore) return;

    startTransition(async () => {
      try {
        if (isSignUp) {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          await updateProfile(user, { displayName: `${firstName} ${lastName}`.trim() });
          await sendEmailVerification(user);

          await setDoc(doc(firestore, 'users', user.uid), {
            id: user.uid,
            email,
            firstName,
            lastName,
            accountType: 'restaurant', // Default to merchant for login portal
          });
          
          toast({ title: 'Merchant Account Created!', description: 'Please verify your email to begin.' });
        } else {
          await signInWithEmailAndPassword(auth, email, password);
        }
      } catch (err: any) {
        setError(err.message);
        toast({ variant: 'destructive', title: 'Auth Error', description: err.message });
      }
    });
  };

  const handleForgotPassword = () => {
    if (!email || !auth) return;
    startResetTransition(async () => {
      try {
        await sendPasswordResetEmail(auth, email);
        toast({ title: 'Reset Email Sent' });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Reset Failed', description: err.message });
      }
    });
  };

  return (
    <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden bg-white">
      <CardHeader className="text-center pb-2 pt-8">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4 border-2 border-primary/20">
            <Store className="h-7 w-7" />
        </div>
        <CardTitle className="text-3xl font-black font-headline tracking-tighter uppercase italic text-gray-950">
          Merchant Portal
        </CardTitle>
        <CardDescription className="font-bold opacity-40 uppercase text-[10px] tracking-widest mt-1">
          Operations & Intelligence Hub
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <div className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {isSignUp && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-40">First Name</Label>
                  <Input value={firstName} onChange={e => setFirstName(e.target.value)} required className="h-12 rounded-xl border-2" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[10px] font-black uppercase opacity-40">Last Name</Label>
                  <Input value={lastName} onChange={e => setLastName(e.target.value)} required className="h-12 rounded-xl border-2" />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-40">Corporate Email</Label>
              <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="manager@store.com" required className="h-12 rounded-xl border-2" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label className="text-[10px] font-black uppercase opacity-40">Security Key</Label>
                {!isSignUp && (
                  <button type="button" onClick={handleForgotPassword} disabled={isResetPending} className="text-[10px] font-black uppercase text-primary hover:underline">Forgot?</button>
                )}
              </div>
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 rounded-xl border-2" />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive bg-red-50 p-4 rounded-2xl border border-red-100">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-[10px] font-bold uppercase">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20" disabled={isPending}>
              {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (isSignUp ? 'Register Business' : 'Enter Ops Center')}
            </Button>
          </form>
        </div>
        
        <div className="mt-8 pt-6 border-t border-black/5 text-center">
          <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
            {isSignUp ? "Already registered?" : "New partner?"}
            <button type="button" onClick={() => { setError(null); setIsSignUp(!isSignUp); }} className="text-primary font-black uppercase ml-2 hover:underline">
              {isSignUp ? 'Login' : 'Apply Now'}
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
