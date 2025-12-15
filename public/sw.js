
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.open('localbasket').then(cache =>
      fetch(event.request)
        .then(res => {
          cache.put(event.request, res.clone());
          return res;
        })
        .catch(() => cache.match(event.request))
    )
  );
});
