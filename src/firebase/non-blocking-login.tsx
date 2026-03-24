'use client';

import { useState, useTransition } from 'react';
import { useFirebase, getFirestoreInstance } from '@/firebase';
import { 
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Store, Chrome } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * MERCHANT LOGIN PORTAL
 * Dedicated Google-only entry point for Business Owners and Employees.
 * Optimized to load Firestore only after successful auth interaction.
 */
export function NonBlockingLogin() {
  const [isPending, startTransition] = useTransition();
  const { auth } = useFirebase();
  const { toast } = useToast();

  const handleGoogleLogin = () => {
    if (!auth) return;

    startTransition(async () => {
      try {
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const user = result.user;

        // Lazy load firestore only after login is initiated
        const db = await getFirestoreInstance();
        
        if (!db) {
            console.error("Firestore initialization failed during login.");
            return;
        }

        const userDocRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          // New account detected - setup as Merchant by default
          await setDoc(userDocRef, {
            id: user.uid,
            email: user.email,
            firstName: user.displayName?.split(' ')[0] || 'Merchant',
            lastName: user.displayName?.split(' ').slice(1).join(' ') || 'User',
            accountType: 'restaurant', 
            imageUrl: user.photoURL || '',
          });
          toast({ title: 'Welcome Partner!', description: 'Business account initialized.' });
        } else {
          toast({ title: 'System Access Granted', description: `Authenticated as ${user.email}` });
        }
      } catch (err: any) {
        console.error("Auth failed:", err);
        toast({ 
            variant: 'destructive', 
            title: 'Authentication Failed', 
            description: 'Could not connect to Google Services. Please try again.' 
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
          Operations & Operational Intelligence
        </CardDescription>
      </CardHeader>
      <CardContent className="p-8 space-y-8">
        <div className="p-6 rounded-[2rem] bg-muted/30 border border-black/5 text-center space-y-4">
            <p className="text-xs font-bold text-gray-600 leading-relaxed uppercase">
                Access your secure control center using your verified Google Identity.
            </p>
            <Button 
                onClick={handleGoogleLogin} 
                disabled={isPending} 
                className="w-full h-14 font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 bg-white text-gray-950 border-2 border-black/10 hover:bg-gray-50 hover:border-black/20 transition-all"
            >
                {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Chrome className="mr-2 h-5 w-5 text-blue-500" />}
                Continue with Google
            </Button>
        </div>
        
        <div className="pt-2 text-center">
          <p className="text-muted-foreground font-bold text-[8px] uppercase tracking-[0.2em] opacity-40">
            Secure Platform • AES-256 Encrypted
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
