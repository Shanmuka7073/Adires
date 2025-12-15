
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open('localbasket-cache').then(cache =>
      fetch(event.request)
        .then(response => {
          if (response.ok) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => cache.match(event.request))
    )
  );
});
