// ─────────────────────────────────────────────
// TutorKanvas — Service Worker
// Strategy:
//   • App-shell (HTML, JS, CSS, fonts) → cache-first with network fallback
//   • API routes (/api/*)              → network-only (never cache LLM calls)
//   • Canvas page                     → stale-while-revalidate
// ─────────────────────────────────────────────

const CACHE_NAME = 'tutorkanvas-v2'

// Resources to pre-cache on install (app shell)
const PRECACHE_URLS = [
  '/',
  '/canvas',
  '/setup',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
]

// ── Install: pre-cache app shell ──────────────
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(PRECACHE_URLS).catch(() => {
        // Silently ignore pre-cache failures (e.g. offline during install)
      })
    ).then(() => self.skipWaiting())
  )
})

// ── Activate: clean up old caches ─────────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: routing strategy ───────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin GET requests
  if (url.origin !== self.location.origin) return
  if (request.method !== 'GET') return

  // API routes → network only (never cache LLM/voice responses)
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(request).catch(() => Response.error()))
    return
  }

  // Next.js build chunks → network only.
  // These are content-addressed (hashed filenames) so caching them
  // manually offers no benefit.
  if (url.pathname.startsWith('/_next/')) {
    event.respondWith(fetch(request).catch(() => Response.error()))
    return
  }

  // Images, fonts, manifests, and other asset files should bypass the SW.
  // Caching HTML responses under these URLs can lead to browser decode
  // failures and noisy EncodingError / Failed to fetch logs.
  if (request.destination === 'image' || request.destination === 'font' || request.destination === 'manifest') {
    event.respondWith(fetch(request).catch(() => Response.error()))
    return
  }

  // App-shell pages → stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cached = await cache.match(request)
      const networkFetch = fetch(request)
        .then((response) => {
          // Cache fresh successful responses
          if (response.ok) {
            cache.put(request, response.clone())
          }
          return response
        })
        .catch(() => {
          // Network failed — return cache or offline page
          if (cached) return cached
          return caches.match('/offline') ?? Response.error()
        })

      // Return cached immediately, update in background
      return cached ?? networkFetch
    })
  )
})
