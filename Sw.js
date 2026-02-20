const CACHE_NAME = 'rotorcast-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  'https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Barlow+Condensed:wght@300;400;600;700&family=Barlow:wght@300;400;500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.2/babel.min.js'
];

// Install — cache all static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Some assets failed to cache (likely CDN CORS):', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first for weather API, cache first for static assets
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network-first for weather/geocoding APIs
  const isApi = url.hostname.includes('open-meteo.com') ||
                url.hostname.includes('geocoding-api');

  if (isApi) {
    event.respondWith(
      fetch(event.request).catch(() => {
        return new Response(JSON.stringify({
          error: true,
          message: 'No internet connection. Weather data unavailable offline.'
        }), { headers: { 'Content-Type': 'application/json' } });
      })
    );
    return;
  }

  // Cache-first for everything else (app shell)
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        // Cache successful GET responses
        if (event.request.method === 'GET' && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Fallback to index.html for navigation requests
      if (event.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
