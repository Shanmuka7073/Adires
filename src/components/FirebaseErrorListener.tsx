
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import { useToast } from '@/hooks/use-toast';

/**
 * VISIBLE ERROR LISTENER
 * Surfaced hidden Permission Denied errors to the UI for rapid debugging.
 */
export function FirebaseErrorListener() {
  const { toast } = useToast();

  useEffect(() => {
    const handlePermissionError = (error: any) => {
      console.error("CRITICAL FIRESTORE ERROR DETECTED:", error);
      
      // We throw this error so it hits the Next.js Dev Overlay
      // This is much easier to see than a tiny log message.
      if (process.env.NODE_ENV === 'development') {
          toast({
            variant: 'destructive',
            title: 'Permission Denied',
            description: `Path: ${error.request?.path || 'unknown'}`,
          });
          
          // Re-throw to trigger the dev overlay if possible
          setTimeout(() => {
              throw error;
          }, 100);
      }
    };

    errorEmitter.on('permission-error', handlePermissionError);
    return () => errorEmitter.off('permission-error', handlePermissionError);
  }, [toast]);

  return null;
}
