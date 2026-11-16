// Service worker minimal : sert uniquement à rendre le site installable.
// Aucun cache. Seules les ressources GET du même site passent par le réseau ;
// les appels à l'API du Worker ou aux fournisseurs ne sont jamais interceptés.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(fetch(event.request));
});
