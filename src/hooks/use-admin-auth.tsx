
'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useMemo, useEffect } from 'react';

const ADMIN_EMAILS = ['shanmuka7073@gmail.com', 'admin@gmail.com', 'adires@gmail.com'];

/**
 * A hook to determine the current user's role and authorization status.
 * Unified to ensure consistent Merchant/Restaurant role detection.
 */
export function useAdminAuth() {
  const { user, isUserLoading, firestore, auth } = useFirebase();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  const isAdmin = useMemo(() => {
    return !!(user && ADMIN_EMAILS.includes(user.email || ''));
  }, [user]);

  const isRestaurantOwner = useMemo(() => {
    return isAdmin || userData?.accountType === 'restaurant';
  }, [userData, isAdmin]);

  const isEmployee = useMemo(() => {
    return userData?.accountType === 'employee';
  }, [userData]);

  const isMerchant = useMemo(() => {
      return isAdmin || isRestaurantOwner;
  }, [isAdmin, isRestaurantOwner]);

  // isLoading is ONLY true if we are waiting for user identity or profile confirmation
  const loading = isUserLoading || (!!user && isProfileLoading) || !auth;

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
