
'use client';

import { useEffect } from 'react';

/**
 * Aggressively registers and manages the Service Worker lifecycle.
 * Removed automatic reload on update to prevent "double-refresh" logic loops.
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
          
          // 2. Handle automatic updates silently
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('New content available; update cached.');
                    // Note: We no longer force a reload here to protect operational dashboard state
                  }
                }
              };
            }
          };

        } catch (error) {
          console.error('PWA Registration failed:', error);
        }
      };

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
