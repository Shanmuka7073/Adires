
'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';

const ADMIN_EMAILS = ['shanmuka7073@gmail.com', 'admin@gmail.com', 'adires@gmail.com'];

/**
 * Unified Auth Hook
 * Synchronizes Firebase Auth with Firestore Profile data to prevent redirection loops.
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
    if (!isUserDataLoaded) return false;
    return userData?.accountType === 'restaurant';
  }, [userData, isUserDataLoaded]);

  const isEmployee = useMemo(() => {
    if (!isUserDataLoaded) return false;
    return userData?.accountType === 'employee';
  }, [userData, isUserDataLoaded]);

  const isMerchant = useMemo(() => {
      return isAdmin || isRestaurantOwner;
  }, [isAdmin, isRestaurantOwner]);

  // CRITICAL: loading MUST account for isUserDataLoaded to prevent redirect loops
  const loading = isUserLoading || (!!user && !isUserDataLoaded) || !auth;

  return {
    isAdmin,
    isRestaurantOwner,
    isEmployee,
    isMerchant,
    isLoading: loading,
    user,
    userData,
  };
}
