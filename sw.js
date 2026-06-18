const CACHE_NAME = 'cognito-reader-v14';

const PRECACHE_URLS = [
    '/',
    '/index.html',
    '/code_artifact.html',
    '/manifest.webmanifest',
    '/scripts/reader-math.js',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    '/vendor/tailwindcdn.js',
    '/vendor/lucide.min.js',
    '/vendor/pdf.min.js',
    '/vendor/jszip.min.js',
    '/vendor/mobi.js',
    '/vendor/foliate-zip.js',
    '/vendor/foliate-epubcfi.js',
    '/vendor/foliate-epub.js',
    '/vendor/extract-epub-toc.js',
    '/vendor/extract-epub-cover.js'
];

function isHtmlRequest(request, url) {
    return request.mode === 'navigate'
        || url.pathname === '/'
        || url.pathname.endsWith('.html');
}

async function networkFirst(request) {
    try {
        const response = await fetch(request);
        if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, response.clone());
        }
        return response;
    } catch (err) {
        const cached = await caches.match(request);
        if (cached) return cached;
        throw err;
    }
}

async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
    }
    return response;
}

self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(PRECACHE_URLS))
            .catch((err) => console.warn('SW precache partial failure:', err))
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((keys) => Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    if (isHtmlRequest(request, url)) {
        event.respondWith(networkFirst(request));
        return;
    }

    event.respondWith(cacheFirst(request));
});
