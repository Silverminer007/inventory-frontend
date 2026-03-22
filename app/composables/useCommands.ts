import { generateId, type UUID } from '~/utils/uuid'
import type {
  CommandType,
  CommandQueueEntry,
  Container,
  Item,
  Image,
  LocalItem,
} from '~/types/inventory'
import { useDatabase } from '~/composables/useDatabase'
import { useSync } from '~/composables/useSync'

export function useCommands() {
  const db = useDatabase()
  const sync = useSync()

  /**
   * Execute a command:
   * 1. Client generates a real UUID for new entities immediately
   * 2. Apply optimistic local update to Dexie
   * 3. Enqueue in commandQueue as PENDING
   * 4. If online, immediately flush queue
   */
  async function executeCommand<T extends Container | Item | Image | null>(
    type: CommandType,
    payload: Record<string, unknown>,
    entityId?: UUID,
  ): Promise<T | null> {
    const commandId = generateId()
    const issuedAt = new Date().toISOString()

    const entry: CommandQueueEntry = {
      commandId,
      commandType: type,
      payload,
      status: 'PENDING',
      createdAt: issuedAt,
      entityId: entityId ?? null,
    }

    // ─── Optimistic local update ─────────────────────────────────────────────
    let result: T | null = null

    switch (type) {
      case 'CONTAINER_CREATE': {
        // Client generates the real UUID — no temp ID needed
        const id: UUID = entityId ?? generateId()
        const container: Container = {
          id,
          name: payload.name as string,
          containerType: payload.containerType as 'ROOM' | 'SHELF' | 'BOX',
          description: payload.description as string | undefined,
          position: payload.position as string | undefined,
          parentContainerId: payload.parentContainerId as UUID | undefined,
          version: 0,
          itemCount: 0,
          totalItemCount: 0,
        }
        await db.upsertContainer(container)
        entry.entityId = id
        entry.payload = container as unknown as Record<string, unknown>
        result = container as unknown as T
        break
      }

      case 'CONTAINER_UPDATE': {
        if (entityId) {
          const existing = await db.getContainer(entityId)
          if (existing) {
            const updated: Container = { ...existing, ...payload, id: entityId }
            await db.upsertContainer(updated)
            result = updated as unknown as T
          }
        }
        break
      }

      case 'CONTAINER_DELETE': {
        if (entityId) await db.deleteContainer(entityId)
        break
      }

      case 'CONTAINER_MOVE': {
        if (entityId) {
          const existing = await db.getContainer(entityId)
          if (existing) {
            const moved: Container = {
              ...existing,
              parentContainerId: payload.parentContainerId as UUID | null,
            }
            await db.upsertContainer(moved)
            result = moved as unknown as T
          }
        }
        break
      }

      case 'ITEM_CREATE': {
        // Client generates the real UUID — no temp ID needed
        const id: UUID = entityId ?? generateId()
        const item: LocalItem = {
          id,
          name: payload.name as string,
          containerId: payload.containerId as UUID | undefined,
          description: payload.description as string | undefined,
          quantity: (payload.quantity as number) ?? 1,
          barcode: payload.barcode as string | undefined,
          tags: payload.tags as string[] | undefined,
          version: 0,
        }
        await db.upsertItem(item)
        entry.entityId = id
        entry.payload = item as unknown as Record<string, unknown>
        result = item as unknown as T
        break
      }

      case 'ITEM_UPDATE': {
        if (entityId) {
          const existing = await db.getItem(entityId)
          if (existing) {
            const updated: LocalItem = { ...existing, ...payload, id: entityId }
            await db.upsertItem(updated)
            result = updated as unknown as T
          }
        }
        break
      }

      case 'ITEM_DELETE': {
        if (entityId) await db.deleteItem(entityId)
        break
      }

      case 'ITEM_MOVE': {
        if (entityId) {
          const existing = await db.getItem(entityId)
          if (existing) {
            const moved: LocalItem = {
              ...existing,
              containerId: payload.containerId as UUID | null,
            }
            await db.upsertItem(moved)
            result = moved as unknown as T
          }
        }
        break
      }

      // Image commands: no optimistic local update (images are fetched from server)
      case 'IMAGE_UPLOAD':
      case 'IMAGE_SET_PRIMARY':
      case 'IMAGE_DELETE':
        break
    }

    // ─── Enqueue ─────────────────────────────────────────────────────────────
    await db.enqueuCommand(entry)
    await sync.refreshPendingCount()

    // ─── Flush if online ──────────────────────────────────────────────────────
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      // Fire-and-forget — don't await so UI stays responsive
      sync.flushQueue().catch(console.error)
    }

    return result
  }

  return { executeCommand }
}
