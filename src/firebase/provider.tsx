
'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect, DependencyList } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import type { User as AppUser } from '@/lib/types';

export interface FirebaseContextState {
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
  user: User | null;
  profile: AppUser | null;
  authLoading: boolean;
  profileLoading: boolean;
  appReady: boolean;
  error: Error | null;
}

// Return type for useFirebase() includes the full state
export interface FirebaseServicesAndUser extends FirebaseContextState {}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

/**
 * CENTRALIZED IDENTITY PROVIDER
 * Enforces Auth -> Profile fetch sequence using UID as the document key.
 */
export const FirebaseProvider: React.FC<{
  children: ReactNode;
  firebaseApp: FirebaseApp;
  firestore: Firestore;
  auth: Auth;
}> = ({ children, firebaseApp, firestore, auth }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (firebaseUser) {
        setProfileLoading(true);
        try {
          // ALWAYS fetch using Firebase Auth UID as the document ID
          const userRef = doc(firestore, 'users', firebaseUser.uid);
          
          // Fetch document data
          const docSnap = await getDoc(userRef);
          
          // Debug logs for environment verification
          console.log("[UID]", firebaseUser.uid);
          console.log("[DOC_ID_FETCHED]", userRef.id);
          console.log("[PROFILE_DATA]", docSnap.data());

          if (docSnap.exists()) {
            const data = docSnap.data();
            
            // Extract accountType safely with a default fallback
            const accountType = data?.accountType || "user";
            
            setProfile({ 
                ...data, 
                id: docSnap.id,
                accountType 
            } as AppUser);
          } else {
            console.warn("[AUTH] Profile document missing for UID:", firebaseUser.uid);
            setProfile(null);
          }
        } catch (err: any) {
          console.error("Profile load failed:", err);
          setError(err);
        } finally {
          setProfileLoading(false);
        }
      } else {
        setProfile(null);
        setProfileLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, firestore]);

  // Sync state to window for the test function
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__DEBUG_USER__ = user;
      (window as any).__DEBUG_ACCOUNT_TYPE__ = profile?.accountType;
      (window as any).__DEBUG_APP_READY__ = !authLoading && !profileLoading;
    }
  }, [user, profile, authLoading, profileLoading]);

  // INITIALIZE GLOBAL DEBUG SYSTEM
  useEffect(() => {
    console.log("🔥 Debug system initialized");

    (window as any).runAppTest = function () {
      console.log("[TEST] Running system check");

      const state = {
        user: (window as any).__DEBUG_USER__,
        accountType: (window as any).__DEBUG_ACCOUNT_TYPE__,
        appReady: (window as any).__DEBUG_APP_READY__
      };

      console.log("[AUTH_STATE]", state);

      if (!state.user) console.error("❌ No user");
      if (!state.accountType) console.error("❌ Missing accountType");
      if (!state.appReady) console.error("❌ App not ready");

      console.log("✅ Test completed");
    };

    console.log("✅ runAppTest attached to window:", (window as any).runAppTest);
  }, []);

  const contextValue = useMemo(() => ({
    firebaseApp,
    firestore,
    auth,
    user,
    profile,
    authLoading,
    profileLoading,
    appReady: !authLoading && !profileLoading,
    error,
  }), [firebaseApp, firestore, auth, user, profile, authLoading, profileLoading, error]);

  return (
    <FirebaseContext.Provider value={contextValue}>
      {children}
    </FirebaseContext.Provider>
  );
};

export const useFirebase = (): FirebaseServicesAndUser => {
  const context = useContext(FirebaseContext);
  if (!context) throw new Error('useFirebase used outside Provider');
  return context;
};

export const useUser = () => {
    const { user, authLoading } = useFirebase();
    return { user, isUserLoading: authLoading };
};

export const useFirestore = () => useFirebase().firestore;
export const useAuth = () => useFirebase().auth;
export const useFirebaseApp = () => useFirebase().firebaseApp;

type MemoFirebase <T> = T & {__memo?: boolean};

export function useMemoFirebase<T>(factory: () => T, deps: DependencyList): T | (MemoFirebase<T>) {
  const memoized = useMemo(factory, deps);
  
  if(typeof memoized !== 'object' || memoized === null) return memoized;
  (memoized as MemoFirebase<T>).__memo = true;
  
  return memoized;
}
