const CACHE_NAME = '27aflam-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/watch.html',
  '/series.watch.html',
  '/anime.watch.html',
  '/style.css',
  '/app.js',
  '/favicon.svg',
  '/manifest.webmanifest',
  '/robots.txt',
  '/sitemap.xml'
];

const TMDB_PATTERNS = ['api.themoviedb.org', 'image.tmdb.org'];

// Cache durations (in milliseconds)
const CACHE_DURATIONS = {
  html: 1 * 60 * 60 * 1000,     // 1 hour
  css: 30 * 24 * 60 * 60 * 1000, // 30 days
  js: 30 * 24 * 60 * 60 * 1000,  // 30 days
  images: 30 * 24 * 60 * 60 * 1000, // 30 days
  api: 5 * 60 * 1000             // 5 minutes
};

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // TMDB API: network-first with JSON fallback
  if (TMDB_PATTERNS.some((p) => url.hostname.includes(p)) && url.hostname.includes('api')) {
    event.respondWith(
      networkFirstWithFallback(request, CACHE_DURATIONS.api)
    );
    return;
  }

  // TMDB images: cache-first with long expiry
  if (url.hostname === 'image.tmdb.org') {
    event.respondWith(
      cacheFirst(request, CACHE_DURATIONS.images)
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    cacheFirstStatic(request)
  );
});

async function cacheFirst(request, maxAge) {
  const cached = await caches.match(request);
  if (cached) {
    // Check if cache is still fresh
    const cachedTime = cached.headers.get('sw-cache-time');
    if (cachedTime && Date.now() - parseInt(cachedTime) < maxAge) {
      return cached;
    }
  }
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      headers.set('Cache-Control', 'public, max-age=2592000'); // 30 days
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    return cached || new Response('', { status: 408 });
  }
}

async function cacheFirstStatic(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());

      // Set appropriate cache-control based on file type
      const url = new URL(request.url);
      const ext = url.pathname.split('.').pop().toLowerCase();
      let maxAge = 86400; // default 1 day
      if (['css', 'js'].includes(ext)) maxAge = 2592000; // 30 days
      else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg', 'ico'].includes(ext)) maxAge = 2592000;
      else if (ext === 'html') maxAge = 3600; // 1 hour

      headers.set('Cache-Control', `public, max-age=${maxAge}`);
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    // Fallback to offline page
    const offline = await caches.match('/index.html');
    return offline || new Response('Offline', { status: 503 });
  }
}

async function networkFirstWithFallback(request, maxAge) {
  try {
    const response = await fetch(request, { signal: AbortSignal.timeout(5000) });
    if (response.ok) {
      const cache = await caches.open(CACHE_NAME);
      const responseToCache = response.clone();
      const headers = new Headers(responseToCache.headers);
      headers.set('sw-cache-time', Date.now().toString());
      headers.set('Cache-Control', `public, max-age=${Math.floor(maxAge / 1000)}`);
      const cachedResponse = new Response(responseToCache.body, {
        status: responseToCache.status,
        statusText: responseToCache.statusText,
        headers
      });
      cache.put(request, cachedResponse);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Return a JSON error response
    return new Response(
      JSON.stringify({ results: [], error: 'offline', cached: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Message handler for cache cleanup
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
