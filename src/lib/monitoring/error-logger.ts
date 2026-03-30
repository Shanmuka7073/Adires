
'use client';

import { collection, addDoc, serverTimestamp, Firestore } from 'firebase/firestore';

const recentErrors = new Set<string>();

/**
 * Throttled Error Logger
 * Prevents Firestore write spam by ignoring identical errors within a 10s window.
 */
export async function logRuntimeError(db: Firestore, errorData: {
  message: string;
  stack?: string;
  url: string;
  userId?: string;
  accountType?: string;
}) {
  const key = `${errorData.message}:${errorData.url}`;
  
  if (recentErrors.has(key)) return;
  
  recentErrors.add(key);
  setTimeout(() => recentErrors.delete(key), 10000);

  try {
    const payload = {
      ...errorData,
      timestamp: serverTimestamp(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    };

    await addDoc(collection(db, 'error_logs'), payload);
    
    if (process.env.NODE_ENV === 'development') {
      console.log('🐞 [AUTO_MONITOR] Logged to Firestore:', errorData.message);
    }
  } catch (e) {
    console.error('Failed to log error to Firestore:', e);
  }
}
