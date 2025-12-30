// Nombre del caché
const CACHE_NAME = 'liga-madera-v1';

// Evento de instalación
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

// Evento de activación
self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

// Interceptor de red (necesario para PWA)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});