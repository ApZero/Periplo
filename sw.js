// sw.js — Periplo service worker
// IMPORTANTE: subir CACHE_VERSION en cada deploy para forzar la actualización del cache.
const CACHE_VERSION = 'periplo-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/utils.js',
  './js/db.js',
  './js/currency.js',
  './js/map.js',
  './js/expenses.js',
  './js/hotels.js',
  './js/itinerary.js',
  './js/backup.js',
  './js/views.js',
  './js/views-trip.js',
  './js/views-expenses.js',
  './js/views-hotels.js',
  './js/views-itinerary.js',
  './js/views-map.js',
  './js/views-settings.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Tasas de cambio: siempre intentar red primero, caer a cache si falla
  if (url.hostname === 'api.frankfurter.app') {
    event.respondWith(
      fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        return res;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Fuentes de Google Fonts y librería de mapas (Leaflet vía cdnjs): cache-first
  if (url.hostname.includes('fonts.g') || url.hostname === 'cdnjs.cloudflare.com') {
    event.respondWith(
      caches.match(event.request).then((cached) => cached || fetch(event.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
        return res;
      }))
    );
    return;
  }

  // App shell propia: cache-first, actualizando en segundo plano
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetchPromise = fetch(event.request).then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(event.request, clone));
          }
          return res;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
  }
});
