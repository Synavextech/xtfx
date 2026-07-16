const CACHE_NAME = 'extfx-cache-v1';
const ASSETS_TO_CACHE = [
  '/',
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

  // Network-First strategy for navigate requests (index.html, etc.) to ensure updated build hashes
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          return caches.match(event.request) || caches.match('/');
        })
    );
    return;
  }

  // Cache-First with Network fallback and error safety for static assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request).catch((err) => {
        console.error('ServiceWorker fetch failed:', err);
        // Return a basic error response instead of throwing inside respondWith
        return new Response('Network error occurred', {
          status: 408,
          statusText: 'Network Error',
          headers: new Headers({ 'Content-Type': 'text/plain' })
        });
      });
    })
  );
});
