
'use client';

import { useEffect } from 'react';

/**
 * Aggressively registers the Service Worker on the client.
 * Includes explicit scope handling and cache-busting for production environments.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      const register = async () => {
        try {
          // Register with explicit root scope and a version query to bypass cache
          const registration = await navigator.serviceWorker.register('/sw.js?v=4', {
            scope: '/',
            updateViaCache: 'none'
          });
          
          console.log('Adires Shell registered successfully. Scope:', registration.scope);
          
          // Trigger immediate activation for better first-load experience
          if (registration.installing) {
              console.log('Adires Shell: Installing...');
          } else if (registration.waiting) {
              console.log('Adires Shell: Update waiting. Manual refresh recommended.');
              registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          } else if (registration.active) {
              console.log('Adires Shell: Active and healthy.');
          }

          // Signal to diagnostic tools that registration was successful
          window.dispatchEvent(new CustomEvent('sw-registered', { detail: registration }));
          
        } catch (error) {
          console.error('Adires Shell registration failed:', error);
        }
      };

      // Ensure registration happens as soon as possible
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
