// sw.js - Service Worker PDF & Image Tools Suite
const CACHE_NAME = 'pdf-tools-v32';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/style.css',
  '/manifest.json',
  '/icon.svg',
  '/js/shared/security.js',
  '/js/shared/file-validator.js',
  '/js/shared/canvas-animation.js',
  '/js/shared/navbar.js',
  '/js/shared/toast.js',
  '/js/shared/pwa.js',
  '/js/tools/image-compressor.js',
  '/js/tools/image-to-pdf.js',
  '/js/tools/image-resizer.js',
  '/js/tools/pdf-compressor.js',
  '/js/tools/pdf-merge.js',
  '/js/tools/pdf-split.js',
  '/js/tools/pdf-rotate.js',
  '/js/tools/pdf-to-images.js',
  '/js/tools/image-format-converter.js',
  '/js/tools/pdf-to-text.js',
  '/js/tools/pdf-to-long-image.js',
  '/js/tools/html-to-pdf.js',
  '/image-compressor/index.html',
  '/image-to-pdf/index.html',
  '/image-resizer/index.html',
  '/pdf-compressor/index.html',
  '/pdf-merge/index.html',
  '/pdf-split/index.html',
  '/pdf-rotate/index.html',
  '/pdf-to-images/index.html',
  '/image-format-converter/index.html',
  '/pdf-to-text/index.html',
  '/pdf-to-long-image/index.html',
  '/html-to-pdf/index.html'
];

// Install Event - Pre-cache Static Assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Pre-caching static assets');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[Service Worker] Caching error:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network first with Cache Fallback for dynamic / CDN resources, Cache first for static
self.addEventListener('fetch', (event) => {
  // Ignore non-GET requests
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // Ignore unsupported schemes (chrome-extension://, moz-extension://, data:, blob:, etc.)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});

        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache).catch(() => {});
        });

        return networkResponse;
      }).catch(() => {
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/');
        }
      });
    })
  );
});
