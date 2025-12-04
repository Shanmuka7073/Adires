
// This is a custom service worker that gives us more control over caching.
// It uses a "Network First" strategy for the manifest to ensure updates are fetched.

const CACHE_NAME = 'local-basket-cache-v1';
const urlsToCache = [
  '/',
  '/manifest.json',
  '/favicon.ico',
  '/apple-touch-icon.png',
  // We won't cache the icons themselves here to ensure they can be updated,
  // but we will cache the main app shell files.
];

self.addEventListener('install', (event) => {
  // Perform install steps
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Strategy for manifest.json: Network first, then cache.
  // This ensures the browser always tries to get the latest icons.
  if (requestUrl.pathname === '/manifest.json') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Strategy for other requests: Cache first, then network.
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        // Clone the request because it's a one-time-use stream
        const fetchRequest = event.request.clone();

        return fetch(fetchRequest).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response because it's also a one-time-use stream
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                cache.put(event.request, responseToCache);
              });

            return response;
          }
        );
      })
    );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
