// This is a custom service worker.
// It's using a basic "Network First" strategy for most assets,
// which is a good balance for web apps.

// This makes sure the service worker takes control of the page as soon as possible.
self.addEventListener('install', event => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

// The main fetch event handler
self.addEventListener('fetch', event => {
  const { request } = event;

  // For navigation requests (loading a page), always go to the network first.
  // This ensures users always get the latest HTML.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => {
        // If the network fails, you could return a cached offline page.
        // For simplicity, we're not caching the HTML shell here.
      })
    );
    return;
  }

  // For other requests (CSS, JS, images, manifest.json), use a Network First strategy.
  event.respondWith(
    fetch(request)
      .then(response => {
        // If the network request is successful, cache the response and return it.
        const responseToCache = response.clone();
        caches.open('localbasket-cache-v1').then(cache => {
          cache.put(request, responseToCache);
        });
        return response;
      })
      .catch(() => {
        // If the network request fails, try to get it from the cache.
        return caches.match(request);
      })
  );
});
