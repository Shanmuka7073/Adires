
'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useMemo, useEffect } from 'react';
import { useAppStore } from '@/lib/store';

const ADMIN_EMAILS = ['shanmuka7073@gmail.com', 'admin@gmail.com', 'adires@gmail.com'];

/**
 * A hook to determine the current user's role and authorization status.
 * Unified to ensure consistent Merchant/Restaurant role detection.
 * Optimized to wait for both Auth and Firestore data before reporting stability.
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
    // Return false until loading is fully finished to prevent early assumptions
    if (isUserLoading || !isUserDataLoaded || isProfileLoading) return false;
    return isAdmin || userData?.accountType === 'restaurant';
  }, [userData, isAdmin, user, isUserLoading, isUserDataLoaded, isProfileLoading]);

  const isEmployee = useMemo(() => {
    if (isUserLoading || !isUserDataLoaded || isProfileLoading) return false;
    return userData?.accountType === 'employee';
  }, [userData, isUserLoading, isUserDataLoaded, isProfileLoading]);

  const isMerchant = useMemo(() => {
      if (isUserLoading || !isUserDataLoaded || isProfileLoading) return false;
      return isAdmin || isRestaurantOwner;
  }, [isAdmin, isRestaurantOwner, isUserLoading, isUserDataLoaded, isProfileLoading]);

  // isLoading is ONLY false when we have both auth state and confirmed Firestore profile data
  const loading = isUserLoading || (!!user && !isUserDataLoaded) || (!!user && isProfileLoading) || !auth;

  useEffect(() => {
      if (!loading && user) {
          console.log(`[AUTH_LOG] Identity: ${user.email}, AccountType: ${userData?.accountType || 'none'}, IsMerchant: ${isMerchant}`);
      }
  }, [loading, user, userData, isMerchant]);

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
