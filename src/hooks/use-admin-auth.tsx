
'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useMemo } from 'react';

const ADMIN_EMAILS = ['shanmuka7073@gmail.com'];

/**
 * A hook to determine the current user's role and authorization status.
 * Optimized to handle multiple roles and loading states gracefully.
 */
export function useAdminAuth() {
  const { user, isUserLoading, firestore } = useFirebase();

  // Explicitly return null if firestore or user is not available
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  const isAdmin = useMemo(() => {
    return !!(user && ADMIN_EMAILS.includes(user.email || ''));
  }, [user]);

  const isRestaurantOwner = useMemo(() => {
    return userData?.accountType === 'restaurant';
  }, [userData]);

  const isEmployee = useMemo(() => {
    return userData?.accountType === 'employee';
  }, [userData]);

  const isChickenAdmin = useMemo(() => {
    return !!(user && user.email === 'chickenadmin@gmail.com');
  }, [user]);

  // If user is logged in, we must wait for the profile to load before concluding status.
  // If user is NOT logged in, we are NOT loading.
  const loading = user ? (isUserLoading || isProfileLoading) : isUserLoading;

  return {
    isAdmin,
    isRestaurantOwner,
    isEmployee,
    isChickenAdmin,
    isLoading: loading,
    user,
    userData,
  };
}
