
'use client';

import { useEffect } from 'react';

/**
 * Aggressively registers the Service Worker on the client.
 * This ensures that PWABuilder and browsers detect the worker immediately.
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
          
          console.log('Adires Service Worker registered with scope:', registration.scope);
          
          // Signal to our diagnostic tools that registration was attempted
          window.dispatchEvent(new CustomEvent('sw-registered', { detail: registration }));
          
        } catch (error) {
          console.error('Adires Service Worker registration failed:', error);
        }
      };

      // Register immediately if document is already loaded
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
