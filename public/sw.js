// ─── Inventory PWA Service Worker ─────────────────────────────────────────────
//
//  Architecture:
//  ┌─────────────────────────────────────────────────────┐
//  │  INSTALL: pre-cache app shell                       │
//  │  ACTIVATE: clean old caches, claim clients          │
//  │  FETCH:                                             │
//  │    /api/*  → Network-first (cache fallback)         │
//  │    assets  → Cache-first (network fallback)         │
//  │  BACKGROUND SYNC: 'inventory-sync' tag              │
//  │  MESSAGE: { type: 'FORCE_SYNC' }                    │
//  └─────────────────────────────────────────────────────┘

const CACHE_VERSION = 'v1'
const APP_SHELL_CACHE = `app-shell-${CACHE_VERSION}`
const API_CACHE = `api-data-${CACHE_VERSION}`

const APP_SHELL_URLS = [
  '/',
  '/manifest.webmanifest'
]

// ─── Install ──────────────────────────────────────────────────────────────────

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(APP_SHELL_CACHE)
      try {
        await cache.addAll(APP_SHELL_URLS)
      } catch {
        // Ignore cache failures on install
      }
      await self.skipWaiting()
    })()
  )
})

// ─── Activate ─────────────────────────────────────────────────────────────────

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Delete old caches
      const cacheNames = await caches.keys()
      await Promise.all(
        cacheNames
          .filter(name => name !== APP_SHELL_CACHE && name !== API_CACHE)
          .map(name => caches.delete(name))
      )
      await self.clients.claim()
    })()
  )
})

// ─── Fetch ────────────────────────────────────────────────────────────────────

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url)

  // Let the browser handle cross-origin requests natively (e.g. icon CDNs)
  if (url.origin !== self.location.origin) return

  // API requests: Network-first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(event.request, API_CACHE))
    return
  }

  // Navigation requests: Network-first, fallback to cached index
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(async () => {
        const cache = await caches.open(APP_SHELL_CACHE)
        return cache.match('/') || new Response('Offline', { status: 503 })
      })
    )
    return
  }

  // Static assets (_nuxt/*): Cache-first
  if (url.pathname.startsWith('/_nuxt/') || isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstWithNetwork(event.request, APP_SHELL_CACHE))
    return
  }

  // Default: network
  event.respondWith(fetch(event.request))
})

async function networkFirstWithCache(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const networkResponse = await fetch(request.clone())
    if (networkResponse.ok && request.method === 'GET') {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    const cached = await cache.match(request)
    return cached || new Response(JSON.stringify({ error: 'Offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function cacheFirstWithNetwork(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)
  if (cached) return cached

  try {
    const networkResponse = await fetch(request)
    if (networkResponse.ok) {
      cache.put(request, networkResponse.clone())
    }
    return networkResponse
  } catch {
    return new Response('Asset unavailable offline', { status: 503 })
  }
}

function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|webp)$/.test(pathname)
}

// ─── Background Sync ──────────────────────────────────────────────────────────

self.addEventListener('sync', (event) => {
  if (event.tag === 'inventory-sync') {
    event.waitUntil(triggerSyncInClients())
  }
})

// ─── Push Notifications ───────────────────────────────────────────────────────

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'Lager', {
      body: data.body ?? '',
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      data: data.url ? { url: data.url } : undefined
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then(clients => {
      const existing = clients.find(c => c.url === url && 'focus' in c)
      if (existing) return existing.focus()
      return self.clients.openWindow(url)
    })
  )
})

// ─── Message Handler ─────────────────────────────────────────────────────────

self.addEventListener('message', (event) => {
  if (event.data?.type === 'FORCE_SYNC') {
    event.waitUntil(triggerSyncInClients())
  }
})

async function triggerSyncInClients() {
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage({ type: 'TRIGGER_DELTA_SYNC' })
  }
}
