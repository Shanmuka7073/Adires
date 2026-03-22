
'use client';

import { useEffect } from 'react';

/**
 * Aggressively registers and manages the Service Worker lifecycle.
 * Implements "skipWaiting" and "claim" logic to ensure the PWA is active immediately.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      
      // 1. Handle automatic reload when a new worker takes control
      let refreshing = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });

      const register = async () => {
        try {
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none'
          });
          
          console.log('Adires PWA registered:', registration.scope);
          
          // 2. Handle automatic updates
          registration.onupdatefound = () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.onstatechange = () => {
                if (installingWorker.state === 'installed') {
                  if (navigator.serviceWorker.controller) {
                    console.log('New content available; pushing update.');
                    installingWorker.postMessage({ type: 'SKIP_WAITING' });
                  } else {
                    console.log('Content is cached for offline use.');
                  }
                }
              };
            }
          };

          // 3. If a worker is already waiting, force it to activate
          if (registration.waiting) {
              console.log('Update waiting. Pushing activation.');
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }

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
