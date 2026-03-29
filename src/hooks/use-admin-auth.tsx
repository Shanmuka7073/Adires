
'use client';

import { useFirebase } from '@/firebase';
import { useMemo } from 'react';

const ADMIN_EMAILS = ['shanmuka7073@gmail.com', 'admin@gmail.com', 'adires@gmail.com'];

/**
 * DETERMINISTIC ROLE HOOK
 * Derives user permissions from the central context profile.
 * No redundant fetches or reliance on LocalStorage.
 */
export function useAdminAuth() {
  const { user, profile, authLoading, profileLoading, appReady, error } = useFirebase();

  const isAdmin = useMemo(() => {
    return !!(user && ADMIN_EMAILS.includes(user.email || ''));
  }, [user]);

  const isRestaurantOwner = useMemo(() => {
    return profile?.accountType === 'restaurant';
  }, [profile]);

  const isEmployee = useMemo(() => {
    return profile?.accountType === 'employee';
  }, [profile]);

  const isMerchant = useMemo(() => {
      return isAdmin || isRestaurantOwner;
  }, [isAdmin, isRestaurantOwner]);

  const isCustomer = useMemo(() => {
      if (isAdmin || isRestaurantOwner || isEmployee) return false;
      return true;
  }, [isAdmin, isRestaurantOwner, isEmployee]);

  return {
    user,
    profile,
    isAdmin,
    isMerchant,
    isRestaurantOwner,
    isEmployee,
    isCustomer,
    isLoading: !appReady,
    authLoading,
    profileLoading,
    error,
    userData: profile, // Map profile to userData for component compatibility
  };
}
