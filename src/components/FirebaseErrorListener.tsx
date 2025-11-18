
'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's global-error.tsx.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (error: FirestorePermissionError) => {
      // Set the error state, which will trigger a re-render
      setError(error);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // If an error has been caught, throw it so Next.js's error boundary can catch it.
  if (error) {
    // Re-throw the error with a clean, pre-formatted message
    // This ensures the Next.js overlay shows a readable error.
    const formattedError = new Error(error.message);
    formattedError.stack = error.stack; // Preserve the original stack trace
    throw formattedError;
  }

  // This component renders nothing. Its sole purpose is to listen and throw.
  return null;
}
