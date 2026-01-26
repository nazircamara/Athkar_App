const VERSION = 'v1';
const APP_CACHE = `athkar-ui-${VERSION}`;
const AUDIO_CACHE = `athkar-audio-${VERSION}`;

const UI_ASSETS = [
    './',
    './index.html',
    './style.css',
    './app.js',
    './manifest.json'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(APP_CACHE).then(cache => cache.addAll(UI_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys
                    .filter(key => key !== APP_CACHE && key !== AUDIO_CACHE)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

self.addEventListener('message', event => {
    const data = event.data || {};
    if (data.type === 'CACHE_AUDIO' && data.url) {
        const audioUrl = new URL(data.url, self.registration.scope);
        if (audioUrl.origin !== self.location.origin) return;

        event.waitUntil(
            caches.open(AUDIO_CACHE).then(async cache => {
                const cached = await cache.match(audioUrl.href);
                if (cached) return;
                const request = new Request(audioUrl.href, { cache: 'reload' });
                const response = await fetch(request);
                if (response && response.ok) {
                    await cache.put(audioUrl.href, response.clone());
                }
            })
        );
    }
});

self.addEventListener('fetch', event => {
    const request = event.request;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);
    if (url.origin !== self.location.origin) return;

    const isAudio = url.pathname.includes('/audios/') || url.pathname.includes('/audios2/');
    const isUI = request.mode === 'navigate' || ['style', 'script', 'document'].includes(request.destination);

    if (isAudio) {
        event.respondWith(cacheFirstAudio(request));
        return;
    }

    if (isUI) {
        event.respondWith(staleWhileRevalidate(request));
        return;
    }
});

async function staleWhileRevalidate(request) {
    const cache = await caches.open(APP_CACHE);
    const cachedResponse = await cache.match(request);

    const networkPromise = fetch(request)
        .then(response => {
            if (response && response.ok) {
                cache.put(request, response.clone());
            }
            return response;
        })
        .catch(() => cachedResponse);

    return cachedResponse || networkPromise;
}

async function cacheFirstAudio(request) {
    const cache = await caches.open(AUDIO_CACHE);
    const cachedResponse = await cache.match(request);
    if (cachedResponse) return cachedResponse;

    const response = await fetch(request);
    if (response && response.ok) {
        cache.put(request, response.clone());
    }
    return response;
}
