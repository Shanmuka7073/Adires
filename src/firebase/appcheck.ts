'use client';

import { initializeAppCheck, ReCaptchaV3Provider, AppCheck } from 'firebase/app-check';
import { app } from './app';

/**
 * MODULAR APP CHECK SDK
 * Protects the backend from unauthorized traffic.
 * Uses the production reCAPTCHA v3 site key.
 */
export function initAppCheck(): AppCheck | undefined {
  if (typeof window === 'undefined') return;
  
  try {
    const appCheck = initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider('6LfCA5UsAAAAHBhXpVksdpRTfzRkUP-2gTPfwAh'),
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
