
'use client';

import { collection, addDoc, serverTimestamp, Firestore, query, orderBy, limit, getDocs, writeBatch, doc } from 'firebase/firestore';

export type LogSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface AppLog {
  message: string;
  severity: LogSeverity;
  type: string;
  route: string;
  userId?: string;
  accountType?: string;
  stack?: string;
  metadata?: Record<string, any>;
  timestamp?: any;
}

// Throttle logic: Prevent spamming Firestore with the same error
const recentLogs = new Map<string, number>();
const THROTTLE_MS = 10000; // 10 seconds

/**
 * Centralized logging utility for production monitoring.
 */
export async function logEvent(db: Firestore | null, log: AppLog) {
  if (!db) return;

  const now = Date.now();
  const logKey = `${log.type}:${log.message}`;
  const lastLogged = recentLogs.get(logKey);

  if (lastLogged && now - lastLogged < THROTTLE_MS) {
    return; // Skip throttled log
  }

  recentLogs.set(logKey, now);

  try {
    const logData = {
      ...log,
      timestamp: serverTimestamp(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server',
    };

    await addDoc(collection(db, 'app_logs'), logData);
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`[MONITORING:${log.severity.toUpperCase()}] ${log.message}`, log);
    }
  } catch (e) {
    console.error('Failed to send log to Firestore:', e);
  }
}

export async function clearAllLogs(db: Firestore) {
  const q = query(collection(db, 'app_logs'), limit(500));
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.docs.forEach((d) => batch.delete(doc(db, 'app_logs', d.id)));
  await batch.commit();
}
