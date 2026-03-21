'use client';

import { useState, useTransition } from 'react';
import { useFirebase } from '@/firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, AlertCircle } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Personalized Auth Component.
 * Captures names to populate the %DISPLAY_NAME% placeholder in email templates.
 */
export function NonBlockingLogin() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [accountType, setAccountType] = useState<'groceries' | 'restaurant'>('groceries');
  const [isPending, startTransition] = useTransition();
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
          if (!firstName || !lastName) {
            throw new Error("First and Last name are required.");
          }

          // 1. Create the user account
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // 2. Update the Auth Profile (Populates %DISPLAY_NAME%)
          await updateProfile(user, {
            displayName: `${firstName} ${lastName}`.trim()
          });
          
          // 3. Send the Verification Email
          await sendEmailVerification(user);

          // 4. Create the Firestore profile
          await setDoc(doc(firestore, 'users', user.uid), {
            id: user.uid,
            email,
            firstName,
            lastName,
            address: '',
            phoneNumber: '',
            accountType,
          });
          
          toast({ 
            title: 'Account Created!', 
            description: 'Check your inbox for the verification link.' 
          });
        } else {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          
          // Proactively send verification link if they attempt login while unverified
          if (!userCredential.user.emailVerified && userCredential.user.email !== 'admin@gmail.com') {
             await sendEmailVerification(userCredential.user);
             toast({ 
               title: 'Verification Required', 
               description: 'A new verification link has been sent to your email.' 
             });
          }
        }
      } catch (err: any) {
        setError(err.message);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: err.message,
        });
      }
    });
  };

  return (
    <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden bg-white">
      <CardHeader className="text-center pb-2 pt-8">
        <CardTitle className="text-3xl font-black font-headline tracking-tighter uppercase italic">
          {isSignUp ? 'Join Adires' : 'Welcome Back'}
        </CardTitle>
        <CardDescription className="font-bold opacity-40 uppercase text-[10px] tracking-widest">
          {isSignUp ? 'Start your journey today' : 'Sign in to your account'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-40">First Name</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="John" required className="h-12 rounded-xl" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-40">Last Name</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Doe" required className="h-12 rounded-xl" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase opacity-40">Email</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" required className="h-12 rounded-xl" />
          </div>
          
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase opacity-40">Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 rounded-xl" />
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-40">Account Type</Label>
              <Select value={accountType} onValueChange={(v: any) => setAccountType(v)}>
                <SelectTrigger className="h-12 rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="groceries">Personal (Customer)</SelectItem>
                  <SelectItem value="restaurant">Business (Store/Salon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive bg-red-50 p-4 rounded-2xl border border-red-100">
                <AlertCircle className="h-5 w-5" />
                <p className="text-xs font-bold">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-xl" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (isSignUp ? 'Sign Up' : 'Sign In')}
          </Button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-black/5 text-center">
          <p className="text-muted-foreground font-bold text-xs uppercase">
            {isSignUp ? "Already have an account?" : "Need an account?"}
            <button onClick={() => setIsSignUp(!isSignUp)} className="text-primary font-black uppercase ml-2 hover:underline">
              {isSignUp ? 'Login' : 'Create One'}
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}