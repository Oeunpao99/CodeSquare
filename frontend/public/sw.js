/* CodeSquare service worker: makes the site installable (no address bar) and
   keeps it usable on flaky connections.
   - API calls (/api/*) always go to the network: never cached.
   - Page navigations: network first, fall back to the cached app shell.
   - Built assets, icons, sounds, fonts: cache first, refreshed in the background. */
const VERSION = 'cs-v1';
const SHELL = ['/', '/manifest.webmanifest', '/logo.png', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && url.pathname.startsWith('/api/')) return; // live data only

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/')),
    );
    return;
  }

  const cacheable = (sameOrigin && /^\/(assets|icons|sounds|thumbnails|banners|illustrations)\/|\.(png|webp|svg|mp3|woff2?)$/.test(url.pathname))
    || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com';
  if (!cacheable) return;

  event.respondWith(
    caches.open(VERSION).then(async (cache) => {
      const hit = await cache.match(req);
      const fresh = fetch(req).then((res) => {
        if (res.ok || res.type === 'opaque') cache.put(req, res.clone());
        return res;
      }).catch(() => hit);
      return hit || fresh;
    }),
  );
});
