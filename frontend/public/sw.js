// Service Worker para Smart Dashcam
const CACHE_NAME = 'smart-dashcam-v1';

// Assets a cachear para funcionamiento offline
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/src/main.jsx',
  '/src/styles/mobile.css',
  '/dashcam-icon.svg',
];

// Instalación del Service Worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activación y limpieza de caches antiguas
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Estrategia de caché: Network first, fallback to cache
self.addEventListener('fetch', (event) => {
  // Solo manejar solicitudes GET
  if (event.request.method !== 'GET') return;

  // Ignorar solicitudes a la API de WebSocket
  if (event.request.url.includes('/ws')) return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Si la red está disponible, actualizar la caché
        const clonedResponse = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, clonedResponse);
        });
        return networkResponse;
      })
      .catch(() => {
        // Si la red falla, intentar usar la caché
        return caches.match(event.request).then((cachedResponse) => {
          return cachedResponse || new Response(
            JSON.stringify({ error: 'No hay conexión y no se encontró en caché' }),
            { 
              status: 503, 
              headers: { 'Content-Type': 'application/json' } 
            }
          );
        });
      })
  );
});
