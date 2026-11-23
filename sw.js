// برنامج التدريب — offline support
// v3: network-first for same-origin (HTML/manifest/icons) so updates appear immediately;
// cache-first only for third-party CDN assets.
const CACHE = 'training-planner-v5';
const PRECACHE = ['./', 'index.html', 'manifest.json', 'icon-192.png', 'icon-512.png'];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE)
            .then(c => c.addAll(PRECACHE))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys()
            .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
            .then(() => self.clients.claim())
            // Pages pinned by the old cache-first SW have no controllerchange
            // listener, so reload controlled pages once on takeover: they then
            // load fresh HTML from the network.
            .then(() => self.clients.matchAll({ type: 'window' }))
            .then(clients => clients.forEach(c => c.navigate(c.url)))
    );
});

self.addEventListener('fetch', e => {
    if (e.request.method !== 'GET') return;
    const url = new URL(e.request.url);

    // Same-origin and navigations: network first, fall back to cache when offline
    if (e.request.mode === 'navigate' || url.origin === self.location.origin) {
        e.respondWith(
            fetch(e.request).then(resp => {
                if (resp && resp.ok) {
                    const copy = resp.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy));
                }
                return resp;
            }).catch(() =>
                caches.match(e.request).then(r => r || caches.match('index.html'))
            )
        );
        return;
    }

    // Third-party (CDN libraries, fonts): cache first, then network
    e.respondWith(
        caches.match(e.request).then(cached => {
            if (cached) return cached;
            return fetch(e.request).then(resp => {
                if (resp && (resp.ok || resp.type === 'opaque')) {
                    const copy = resp.clone();
                    caches.open(CACHE).then(c => c.put(e.request, copy));
                }
                return resp;
            }).catch(() => caches.match(e.request));
        })
    );
});
