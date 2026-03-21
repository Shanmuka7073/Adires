
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
import { Loader2, AlertCircle, UserPlus, LogIn } from 'lucide-react';
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
            throw new Error("First and Last name are required for account personalization.");
          }

          // 1. Create the user account
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          // 2. Update the Auth Profile (Populates %DISPLAY_NAME% for your email template)
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
            description: `Welcome ${firstName}! Please check your email to verify your account.` 
          });
        } else {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          
          // Proactively send verification link if they attempt login while unverified
          if (!userCredential.user.emailVerified && userCredential.user.email !== 'admin@gmail.com') {
             await sendEmailVerification(userCredential.user);
             toast({ 
               title: 'Verification Required', 
               description: 'We have sent a new verification link to your inbox.' 
             });
          }
        }
      } catch (err: any) {
        setError(err.message);
        toast({
          variant: 'destructive',
          title: 'Authentication Error',
          description: err.message,
        });
      }
    });
  };

  return (
    <Card className="w-full max-w-md shadow-2xl border-t-4 border-t-primary rounded-[2.5rem] overflow-hidden bg-white">
      <CardHeader className="text-center pb-2 pt-8">
        <div className="mx-auto w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-4">
            {isSignUp ? <UserPlus className="h-6 w-6" /> : <LogIn className="h-6 w-6" />}
        </div>
        <CardTitle className="text-3xl font-black font-headline tracking-tighter uppercase italic">
          {isSignUp ? 'Join Adires' : 'Welcome Back'}
        </CardTitle>
        <CardDescription className="font-bold opacity-40 uppercase text-[10px] tracking-widest">
          {isSignUp ? 'Create your business or personal account' : 'Sign in to access your dashboard'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {isSignUp && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-40">First Name</Label>
                <Input value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="e.g. Rahul" required className="h-12 rounded-xl border-2" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-black uppercase opacity-40">Last Name</Label>
                <Input value={lastName} onChange={e => setLastName(e.target.value)} placeholder="e.g. Sharma" required className="h-12 rounded-xl border-2" />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase opacity-40">Email Address</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="name@email.com" required className="h-12 rounded-xl border-2" />
          </div>
          
          <div className="space-y-2">
            <Label className="text-[10px] font-black uppercase opacity-40">Security Password</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="h-12 rounded-xl border-2" />
          </div>

          {isSignUp && (
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase opacity-40">Identify Your Role</Label>
              <Select value={accountType} onValueChange={(v: any) => setAccountType(v)}>
                <SelectTrigger className="h-12 rounded-xl border-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="rounded-2xl">
                  <SelectItem value="groceries">Personal (Shopping)</SelectItem>
                  <SelectItem value="restaurant">Business (Store/Restaurant/Salon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive bg-red-50 p-4 rounded-2xl border border-red-100 animate-in shake-2">
                <AlertCircle className="h-5 w-5 shrink-0" />
                <p className="text-xs font-bold leading-tight">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20" disabled={isPending}>
            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (isSignUp ? 'Create My Account' : 'Sign In Now')}
          </Button>
        </form>
        
        <div className="mt-8 pt-6 border-t border-black/5 text-center">
          <p className="text-muted-foreground font-bold text-xs uppercase">
            {isSignUp ? "Already a member?" : "New to Adires?"}
            <button 
                type="button"
                onClick={() => {
                    setError(null);
                    setIsSignUp(!isSignUp);
                }} 
                className="text-primary font-black uppercase ml-2 hover:underline decoration-2"
            >
              {isSignUp ? 'Login' : 'Join Now'}
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
