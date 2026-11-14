// sw.js - Service Worker PDF & Image Tools Suite
//
// Strategi cache:
//  - Halaman (navigasi)        : network-first (maks. 4 detik), lalu cache bila offline
//  - JS/CSS/ikon milik sendiri : stale-while-revalidate (cepat, tetap diperbarui di latar)
//  - Pustaka CDN (pdf.js, dsb.) : cache-first di cache terpisah yang tidak ikut dihapus tiap rilis
//    (URL-nya sudah memuat nomor versi, jadi aman disimpan lama)

const VERSION = 'v42';
const STATIC_CACHE = 'pdf-tools-static-' + VERSION;
const RUNTIME_CACHE = 'pdf-tools-cdn-v1';

const STATIC_ASSETS = [
  '/',
  '/css/style.css',
  '/manifest.json',
  '/icon.svg',
  '/js/shared/security.js',
  '/js/shared/file-validator.js',
  '/js/shared/canvas-animation.js',
  '/js/shared/navbar.js',
  '/js/shared/tool-ui.js',
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
  '/js/tools/pdf-to-word.js',
  '/js/tools/pdf-to-word-core.js',
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
  '/pdf-to-word/index.html',
  '/pdf-to-long-image/index.html',
  '/html-to-pdf/index.html'
];

const CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'unpkg.com',
  'fonts.googleapis.com',
  'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => Promise.all(
        // satu file gagal tidak boleh menggagalkan seluruh pra-cache
        STATIC_ASSETS.map((url) => cache.add(url).catch((err) => console.warn('[SW] gagal pra-cache', url, err)))
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names
        .filter((n) => n !== STATIC_CACHE && n !== RUNTIME_CACHE)
        .map((n) => caches.delete(n)));
      // preload navigasi: permintaan halaman berjalan paralel dengan start service worker
      if (self.registration.navigationPreload) {
        try { await self.registration.navigationPreload.enable(); } catch (e) { /* abaikan */ }
      }
      await self.clients.claim();
    })()
  );
});

function timeout(ms) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));
}

async function handleNavigation(event) {
  const request = event.request;
  const cache = await caches.open(STATIC_CACHE);
  try {
    const preload = event.preloadResponse ? await event.preloadResponse : null;
    const response = preload || await Promise.race([fetch(request), timeout(4000)]);
    if (response && response.ok) cache.put(request, response.clone()).catch(() => {});
    return response;
  } catch (err) {
    const url = new URL(request.url);
    const clean = url.pathname.replace(/\/$/, '');
    return (
      (await cache.match(request)) ||
      (await cache.match(clean + '/index.html')) ||
      (await cache.match('/')) ||
      Response.error()
    );
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then((response) => {
    if (response && response.ok && response.type === 'basic') cache.put(request, response.clone()).catch(() => {});
    return response;
  }).catch(() => null);
  return cached || (await network) || Response.error();
}

async function cacheFirst(request) {
  const cache = await caches.open(RUNTIME_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  // respons "opaque" (tanpa CORS) juga boleh disimpan: dipakai untuk CSS font
  if (response && (response.ok || response.type === 'opaque')) cache.put(request, response.clone()).catch(() => {});
  return response;
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(event));
    return;
  }

  if (url.origin === self.location.origin) {
    if (url.pathname === '/sw.js') return;
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
