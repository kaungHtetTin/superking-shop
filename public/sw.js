const CACHE_PREFIX = 'musical-store-pwa';
const CACHE_VERSION = 'v3';
const STATIC_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}-static`;
const PAGE_CACHE = `${CACHE_PREFIX}-${CACHE_VERSION}-pages`;
const MAX_PAGE_ENTRIES = 24;
const MAX_STATIC_ENTRIES = 96;

const appScope = new URL(self.registration.scope);
const scopePath = appScope.pathname.replace(/\/$/, '');
const scopedUrl = (path) => `${scopePath}${path}`;

const PRECACHE_URLS = [
  scopedUrl('/manifest.webmanifest'),
  scopedUrl('/pwa-icon.svg'),
];

const OFFLINE_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
  <meta name="theme-color" content="#9c3f2c">
  <title>Offline</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:#fffaf1;color:#171312;display:grid;min-height:100vh;place-items:center;padding:24px}
    main{width:min(420px,100%);background:#fffdf8;border:1px solid rgba(156,63,44,.18);border-radius:10px;padding:24px;box-shadow:0 18px 54px rgba(36,27,24,.1)}
    h1{font-size:24px;line-height:1.1;margin:0 0 8px}p{margin:0;color:#5f5550;line-height:1.55}.note{margin-top:14px;font-weight:800;color:#9c3f2c}
  </style>
</head>
<body>
  <main>
    <h1>You are offline</h1>
    <p>Reconnect to continue shopping. Public pages and assets you opened recently may still load from this device.</p>
    <p class="note">Your cart stays on this device.</p>
  </main>
</body>
</html>`;

const offlineResponse = () => new Response(OFFLINE_HTML, {
  headers: { 'Content-Type': 'text/html; charset=utf-8' },
});

const isAdminPath = (pathname) => pathname === scopedUrl('/admin') || pathname.startsWith(scopedUrl('/admin/'));
const isAuthPath = (pathname) => [
  scopedUrl('/login'),
  scopedUrl('/register'),
  scopedUrl('/forgot-password'),
  scopedUrl('/reset-password'),
].some((path) => pathname === path || pathname.startsWith(`${path}/`));

const isPrivatePath = (pathname) => [
  scopedUrl('/checkout'),
  scopedUrl('/orders'),
  scopedUrl('/profile'),
  scopedUrl('/chat'),
].some((path) => pathname === path || pathname.startsWith(`${path}/`));

const isStaticAsset = (pathname) => (
  pathname.startsWith(scopedUrl('/build/')) ||
  pathname.startsWith(scopedUrl('/storage/')) ||
  pathname.startsWith(scopedUrl('/uploads/')) ||
  pathname === scopedUrl('/favicon.ico') ||
  pathname === scopedUrl('/pwa-icon.svg')
);

const shouldSkip = (url) => (
  url.origin !== self.location.origin ||
  isAdminPath(url.pathname) ||
  url.pathname.startsWith(scopedUrl('/api/')) ||
  url.pathname.startsWith(scopedUrl('/broadcasting/'))
);

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;

  await Promise.all(keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)));
}

async function putIfCacheable(cacheName, request, response, maxEntries) {
  if (!response || !response.ok || response.type === 'opaque') {
    return response;
  }

  const cache = await caches.open(cacheName);
  await cache.put(request, response.clone());
  await trimCache(cacheName, maxEntries);
  return response;
}

async function networkFirstPage(request, canCache = true) {
  try {
    const response = await fetch(request);
    if (canCache) {
      await putIfCacheable(PAGE_CACHE, request, response, MAX_PAGE_ENTRIES);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || await caches.match(scopedUrl('/')) || offlineResponse();
  }
}

async function staleWhileRevalidate(request) {
  const cached = await caches.match(request);
  const refresh = fetch(request)
    .then((response) => putIfCacheable(STATIC_CACHE, request, response, MAX_STATIC_ENTRIES))
    .catch(() => null);

  return cached || await refresh || Response.error();
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith(CACHE_PREFIX) && !key.startsWith(`${CACHE_PREFIX}-${CACHE_VERSION}`))
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  if (shouldSkip(url)) {
    return;
  }

  if (request.mode === 'navigate') {
    const cachePublicPage = !isPrivatePath(url.pathname) && !isAuthPath(url.pathname);
    event.respondWith(networkFirstPage(request, cachePublicPage));
    return;
  }

  if (isStaticAsset(url.pathname) || url.pathname === scopedUrl('/manifest.webmanifest')) {
    event.respondWith(staleWhileRevalidate(request));
  }
});
