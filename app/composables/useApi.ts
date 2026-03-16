import { toRaw } from 'vue'
import { db } from '~/utils/db'
import type { ItemDTO, ContainerDTO } from '~/types'
import type { SyncQueueEntry } from '~/types/offline'

type EntityType = 'item' | 'container'
type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE'

interface ParsedPath {
  entityType: EntityType | null
  entityId: number | null
  subPath: string | null
}

function parsePath(path: string): ParsedPath {
  const itemMatch = path.match(/^\/api\/v1\/items(?:\/(\d+))?(?:\/(.+))?$/)
  if (itemMatch) {
    return {
      entityType: 'item',
      entityId: itemMatch[1] ? parseInt(itemMatch[1]) : null,
      subPath: itemMatch[2] || null
    }
  }

  const containerMatch = path.match(/^\/api\/v1\/containers(?:\/(\d+))?(?:\/(.+))?$/)
  if (containerMatch) {
    return {
      entityType: 'container',
      entityId: containerMatch[1] ? parseInt(containerMatch[1]) : null,
      subPath: containerMatch[2] || null
    }
  }

  return { entityType: null, entityId: null, subPath: null }
}

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

async function requestBackgroundSync(): Promise<void> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return

  try {
    const registration = await navigator.serviceWorker.ready
    // Use Background Sync API if available
    if ('sync' in registration) {
      await (registration as any).sync.register('inventory-sync')
      return
    }
  } catch {
    // Background Sync not supported – fall through to manual trigger
  }

  // Fallback: tell the SW to sync now via postMessage
  const registration = await navigator.serviceWorker.ready
  registration.active?.postMessage({ type: 'TRIGGER_SYNC' })
}

export function useApi() {
  async function cacheItems(items: ItemDTO[]): Promise<void> {
    await db.items.bulkPut(items)
  }

  async function cacheItem(item: ItemDTO): Promise<void> {
    if (item.id) {
      await db.items.put(item)
    }
  }

  async function cacheContainers(containers: ContainerDTO[]): Promise<void> {
    await db.containers.bulkPut(containers)
  }

  async function cacheContainer(container: ContainerDTO): Promise<void> {
    if (container.id) {
      await db.containers.put(container)
    }
  }

  async function getOfflineItems(subPath: string | null): Promise<ItemDTO[]> {
    if (subPath === 'tags') {
      const items = await db.items.toArray()
      const tags = new Set<string>()
      items.forEach(item => item.tags?.forEach(t => tags.add(t)))
      return Array.from(tags).sort() as any
    }
    if (subPath === 'search' || subPath?.startsWith('by-tag')) {
      // For search/tag queries offline, return all items (client can filter)
      return await db.items.toArray()
    }
    return await db.items.toArray()
  }

  async function getOfflineItem(id: number): Promise<ItemDTO | undefined> {
    return await db.items.get(id)
  }

  async function getOfflineContainers(subPath: string | null): Promise<ContainerDTO[]> {
    if (subPath === 'roots') {
      return await db.containers
        .filter(c => c.parentContainerId === null || c.parentContainerId === undefined)
        .toArray()
    }
    return await db.containers.toArray()
  }

  async function getOfflineContainer(id: number): Promise<ContainerDTO | undefined> {
    return await db.containers.get(id)
  }

  async function getOfflineContainerChildren(id: number): Promise<ContainerDTO[]> {
    return await db.containers.where('parentContainerId').equals(id).toArray()
  }

  async function addToSyncQueue(
    entityType: EntityType,
    entityId: number | string,
    operation: SyncQueueEntry['operation'],
    payload: Record<string, any>
  ): Promise<void> {
    await db.syncQueue.add({
      entityType,
      entityId,
      operation,
      payload,
      timestamp: new Date(),
      status: 'pending',
      retryCount: 0
    })
  }

  async function handleOfflineRead<T>(parsed: ParsedPath): Promise<T | null> {
    if (parsed.entityType === 'item') {
      if (parsed.entityId !== null) {
        if (parsed.subPath === null) {
          return await getOfflineItem(parsed.entityId) as T
        }
      } else {
        return await getOfflineItems(parsed.subPath) as T
      }
    }

    if (parsed.entityType === 'container') {
      if (parsed.entityId !== null) {
        if (parsed.subPath === 'children') {
          return await getOfflineContainerChildren(parsed.entityId) as T
        } else if (parsed.subPath === null) {
          return await getOfflineContainer(parsed.entityId) as T
        }
      } else {
        return await getOfflineContainers(parsed.subPath) as T
      }
    }

    return null
  }

  async function cacheResponse<T>(parsed: ParsedPath, data: T, _subPath: string | null): Promise<void> {
    if (parsed.entityType === 'item') {
      if (parsed.subPath === 'tags') return
      if (Array.isArray(data)) {
        await cacheItems(data as unknown as ItemDTO[])
      } else if (data && typeof data === 'object') {
        await cacheItem(data as unknown as ItemDTO)
      }
    }

    if (parsed.entityType === 'container') {
      if (Array.isArray(data)) {
        await cacheContainers(data as unknown as ContainerDTO[])
      } else if (data && typeof data === 'object') {
        await cacheContainer(data as unknown as ContainerDTO)
      }
    }
  }

  async function apiFetch<T>(path: string, options: Record<string, any> = {}): Promise<T> {
    const method = (options.method?.toUpperCase() || 'GET') as HttpMethod
    const parsed = parsePath(path)

    // During SSR, just do a plain fetch — no IndexedDB available
    if (import.meta.server) {
      return await $fetch<T>(path, { ...options })
    }

    // GET requests: online-first with offline fallback
    if (method === 'GET') {
      if (isOnline()) {
        try {
          const result = await $fetch<T>(path, { ...options })

          // Cache successful GET responses
          if (parsed.entityType) {
            await cacheResponse(parsed, result, parsed.subPath)
          }

          return result
        } catch (error) {
          // If network error, fall through to offline handling
          if (error instanceof Error && error.message.includes('fetch')) {
            console.warn('Network error, falling back to offline data')
          } else {
            throw error
          }
        }
      }

      // Offline fallback for GET
      const offlineData = await handleOfflineRead<T>(parsed)
      if (offlineData !== null) {
        return offlineData
      }
      throw new Error('No offline data available')
    }

    // Unwrap Vue reactive proxies so IndexedDB can structuredClone them
    if (options.body) {
      options = { ...options, body: toRaw(options.body) }
    }

    // Mutations: try direct API call when online, fall back to sync queue when offline
    if (parsed.entityType && (method === 'POST' || method === 'PUT' || method === 'DELETE')) {
      if (isOnline()) {
        try {
          const result = await $fetch<T>(path, { ...options })

          // Cache the server response
          if (parsed.entityType && result && (method === 'POST' || method === 'PUT')) {
            await cacheResponse(parsed, result, parsed.subPath)
          }
          if (method === 'DELETE' && parsed.entityId) {
            if (parsed.entityType === 'item') {
              await db.items.delete(parsed.entityId)
            } else {
              await db.containers.delete(parsed.entityId)
            }
          }

          return result
        } catch (error) {
          // Network error – fall through to offline/sync queue path
          if (!(error instanceof Error && error.message.includes('fetch'))) {
            throw error
          }
          console.warn('Network error on mutation, queueing for sync')
        }
      }

      // Offline or network failure: queue for background sync
      const operation = method === 'POST'
        ? (parsed.subPath === 'move' ? 'move' : 'create')
        : method === 'PUT'
          ? 'update'
          : 'delete'

      const tempId = `temp-${Date.now()}`
      const entityId = parsed.entityId || tempId

      await addToSyncQueue(parsed.entityType, entityId, operation, {
        path,
        method,
        body: options.body
      })
      requestBackgroundSync()

      // Update local cache optimistically
      if (method === 'POST' || method === 'PUT') {
        if (options.body) {
          const entity = {
            ...options.body,
            id: parsed.entityId || undefined,
            _tempId: parsed.entityId ? undefined : tempId,
            _pendingSync: true
          }

          if (parsed.entityType === 'item') {
            if (entity.id) {
              await db.items.put(entity)
            } else {
              const newId = await db.items.add(entity)
              return { ...entity, id: newId } as T
            }
          } else {
            if (entity.id) {
              await db.containers.put(entity)
            } else {
              const newId = await db.containers.add(entity)
              return { ...entity, id: newId } as T
            }
          }
        }
      }

      if (method === 'DELETE' && parsed.entityId) {
        if (parsed.entityType === 'item') {
          await db.items.delete(parsed.entityId)
        } else {
          await db.containers.delete(parsed.entityId)
        }
      }

      if (options.body) {
        return { ...options.body, id: parsed.entityId } as T
      }
      return undefined as T
    }

    throw new Error('Cannot complete request')
  }

  return { apiFetch, isOnline }
}
