
/**
 * Adires PWA Service Worker
 * Integrated with Ad-Network configuration
 */

importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.4.1/workbox-sw.js');

// 1. AD-NETWORK INTEGRATION
// Required script for 5gvci.com ad delivery
importScripts('https://5gvci.com/pwa/10790859');

workbox.setConfig({ debug: false });

workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);

// 2. DYNAMIC CACHING
// Cache images from Unsplash, Picsum, and Cloud Storage
workbox.routing.registerRoute(
  ({ url }) => url.origin === 'https://images.unsplash.com' || 
               url.origin === 'https://picsum.photos' ||
               url.origin === 'https://storage.googleapis.com' ||
               url.origin === 'https://i.ibb.co',
  new workbox.strategies.CacheFirst({
    cacheName: 'adires-images',
    plugins: [
      new workbox.expiration.ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
      }),
    ],
  })
);

// Cache API-like routes with NetworkFirst
workbox.routing.registerRoute(
  ({ url }) => url.pathname.startsWith('/menu') || url.pathname.startsWith('/dashboard'),
  new workbox.strategies.NetworkFirst({
    cacheName: 'adires-business-logic',
    networkTimeoutSeconds: 5,
  })
);

// Default StaleWhileRevalidate for other assets
workbox.routing.registerRoute(
  ({ request }) => request.destination === 'script' || request.destination === 'style',
  new workbox.strategies.StaleWhileRevalidate({
    cacheName: 'adires-assets',
  })
);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});
