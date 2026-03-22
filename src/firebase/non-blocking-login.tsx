
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
import { Loader2, AlertCircle, UserPlus, LogIn, KeyRound } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Google Icon Component (Custom SVG)
 */
function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 12-4.53z" fill="#EA4335"/>
    </svg>
  )
}

/**
 * Personalized Auth Component for Adires.
 * Includes personalized sign-up and Google login.
 */
export function NonBlockingLogin() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [accountType, setAccountType] = useState<'groceries' | 'restaurant'>('groceries');
  const [isPending, startTransition] = useTransition();
  const [isGooglePending, startGoogleTransition] = useTransition();
  const [isResetPending, startResetTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { auth, firestore } = useFirebase();
  const { toast } = useToast();

  const handleGoogleLogin = () => {
    if (!auth || !firestore) return;
    const provider = new GoogleAuthProvider();
    
    startGoogleTransition(async () => {
      try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        // Ensure user profile exists in Firestore
        const userDocRef = doc(firestore, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (!userDocSnap.exists()) {
            const displayName = user.displayName || '';
            const nameParts = displayName.split(' ');
            const fName = nameParts[0] || 'User';
            const lName = nameParts.slice(1).join(' ') || '';

            await setDoc(userDocRef, {
                id: user.uid,
                email: user.email,
                firstName: fName,
                lastName: lName,
                address: '',
                phoneNumber: user.phoneNumber || '',
                accountType: accountType, // Respect the selector even for Google login
            });
        }
        
        toast({ 
            title: 'Success!', 
            description: `Welcome back, ${user.displayName || 'Friend'}.` 
        });
      } catch (err: any) {
        toast({
          variant: 'destructive',
          title: 'Google Login Error',
          description: err.message,
        });
      }
    });
  };

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

          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const user = userCredential.user;

          await updateProfile(user, {
            displayName: `${firstName} ${lastName}`.trim()
          });
          
          await sendEmailVerification(user);

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
            description: `Welcome ${firstName}! Verification email sent.` 
          });
        } else {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          
          if (!userCredential.user.emailVerified && userCredential.user.email !== 'admin@gmail.com') {
             await sendEmailVerification(userCredential.user);
             toast({ 
               title: 'Verify Your Email', 
               description: 'Check your inbox for the activation link.' 
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

  const handleForgotPassword = () => {
    if (!email) {
      toast({ variant: 'destructive', title: 'Email Required' });
      return;
    }
    if (!auth) return;

    startResetTransition(async () => {
      try {
        await sendPasswordResetEmail(auth, email);
        toast({ title: 'Reset Email Sent', description: `Check ${email} for instructions.` });
      } catch (err: any) {
        toast({ variant: 'destructive', title: 'Reset Failed', description: err.message });
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
        <div className="space-y-6">
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

          <Button 
            variant="outline" 
            onClick={handleGoogleLogin} 
            disabled={isGooglePending || isPending}
            className="w-full h-14 rounded-2xl border-2 font-black uppercase tracking-widest text-[10px] flex items-center justify-center gap-3 group hover:bg-black/5 transition-all"
          >
            {isGooglePending ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon className="h-5 w-5" />}
            Continue with Google
          </Button>

          <div className="relative flex items-center gap-4">
            <div className="flex-1 h-px bg-black/5"></div>
            <span className="text-[8px] font-black uppercase opacity-20 tracking-[0.3em]">Or use email</span>
            <div className="flex-1 h-px bg-black/5"></div>
          </div>

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
              <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required={!isResetPending} className="h-12 rounded-xl border-2" />
              
              {!isSignUp && (
                <div className="flex justify-end pt-1">
                  <button 
                    type="button" 
                    onClick={handleForgotPassword}
                    disabled={isResetPending}
                    className="text-[10px] font-black uppercase tracking-widest text-primary hover:underline transition-colors"
                  >
                    {isResetPending ? 'Sending...' : 'Forgot?'}
                  </button>
                </div>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-destructive bg-red-50 p-4 rounded-2xl border border-red-100">
                  <AlertCircle className="h-5 w-5 shrink-0" />
                  <p className="text-[10px] font-bold leading-tight uppercase">{error}</p>
              </div>
            )}

            <Button type="submit" className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20" disabled={isPending || isGooglePending}>
              {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : (isSignUp ? 'Join Now' : 'Sign In')}
            </Button>
          </form>
        </div>
        
        <div className="mt-8 pt-6 border-t border-black/5 text-center">
          <p className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest">
            {isSignUp ? "Already a member?" : "New to Adires?"}
            <button 
                type="button"
                onClick={() => {
                    setError(null);
                    setIsSignUp(!isSignUp);
                }} 
                className="text-primary font-black uppercase ml-2 hover:underline"
            >
              {isSignUp ? 'Login' : 'Join Now'}
            </button>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
