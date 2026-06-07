const CACHE_NAME = 'cognito-reader-v14';
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/code_artifact.html',
  '/manifest.webmanifest',
  '/icons/icon-transparent.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/vendor/tailwindcdn.js',
  '/vendor/lucide.min.js',
  '/vendor/pdf.min.js',
  '/vendor/pdf.worker.min.js',
  '/vendor/jszip.min.js',
  '/vendor/mobi.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    ).then(() => self.clients.claim())
  );
});

function shouldNetworkFirst(url) {
  return url.pathname.endsWith('.html')
    || url.pathname.endsWith('.webmanifest')
    || url.pathname.startsWith('/icons/')
    || url.pathname.endsWith('/sw.js');
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (shouldNetworkFirst(url)) {
    event.respondWith(
      fetch(event.request).then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') return response;
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      }).catch(() => cached);
    })
  );
});
