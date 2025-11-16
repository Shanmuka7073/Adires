'use client';
import {
  Auth,
  signInAnonymously,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
} from 'firebase/auth';
import { sessionLogin } from '@/firebase/session-login'; // Import the new server action

/** Initiate anonymous sign-in (non-blocking). */
export function initiateAnonymousSignIn(authInstance: Auth): Promise<void> {
  return signInAnonymously(authInstance)
    .then(async (userCredential) => {
      // After successful sign-in, create the server session.
      const idToken = await userCredential.user.getIdToken();
      await sessionLogin(idToken);
    })
    .catch((err) => {
      console.error('Anonymous sign-in failed:', err);
      throw err;
    });
}

/** Initiate email/password sign-up (non-blocking). */
export function initiateEmailSignUp(authInstance: Auth, email: string, password: string): Promise<void> {
  return createUserWithEmailAndPassword(authInstance, email, password)
    .then(async (userCredential) => {
      // After sign-up, the user is automatically signed in.
      // Create the server-side session cookie immediately.
      const idToken = await userCredential.user.getIdToken();
      await sessionLogin(idToken);
    })
    .catch((err) => {
      console.error('Email sign-up failed:', err);
      throw err;
    });
}

/** Initiate email/password sign-in (non-blocking). */
export function initiateEmailSignIn(authInstance: Auth, email: string, password: string): Promise<void> {
  return signInWithEmailAndPassword(authInstance, email, password)
    .then(async (userCredential) => {
      // After successful sign-in, create the server session.
      const idToken = await userCredential.user.getIdToken();
      await sessionLogin(idToken);
    })
    .catch((err) => {
      console.error('Email sign-in failed:', err);
      throw err;
    });
}
