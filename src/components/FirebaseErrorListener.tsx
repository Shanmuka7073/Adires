'use client';

import { useState, useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

/**
 * An invisible component that listens for globally emitted 'permission-error' events.
 * It throws any received error to be caught by Next.js's error boundaries.
 */
export function FirebaseErrorListener() {
  const [error, setError] = useState<FirestorePermissionError | null>(null);

  useEffect(() => {
    const handleError = (err: FirestorePermissionError) => {
      // Use a standard timeout to ensure the state update happens in the next tick
      // This prevents the "Cannot update a component while rendering a different component" error.
      setTimeout(() => {
        setError(err);
      }, 0);
    };

    errorEmitter.on('permission-error', handleError);

    return () => {
      errorEmitter.off('permission-error', handleError);
    };
  }, []);

  // Throw error during render so it's caught by the nearest ErrorBoundary (error.js)
  if (error) {
    throw error;
  }

  return null;
}