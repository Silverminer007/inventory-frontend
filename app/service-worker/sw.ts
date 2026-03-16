/// <reference lib="webworker" />
import { cleanupOutdatedCaches, precacheAndRoute } from 'workbox-precaching'
import { clientsClaim } from 'workbox-core'
import { registerRoute } from 'workbox-routing'
import { CacheFirst, NetworkFirst } from 'workbox-strategies'
import Dexie from 'dexie'

declare const self: ServiceWorkerGlobalScope

// ── Workbox setup ──────────────────────────────────────────────────
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)
self.skipWaiting()
clientsClaim()

// Serve cached images immediately (uploaded images are immutable)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({ cacheName: 'image-cache' })
)

// Cache API GET requests with network-first strategy
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({ cacheName: 'api-cache', networkTimeoutSeconds: 10 })
)

// ── Dexie setup (mirrors app/utils/db.ts schema) ──────────────────
const db = new Dexie('inventory-db')
db.version(1).stores({
  items: '++id, name, containerId, *tags',
  containers: '++id, name, containerType, parentContainerId',
  syncQueue: '++id, entityType, entityId, operation, timestamp, status'
})

interface SyncQueueEntry {
  id?: number
  entityType: 'item' | 'container'
  entityId: number | string
  operation: 'create' | 'update' | 'delete' | 'move'
  payload: {
    path: string
    method: string
    body?: Record<string, unknown>
  }
  timestamp: Date
  status: 'pending' | 'syncing' | 'failed'
  retryCount: number
}

// ── Sync processor ─────────────────────────────────────────────────

async function processSyncEntry(entry: SyncQueueEntry): Promise<boolean> {
  const { path, method, body } = entry.payload

  try {
    await db.table('syncQueue').update(entry.id!, { status: 'syncing' })

    const response = await fetch(path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    // For create/update: replace optimistic cache entry with server response
    if (method === 'POST' || method === 'PUT') {
      const result = await response.json()
      const table = entry.entityType === 'item' ? 'items' : 'containers'

      await db.table(table).put(result)

      // Clean up temp entry if this was a create
      if (typeof entry.entityId === 'string' && entry.entityId.startsWith('temp-')) {
        const tempEntries = await db.table(table)
          .filter((row: Record<string, unknown>) => row._tempId === entry.entityId)
          .toArray()
        for (const temp of tempEntries) {
          if (temp.id !== result.id) {
            await db.table(table).delete(temp.id)
          }
        }
      }
    }

    // Success – remove from queue
    await db.table('syncQueue').delete(entry.id!)
    await notifyClients({ type: 'SYNC_ENTRY_SUCCESS', entityType: entry.entityType, entityId: entry.entityId, operation: entry.operation })
    return true
  } catch (error) {
    const newRetryCount = (entry.retryCount || 0) + 1
    await db.table('syncQueue').update(entry.id!, {
      status: newRetryCount >= 5 ? 'failed' : 'pending',
      retryCount: newRetryCount
    })
    await notifyClients({
      type: 'SYNC_ENTRY_FAILED',
      entityType: entry.entityType,
      entityId: entry.entityId,
      error: error instanceof Error ? error.message : 'Unknown error',
      retryCount: newRetryCount
    })
    return false
  }
}

async function processSyncQueue(): Promise<void> {
  const pending = await db.table('syncQueue')
    .where('status').equals('pending')
    .sortBy('timestamp') as SyncQueueEntry[]

  if (pending.length === 0) return
  console.log(`[SW] Processing ${pending.length} pending sync entries`)

  for (const entry of pending) {
    await processSyncEntry(entry)
  }

  const remaining = await db.table('syncQueue').count()
  await notifyClients({ type: 'SYNC_COMPLETE', remainingCount: remaining })
}

// ── Client notification helper ─────────────────────────────────────

async function notifyClients(message: Record<string, unknown>): Promise<void> {
  const clients = await self.clients.matchAll({ type: 'window' })
  for (const client of clients) {
    client.postMessage(message)
  }
}

// ── Event listeners ────────────────────────────────────────────────

// Background Sync API – fires when connectivity is restored, even if app is closed
self.addEventListener('sync', (event) => {
  if ((event as any).tag === 'inventory-sync') {
    (event as ExtendableEvent).waitUntil(processSyncQueue())
  }
})

// Periodic Background Sync – fires periodically in the background
self.addEventListener('periodicsync' as any, (event: any) => {
  if (event.tag === 'inventory-periodic-sync') {
    event.waitUntil(processSyncQueue())
  }
})

// Manual trigger from app via postMessage
self.addEventListener('message', (event) => {
  if (event.data?.type === 'TRIGGER_SYNC') {
    event.waitUntil(processSyncQueue())
  }
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})
