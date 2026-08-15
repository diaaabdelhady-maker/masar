// Service Worker الخاص بتطبيق مسار بلاير فقط (منفصل تماماً عن أي كاش خاص بالمنصة)
const CACHE_NAME = 'masar-player-shell-v1';
const PRECACHE_ASSETS = ['./player.html', './player-manifest.json', './icon.svg'];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS)).catch(() => {})
    );
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    // مبنعملش cache لأي طلب فيه توكن الحصة (query string) عشان منخزنش أي بيانات حساسة
    if (request.url.includes('?token=')) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request).catch(() => caches.match('./player.html'))
        );
        return;
    }

    event.respondWith(
        caches.match(request).then((cached) => cached || fetch(request))
    );
});