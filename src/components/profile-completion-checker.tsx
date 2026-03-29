'use client';

import { useEffect, useState } from 'react';
import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useRouter, usePathname } from 'next/navigation';
import type { User as AppUser } from '@/lib/types';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from './ui/button';
import { useAppStore } from '@/lib/store';

const SESSION_STORAGE_KEY = 'profile-prompt-dismissed';

export function ProfileCompletionChecker() {
  const { user, isUserLoading, firestore } = useFirebase();
  const { isUserDataLoaded } = useAppStore();
  const router = useRouter();
  const pathname = usePathname();
  const [showPrompt, setShowPrompt] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  useEffect(() => {
    // 1. Wait for everything to be loaded before checking
    if (isUserLoading || !isUserDataLoaded || isProfileLoading || !user) {
      return;
    }

    // 2. Ignore on profile page or if dismissed
    if (pathname === '/profile' || sessionStorage.getItem(SESSION_STORAGE_KEY) === 'true') {
      setShowPrompt(false);
      return;
    }
    
    // 3. Check for incomplete profile
    const isProfileIncomplete = 
        !userData || 
        !userData.firstName || 
        !userData.lastName || 
        !userData.address || 
        !userData.phoneNumber;

    if (isProfileIncomplete) {
      setShowPrompt(true);
    } else {
      setShowPrompt(false);
    }
  }, [user, isUserLoading, isUserDataLoaded, userData, isProfileLoading, pathname]);

  const handleDismiss = () => {
    sessionStorage.setItem(SESSION_STORAGE_KEY, 'true');
    setShowPrompt(false);
  };

  const handleNavigate = () => {
    setShowPrompt(false);
    router.push('/profile');
  };

  return (
    <AlertDialog open={showPrompt} onOpenChange={setShowPrompt}>
      <AlertDialogContent className="rounded-[2rem] border-0 shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="font-black uppercase tracking-tight italic">Action Required</AlertDialogTitle>
          <AlertDialogDescription className="font-bold text-gray-500">
            Please complete your business or personal profile to ensure accurate delivery and billing records.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel asChild>
            <Button variant="outline" className="rounded-xl font-bold" onClick={handleDismiss}>Skip</Button>
          </AlertDialogCancel>
          <AlertDialogAction asChild>
            <Button onClick={handleNavigate} className="rounded-xl bg-primary hover:bg-primary/90 font-black uppercase text-[10px] tracking-widest">Setup Profile</Button>
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
