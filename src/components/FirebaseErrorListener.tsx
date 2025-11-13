
'use client';

import { useState, useEffect, useCallback } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { usePathname } from 'next/navigation';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It logs the error to a dedicated Firestore collection for admin review
 * and then throws the error to be caught by Next.js's global-error.tsx during development.
 */
export function FirebaseErrorListener() {
  const { firestore, user } = useFirebase();
  const pathname = usePathname();
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  const logErrorToFirestore = useCallback(async (permissionError: FirestorePermissionError) => {
    if (!firestore || !user) {
      console.warn("Cannot log permission error: user or firestore not available.");
      return;
    }

    try {
      const errorLog = {
        userId: user.uid,
        userEmail: user.email,
        timestamp: serverTimestamp(),
        errorMessage: permissionError.message,
        errorDetails: permissionError.request,
        path: pathname, // Add the current page path to the log
      };

      await addDoc(collection(firestore, 'appErrors'), errorLog);
      console.log("Permission error logged to Firestore.");
    } catch (logError) {
      console.error("CRITICAL: Failed to log permission error to Firestore:", logError);
      // We don't re-throw here to avoid an infinite loop if logging itself fails.
    }
  }, [firestore, user, pathname]);

  useEffect(() => {
    const handleError = async (permissionError: FirestorePermissionError) => {
      // First, log the error to Firestore for the admin.
      await logErrorToFirestore(permissionError);
      // Then, set it in state to trigger the development overlay.
      setError(permissionError);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, [logErrorToFirestore]);

  if (error) {
    // This will be caught by Next.js's error boundary in development
    throw error;
  }

  // This component renders nothing.
  return null;
}
