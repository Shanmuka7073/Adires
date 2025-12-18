
'use client';

import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useFirebase } from '@/firebase';
import { useMemo } from 'react';

export function useAdminAuth() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  const isLoading = isUserLoading || (user && !userData);

  const { isAdmin, isChickenAdmin, isRestaurantOwner } = useMemo(() => {
    if (isLoading || !user || !userData) {
      return { isAdmin: false, isChickenAdmin: false, isRestaurantOwner: false };
    }
    
    const admin = user.email === 'admin@gmail.com' || user.email === 'admin2@gmail.com';
    const chickenAdmin = user.email === 'chickenadmin@gmail.com';
    const restaurantOwner = userData?.accountType === 'restaurant';

    return { isAdmin: admin, isChickenAdmin: chickenAdmin, isRestaurantOwner: restaurantOwner };

  }, [isLoading, user, userData]);
  
  return { isAdmin, isChickenAdmin, isRestaurantOwner, isLoading };
}
