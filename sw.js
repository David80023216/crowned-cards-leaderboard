/* Crown Hunt service worker — DEMO PHASE.
   The live board's old cache-first worker is retired while the demo preview
   is published. On install this worker wipes every Crown Hunt cache and then
   unregisters itself, so the demo page always loads fresh from the network.
   When the real board goes live again, replace this file with the app-shell
   worker (see git history) and re-register it from index.html. */
self.addEventListener('install', function (e) {
  e.waitUntil(self.skipWaiting());
});
self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      })
      .then(function () { return self.registration.unregister(); })
      .catch(function () {})
  );
});
