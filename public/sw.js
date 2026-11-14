// Service worker minimal : nécessaire pour que le navigateur propose l'installation.
// Pas de cache : les requêtes passent directement au réseau.
self.addEventListener('install', function (event) { self.skipWaiting(); });
self.addEventListener('activate', function (event) { event.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', function (event) { event.respondWith(fetch(event.request)); });
