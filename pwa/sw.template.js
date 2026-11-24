/* KROOPY service worker — generated at build time by pwa/sw-plugin.ts.
   App shell + every built asset are precached, so the installed app opens instantly and works offline
   (all data already lives on the device). New versions install in the background and wait for the
   user to tap “Update”. */
const VERSION = '__VERSION__';
const PRECACHE = __PRECACHE__;
const SHELL = '/index.html';
const CACHE = `kroopy-precache-${VERSION}`;
const RUNTIME = 'kroopy-runtime-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k.startsWith('kroopy-precache-') && k !== CACHE).map((k) => caches.delete(k)));
      if (self.registration.navigationPreload) await self.registration.navigationPreload.disable().catch(() => {});
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // third-party (e.g. landing video) goes straight to the network

  // App navigations: serve the cached shell instantly (the SPA router takes over), refresh it in the background.
  if (req.mode === 'navigate' && !url.pathname.startsWith('/landing')) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE);
        const cached = await cache.match(SHELL, { ignoreVary: true });
        if (cached) return cached;
        try {
          return await fetch(req);
        } catch {
          return new Response('<h1>Offline</h1>', { headers: { 'Content-Type': 'text/html' } });
        }
      })(),
    );
    return;
  }

  // Precached build files: cache first.
  event.respondWith(
    (async () => {
      // ignoreVary: servers often send `Vary: Origin`, and module scripts / crossorigin font preloads carry
      // an Origin header that the precache requests did not — without it those files miss the cache offline.
      const hit = await caches.match(req, { ignoreSearch: url.pathname.startsWith('/assets/'), ignoreVary: true });
      if (hit) return hit;
      // Everything else (launch screens, original logos, landing page…): network, then keep a copy.
      try {
        const res = await fetch(req);
        if (res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(RUNTIME).then((c) => c.put(req, copy)).catch(() => {});
        }
        return res;
      } catch (err) {
        const fallback = await caches.match(req, { cacheName: RUNTIME, ignoreVary: true });
        if (fallback) return fallback;
        throw err;
      }
    })(),
  );
});

// Reminder notifications open (or focus) the app on the right screen.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const w of windows) {
        if ('focus' in w) {
          if ('navigate' in w && w.url !== target) await w.navigate(target).catch(() => {});
          return w.focus();
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
