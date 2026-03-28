
'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';

const ADMIN_EMAILS = ['shanmuka7073@gmail.com', 'admin@gmail.com', 'adires@gmail.com'];

/**
 * Unified Auth Hook
 * Now waits for isUserDataLoaded to prevent redirect flips.
 */
export function useAdminAuth() {
  const { user, isUserLoading, firestore, auth } = useFirebase();
  const { isUserDataLoaded } = useAppStore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  const isAdmin = useMemo(() => {
    return !!(user && ADMIN_EMAILS.includes(user.email || ''));
  }, [user]);

  const isRestaurantOwner = useMemo(() => {
    if (!isUserDataLoaded || isProfileLoading) return false;
    return isAdmin || userData?.accountType === 'restaurant';
  }, [userData, isAdmin, isUserDataLoaded, isProfileLoading]);

  const isMerchant = useMemo(() => {
      if (!isUserDataLoaded || isProfileLoading) return false;
      return isAdmin || isRestaurantOwner;
  }, [isAdmin, isRestaurantOwner, isUserDataLoaded, isProfileLoading]);

  const loading = isUserLoading || (!!user && !isUserDataLoaded) || (!!user && isProfileLoading) || !auth;

  return {
    isAdmin,
    isRestaurantOwner,
    isMerchant,
    isLoading: loading,
    user,
    userData,
  };
}
