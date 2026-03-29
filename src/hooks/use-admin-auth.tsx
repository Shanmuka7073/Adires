
'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useMemo } from 'react';
import { useAppStore } from '@/lib/store';

const ADMIN_EMAILS = ['admin@gmail.com', 'adires@gmail.com', 'shanmuka7073@gmail.com'];

/**
 * UNIFIED AUTH GUARD
 * Synchronizes Firebase Auth with Firestore Profile data.
 */
export function useAdminAuth() {
  const { user, isUserLoading, firestore, auth } = useFirebase();
  const { isUserDataLoaded, userStore } = useAppStore();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  const isAdmin = useMemo(() => {
    return !!(user && ADMIN_EMAILS.includes(user.email || ''));
  }, [user]);

  const isRestaurantOwner = useMemo(() => {
    // If the user has a linked store in memory, they are a merchant.
    if (userStore) return true;
    if (!isUserDataLoaded || isProfileLoading) return false;
    return userData?.accountType === 'restaurant';
  }, [userData, isUserDataLoaded, isProfileLoading, userStore]);

  const isEmployee = useMemo(() => {
    if (!isUserDataLoaded || isProfileLoading) return false;
    return userData?.accountType === 'employee';
  }, [userData, isUserDataLoaded, isProfileLoading]);

  const isCustomer = useMemo(() => {
    if (!isUserDataLoaded || isProfileLoading) return false;
    // EXPLICIT CHECK: Customer is someone without an accountType OR explicitly set to 'customer'
    return !userData?.accountType || userData?.accountType === 'customer';
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
