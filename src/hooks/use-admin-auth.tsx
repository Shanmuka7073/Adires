
'use client';

import { useFirebase, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useMemo } from 'react';

const ADMIN_EMAILS = ['admin@gmail.com', 'admin2@gmail.com'];

/**
 * A hook to determine the current user's role and authorization status.
 * It checks the user's email against hardcoded admin lists and the 
 * Firestore user profile for business-specific roles.
 */
export function useAdminAuth() {
  const { user, isUserLoading, firestore } = useFirebase();

  // Reference to the user's profile document in Firestore
  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  // Real-time listener for the user profile data
  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  // Platform Admins (System-wide authority)
  const isAdmin = useMemo(() => {
    return !!(user && ADMIN_EMAILS.includes(user.email || ''));
  }, [user]);

  // Business Owner role (Restaurants, Salons, etc.)
  const isRestaurantOwner = useMemo(() => {
    return userData?.accountType === 'restaurant';
  }, [userData]);

  // Employee role
  const isEmployee = useMemo(() => {
    return userData?.accountType === 'employee';
  }, [userData]);

  return {
    isAdmin,
    isRestaurantOwner,
    isEmployee,
    isLoading: isUserLoading || isProfileLoading,
    user,
    userData,
  };
}
