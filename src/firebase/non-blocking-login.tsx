'use client';

import { useState, useTransition } from 'react';
import { useFirebase, getFirestoreInstance } from '@/firebase';
import { 
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Store, Chrome, Mail, Lock, UserPlus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * MERCHANT LOGIN PORTAL (V2)
 * Supports Google Login and Email/Password authentication.
 * Optimized for Business Owners and Employees.
 */
export function NonBlockingLogin() {
  const [isPending, startTransition] = useTransition();
  const { auth } = useFirebase();
  const { toast } = useToast();

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  const handleInitializeProfile = async (uid: string, userEmail: string | null, displayName: string | null, photoURL: string | null) => {
    const db = await getFirestoreInstance();
    if (!db) return;

    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      await setDoc(userDocRef, {
        id: uid,
        email: userEmail,
        firstName: displayName?.split(' ')[0] || firstName || 'Merchant',
        lastName: displayName?.split(' ').slice(1).join(' ') || lastName || 'User',
        accountType: 'restaurant', 
        imageUrl: photoURL || '',
      });
      return true; // New profile
    }
    return false; // Existing profile
  };

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password) return;

    startTransition(async () => {
      try {
        const result = await signInWithEmailAndPassword(auth, email, password);
        toast({ title: 'Access Granted', description: `Logged in as ${result.user.email}` });
      } catch (err: any) {
        console.error("Email login failed:", err);
        toast({ 
            variant: 'destructive', 
            title: 'Authentication Failed', 
            description: err.message?.includes('auth/invalid-credential') ? 'Invalid email or password.' : 'System error. Try again.'
        });
      }
    });
  };

  const handleEmailRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth || !email || !password || !firstName) {
        toast({ variant: 'destructive', title: 'Details Required', description: 'Please fill in all fields.' });
        return;
    }

    startTransition(async () => {
      try {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        await handleInitializeProfile(result.user.uid, email, `${firstName} ${lastName}`, null);
        toast({ title: 'Welcome Partner!', description: 'Business account created.' });
      } catch (err: any) {
        console.error("Registration failed:", err);
        toast({ 
            variant: 'destructive', 
            title: 'Registration Failed', 
            description: err.message?.includes('auth/email-already-in-use') ? 'Email is already registered.' : 'Weak password or invalid email.'
        });
      }
    });
  };

  const handleGoogleLogin = () => {
    if (!auth) return;

    startTransition(async () => {
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const isNew = await handleInitializeProfile(result.user.uid, result.user.email, result.user.displayName, result.user.photoURL);
        
        if (isNew) {
          toast({ title: 'Welcome Partner!', description: 'Business account initialized.' });
        } else {
          toast({ title: 'Access Granted', description: `Authenticated as ${result.user.email}` });
        }
      } catch (err: any) {
        console.error("Google Auth failed:", err);
        toast({ 
            variant: 'destructive', 
            title: 'Authentication Failed', 
            description: 'Could not connect to Google Services.'
        });
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
          Merchant Hub
        </CardTitle>
        <CardDescription className="font-bold opacity-40 uppercase text-[10px] tracking-widest mt-1">
          Operational Control Center
        </CardDescription>
      </CardHeader>
      
      <CardContent className="p-8 space-y-8">
        <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2 h-12 bg-black/5 p-1 rounded-2xl border mb-6">
                <TabsTrigger value="login" className="rounded-xl font-black text-[10px] uppercase tracking-widest">Access</TabsTrigger>
                <TabsTrigger value="register" className="rounded-xl font-black text-[10px] uppercase tracking-widest">Join</TabsTrigger>
            </TabsList>

            <TabsContent value="login" className="space-y-4 animate-in fade-in duration-300">
                <form onSubmit={handleEmailLogin} className="space-y-4">
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest opacity-40">Email ID</Label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                            <Input 
                                type="email" 
                                placeholder="name@company.com" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="h-12 rounded-xl border-2 pl-10 font-bold" 
                                required
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label className="text-[9px] font-black uppercase tracking-widest opacity-40">Security Key</Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 opacity-20" />
                            <Input 
                                type="password" 
                                placeholder="••••••••" 
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="h-12 rounded-xl border-2 pl-10 font-bold" 
                                required
                            />
                        </div>
                    </div>
                    <Button 
                        type="submit" 
                        disabled={isPending} 
                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-primary/20"
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Open Dashboard'}
                    </Button>
                </form>
            </TabsContent>

            <TabsContent value="register" className="space-y-4 animate-in fade-in duration-300">
                <form onSubmit={handleEmailRegister} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest opacity-40">First Name</Label>
                            <Input 
                                placeholder="John" 
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                className="h-11 rounded-xl border-2 font-bold" 
                                required
                            />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] font-black uppercase tracking-widest opacity-40">Last Name</Label>
                            <Input 
                                placeholder="Doe" 
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                className="h-11 rounded-xl border-2 font-bold" 
                            />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase tracking-widest opacity-40">Business Email</Label>
                        <Input 
                            type="email" 
                            placeholder="name@store.com" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="h-11 rounded-xl border-2 font-bold" 
                            required
                        />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] font-black uppercase tracking-widest opacity-40">New Password</Label>
                        <Input 
                            type="password" 
                            placeholder="Min 6 chars" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="h-11 rounded-xl border-2 font-bold" 
                            required
                        />
                    </div>
                    <Button 
                        type="submit" 
                        disabled={isPending} 
                        variant="secondary"
                        className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg"
                    >
                        {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <><UserPlus className="mr-2 h-4 w-4" /> Create Account</>}
                    </Button>
                </form>
            </TabsContent>
        </Tabs>

        <div className="relative">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-black/5" /></div>
            <div className="relative flex justify-center text-[8px] uppercase font-black tracking-[0.3em] text-gray-400">
                <span className="bg-white px-4 italic">Or Authorized Identity</span>
            </div>
        </div>

        <Button 
            onClick={handleGoogleLogin} 
            disabled={isPending} 
            variant="outline"
            className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-sm bg-white text-gray-950 border-2 border-black/10 hover:bg-gray-50 transition-all text-[10px]"
        >
            <Chrome className="mr-2 h-4 w-4 text-blue-500" />
            Continue with Google
        </Button>
        
        <div className="pt-2 text-center">
          <p className="text-muted-foreground font-bold text-[8px] uppercase tracking-[0.2em] opacity-40">
            Secure Platform • AES-256 Encrypted
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
