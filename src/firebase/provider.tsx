'use client';

import React, { createContext, useContext, ReactNode, useMemo, useState, useEffect, DependencyList } from 'react';
import { FirebaseApp } from 'firebase/app';
import { Firestore, doc, getDoc } from 'firebase/firestore';
import { Auth, User, onAuthStateChanged } from 'firebase/auth';
import type { User as AppUser } from '@/lib/types';
import { logRuntimeError } from '@/lib/monitoring/error-logger';

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

export interface FirebaseServicesAndUser extends FirebaseContextState {}

export const FirebaseContext = createContext<FirebaseContextState | undefined>(undefined);

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

  // GLOBAL DEBUG SYSTEM
  useEffect(() => {
    if (typeof window !== 'undefined') {
      console.log("🔥 Debug system initialized");

      window.runAppTest = function () {
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

      console.log("✅ runAppTest attached to window:", window.runAppTest);
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as any).__DEBUG_USER__ = user;
      (window as any).__DEBUG_ACCOUNT_TYPE__ = profile?.accountType;
      (window as any).__DEBUG_APP_READY__ = !authLoading && !profileLoading;
    }
  }, [user, profile, authLoading, profileLoading]);

  // GLOBAL ERROR LISTENERS
  useEffect(() => {
    if (!firestore) return;

    const handleError = (event: ErrorEvent) => {
      logRuntimeError(firestore, {
        message: event.message || 'Unknown runtime error',
        stack: event.error?.stack,
        url: window.location.href,
        userId: user?.uid,
        accountType: profile?.accountType
      });
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      logRuntimeError(firestore, {
        message: event.reason?.message || 'Unhandled Promise Rejection',
        stack: event.reason?.stack,
        url: window.location.href,
        userId: user?.uid,
        accountType: profile?.accountType
      });
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, [firestore, user, profile]);

  useEffect(() => {
    if (!auth || !firestore) return;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);

      if (firebaseUser) {
        setProfileLoading(true);
        try {
          const userRef = doc(firestore, 'users', firebaseUser.uid);
          const docSnap = await getDoc(userRef);

          console.log("[UID]", firebaseUser.uid);
          console.log("[DOC_ID_FETCHED]", userRef.id);
          console.log("[PROFILE_DATA]", docSnap.data());

          if (docSnap.exists()) {
            const data = docSnap.data();
            setProfile({ 
                ...data, 
                id: docSnap.id,
                accountType: data?.accountType || "user"
            } as AppUser);
          } else {
            console.warn("[PROFILE_NOT_FOUND] No Firestore document for UID:", firebaseUser.uid);
            setProfile(null);
          }
        } catch (err: any) {
          console.error("[PROFILE_FETCH_ERROR]", err);
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