
'use client';

import { useEffect } from 'react';

/**
 * Ensures the Service Worker is registered explicitly on the client.
 * This activates PWA features like offline caching and background sync.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
          .then((registration) => {
            console.log('SW Registered: ', registration.scope);
          })
          .catch((err) => {
            console.error('SW Registration Failed: ', err);
          });
      });
    }
  }, []);

  return null;
}
