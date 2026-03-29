
'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';

const ADMIN_EMAILS = ['admin@gmail.com', 'adires@gmail.com'];

/**
 * UNIFIED AUTH GUARD
 * Synchronizes Firebase Auth with Firestore Profile data.
 * Waits for isUserDataLoaded to prevent identity flickering and redirect loops.
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
    return userData?.accountType === 'restaurant';
  }, [userData, isUserDataLoaded, isProfileLoading]);

  const isEmployee = useMemo(() => {
    if (!isUserDataLoaded || isProfileLoading) return false;
    return userData?.accountType === 'employee';
  }, [userData, isUserDataLoaded, isProfileLoading]);

  const isCustomer = useMemo(() => {
    if (!isUserDataLoaded || isProfileLoading) return false;
    return userData?.accountType === 'customer' || !userData?.accountType;
  }, [userData, isUserDataLoaded, isProfileLoading]);

  const isMerchant = useMemo(() => {
      return isAdmin || isRestaurantOwner;
  }, [isAdmin, isRestaurantOwner]);

  const loading = isUserLoading || (!!user && !isUserDataLoaded) || !auth || isProfileLoading;

  return {
    isAdmin,
    isRestaurantOwner,
    isEmployee,
    isCustomer,
    isMerchant,
    isLoading: loading,
    user,
    userData,
  };
}
