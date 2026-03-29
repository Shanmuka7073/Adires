
'use client';

import { useFirebase } from '@/firebase';
import { useMemo } from 'react';

const ADMIN_EMAILS = ['admin@gmail.com', 'adires@gmail.com', 'shanmuka7073@gmail.com'];

/**
 * DETERMINISTIC ROLE HOOK
 * Purely derived from the central FirebaseProvider state.
 * No dependencies on stale LocalStorage or Zustand.
 */
export function useAdminAuth() {
  const { user, profile, authLoading, profileLoading, appReady, error } = useFirebase();

  const isAdmin = useMemo(() => {
    return !!(user && ADMIN_EMAILS.includes(user.email || ''));
  }, [user]);

  const isMerchant = useMemo(() => {
    if (isAdmin) return true;
    return profile?.accountType === 'restaurant';
  }, [isAdmin, profile]);

  const isEmployee = useMemo(() => {
    return profile?.accountType === 'employee';
  }, [profile]);

  const isCustomer = useMemo(() => {
    if (isAdmin || isMerchant || isEmployee) return false;
    return true;
  }, [isAdmin, isMerchant, isEmployee]);

  return {
    user,
    profile,
    isAdmin,
    isMerchant,
    isEmployee,
    isCustomer,
    isLoading: !appReady,
    authLoading,
    profileLoading,
    error,
  };
}
