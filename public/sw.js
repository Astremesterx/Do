const CACHE = 'do-v2'
// Vite injects the exact hashed JS and CSS files for this production build.
const BUILD_ASSETS = []
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll([
          '/',
          '/favicon.svg',
          '/images/music.jpg',
          '/images/tech.jpg',
          '/images/food.jpg',
          '/images/art.jpg',
          '/images/nightlife.jpg',
          '/images/outdoor.jpg',
          ...BUILD_ASSETS,
        ]),
      ),
  )
  self.skipWaiting()
})
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches
        .keys()
        .then((names) =>
          Promise.all(
            names
              .filter((name) => name !== CACHE && /^(do-|pulse-horizon-)/.test(name))
              .map((name) => caches.delete(name)),
          ),
        ),
    ]),
  )
})
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return
  if (
    url.pathname !== '/' &&
    !/^\/(assets|images)\//.test(url.pathname) &&
    url.pathname !== '/favicon.svg'
  )
    return
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      // Hashed bundles and bundled photos should be available immediately,
      // even when a connection stalls instead of rejecting fetch promptly.
      const cached = await cache.match(event.request)
      if (url.pathname !== '/' && cached) return cached
      try {
        const response = await fetch(event.request)
        if (response.ok) {
          const clone = response.clone()
          void cache.put(event.request, clone)
        }
        return response.ok ? response : cached || response
      } catch {
        return (
          cached ||
          (event.request.mode === 'navigate' ? await cache.match('/') : undefined) ||
          Response.error()
        )
      }
    }),
  )
})
