
'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration (Hardened)
 * Registers the PWA shell silently to avoid double-refresh cycles on operational dashboards.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      
      const register = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none'
          });
          
          console.log('Adires PWA registered:', registration.scope);
          
          // Silent background updates to prevent layout shifts/refreshes during usage
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('New content available in background cache.');
                  }
                }
              };
            }
          };

        } catch (error) {
          console.error('PWA Registration failed:', error);
        }
      };

      // Register on window load to prioritize main thread for operational UI
      if (document.readyState === 'complete') {
        register();
      } else {
        window.addEventListener('load', register);
        return () => window.removeEventListener('load', register);
      }
    }
  }, []);

  return null;
}
