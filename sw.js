// sw.js
const CACHE_NAME = 'garaje-pwa-v1';

// Recursos que se precargan al instalar el Service Worker.
// Ajusta las rutas si tu estructura de carpetas es diferente.
const PRECACHE_URLS = [
  './garaje.html',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-192.png',
  './icons/icon-maskable-512.png'
];

// 1. Instalación: precarga los recursos en la caché.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS);
    }).then(() => self.skipWaiting())
  );
});

// 2. Activación: limpia cachés antiguas.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch: responde desde la caché o la red, con fallback offline.
self.addEventListener('fetch', (event) => {
  // Solo interceptamos peticiones GET.
  if (event.request.method !== 'GET') return;

  // Si es una navegación (el usuario abre la app), devolvemos garaje.html.
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./garaje.html').then((cached) => {
        return cached || fetch(event.request);
      })
    );
    return;
  }

  // Para el resto de recursos: cache-first con fallback a la red.
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        // Opcional: guardar en caché la respuesta para futuras visitas.
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseClone);
        });
        return response;
      });
    })
  );
});