'use client';

import { useUser, useDoc, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import type { User as AppUser } from '@/lib/types';
import { useFirebase } from '@/firebase';

export function useAdminAuth() {
  const { user, isUserLoading } = useUser();
  const { firestore } = useFirebase();

  const userDocRef = useMemoFirebase(() => {
    if (!firestore || !user) return null;
    return doc(firestore, 'users', user.uid);
  }, [firestore, user]);

  const { data: userData, isLoading: isProfileLoading } = useDoc<AppUser>(userDocRef);

  const isAdmin = !isUserLoading && (user?.email === 'admin@gmail.com' || user?.email === 'admin2@gmail.com');
  const isChickenAdmin = !isUserLoading && user?.email === 'chickenadmin@gmail.com';
  const isRestaurantOwner = !isProfileLoading && userData?.accountType === 'restaurant';

  return { isAdmin, isChickenAdmin, isRestaurantOwner, isLoading: isUserLoading || isProfileLoading };
}
