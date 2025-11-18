
'use client';

import { useUser } from '@/firebase';

export function useAdminAuth() {
  const { user, isUserLoading } = useUser();

  // The firestore rules define an admin by email, so we do the same on the client.
  const isAdmin = !isUserLoading && user?.email === 'admin@gmail.com';

  return { isAdmin, isLoading: isUserLoading };
}
