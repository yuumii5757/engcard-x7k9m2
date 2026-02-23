// ─── Service Worker for PWA ──────────────────────────────────────
const CACHE_NAME = 'engcard-v3';
const ASSETS = [
    './',
    './index.html',
    './css/style.css',
    './js/db.js',
    './js/speech.js',
    './js/cards.js',
    './js/quiz.js',
    './js/sync.js',
    './js/app.js',
    './manifest.json',
    './icons/icon.svg',
    './icons/icon-512.png',
    './data/cards_updated.json'
];

// Install: cache all core assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            );
        })
    );
    self.clients.claim();
});

// Fetch: cache-first strategy (local assets only)
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Skip caching for external API calls (GitHub Gist sync etc.)
    if (url.origin !== self.location.origin) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            if (cached) return cached;
            return fetch(event.request).then((response) => {
                // Cache new requests dynamically (e.g. Google Fonts)
                if (response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clone);
                    });
                }
                return response;
            }).catch(() => {
                // Offline fallback
                return caches.match('./index.html');
            });
        })
    );
});
