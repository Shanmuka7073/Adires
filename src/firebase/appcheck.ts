
'use client';

import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';
import { getFirebaseApp } from './app';

/**
 * MODULAR APP CHECK SDK
 * Protects the backend from unauthorized traffic.
 * Uses the production reCAPTCHA v3 site key.
 */
export function initAppCheck(): AppCheck | undefined {
  if (typeof window === 'undefined') return;
  
  const app = getFirebaseApp();
  if (!app) return;

  try {
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider('6LdgK5UsAAAAAN0jsIdfk5gPWZpSHKOo5aEGtYsw'),
      isTokenAutoRefreshEnabled: true,
    });
    
    // Expose for diagnostics
    (window as any).firebaseAppCheckInstance = appCheck;
    return appCheck;
  } catch (e) {
    console.warn("App Check modular init failed:", e);
    return undefined;
  }
}
