const CACHE_NAME = 'xfx-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Bypass cache for videos and external media assets (like mixkit)
  const url = new URL(event.request.url);
  if (
    url.pathname.endsWith('.mp4') || 
    url.pathname.endsWith('.webm') || 
    url.hostname.includes('mixkit.co') ||
    url.pathname.includes('/videos/')
  ) {
    return; // Let the browser handle the request naturally
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});
