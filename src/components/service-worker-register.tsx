
'use client';

import { useEffect } from 'react';

/**
 * Service Worker Registration (Hardened)
 * Registers the PWA shell and handles the custom ad-network script injection.
 */
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      
      const register = async () => {
        try {
          // Register the main SW
          const registration = await navigator.serviceWorker.register('/sw.js', {
            scope: '/',
            updateViaCache: 'none'
          });
          
          console.log('Adires PWA registered:', registration.scope);

          // Handle custom ad-network script if not already present in the SW
          // Note: Standard next-pwa generation uses sw.js. 
          // We import our ads-config.js into the worker scope if needed.
          
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
