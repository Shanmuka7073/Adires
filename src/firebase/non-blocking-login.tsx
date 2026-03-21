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
import { Loader2, AlertCircle, User as UserIcon } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useRouter } from 'next/navigation';

/**
 * A reusable authentication component that handles Sign In and Sign Up.
 * It uses Firebase Client SDK and non-blocking transitions.
 * Automatically sends verification emails for new accounts.
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
  const router = useRouter();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!auth || !firestore) return;

    startTransition(async () => {
      try {
        if (isSignUp) {
          if (!firstName || !lastName) {
            throw new Error("First and Last name are required for sign-up.");
          }

          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // Set Display Name so it's available for the email template (%DISPLAY_NAME%)
          await updateProfile(user, {
            displayName: `${firstName} ${lastName}`.trim()
          });
          
          // Send verification email immediately on sign-up
          await sendEmailVerification(user);

          // Save profile data to Firestore
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
            title: 'Welcome to Adires!', 
            description: 'Please check your inbox to verify your email address.' 
          });
        } else {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          
          // Proactively send verification if not verified on login attempt
          if (!userCredential.user.emailVerified && userCredential.user.email !== 'admin@gmail.com') {
             await sendEmailVerification(userCredential.user);
             toast({ 
               title: 'Verify Your Email', 
               description: 'Your email is not verified. A verification link has been sent to your inbox.' 
             });
          } else {
            toast({ title: 'Welcome Back!' });
          }
        }
      } catch (err: any) {
        setError(err.message);
        toast({
          variant: 'destructive',
          title: 'Authentication Failed',
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
          {isSignUp
            ? 'Create a business or personal account'
            : 'Access your secure dashboard'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-[10px] font-black uppercase opacity-40 tracking-widest">First Name</Label>
                <Input 
                    id="firstName" 
                    value={firstName} 
                    onChange={e => setFirstName(e.target.value)} 
                    placeholder="John" 
                    required 
                    className="h-12 rounded-xl border-2" 
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-[10px] font-black uppercase opacity-40 tracking-widest">Last Name</Label>
                <Input 
                    id="lastName" 
                    value={lastName} 
                    onChange={e => setLastName(e.target.value)} 
                    placeholder="Doe" 
                    required 
                    className="h-12 rounded-xl border-2" 
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] font-black uppercase opacity-40 tracking-widest">Email Address</Label>
            <Input 
                id="email" 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                placeholder="m@example.com" 
                required 
                className="h-12 rounded-xl border-2 focus:ring-primary" 
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password" className="text-[10px] font-black uppercase opacity-40 tracking-widest">Password</Label>
            <Input 
                id="password" 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
                className="h-12 rounded-xl border-2" 
            />
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-40 tracking-widest">Account Purpose</Label>
              <Select value={accountType} onValueChange={(v: any) => setAccountType(v)}>
                <SelectTrigger className="h-12 rounded-xl border-2">
                  <SelectValue placeholder="Select an account type" />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="groceries">Personal (Shop & Order)</SelectItem>
                  <SelectItem value="restaurant">Business (Store, Restaurant, Salon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive bg-red-50 p-4 rounded-2xl border border-red-100">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-xs font-bold leading-tight">{error}</p>
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full h-14 text-base font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 transition-all active:scale-95" 
            disabled={isPending}
          >
            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (isSignUp ? 'Create My Account' : 'Sign In')}
          </Button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-black/5 text-center">
          <p className="text-muted-foreground font-bold text-xs uppercase tracking-tight">
            {isSignUp ? "Already have an account?" : "Don't have an account?"}
            <button 
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-primary font-black uppercase ml-2 hover:underline"
            >
              {isSignUp ? 'Sign In' : 'Sign Up Free'}
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}