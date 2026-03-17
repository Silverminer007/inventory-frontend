import { ref, computed } from 'vue'
import type { Ref } from 'vue'
import type { UUID } from '~/utils/uuid'
import type {
  Container,
  Item,
  Image,
  AppliedCommandDTO,
  CommandResultDTO
} from '~/types/inventory'
import { useDatabase } from '~/composables/useDatabase'

// ─── Module-level reactive state (shared across all composable instances) ──────

const isSyncing: Ref<boolean> = ref(false)
const isFlushing: Ref<boolean> = ref(false)
const syncProgress: Ref<{ current: number; total: number } | null> = ref(null)
const lastSyncAt: Ref<Date | null> = ref(null)
const pendingCommandCount: Ref<number> = ref(0)

export function useSync() {
  const db = useDatabase()
  const config = useRuntimeConfig()
  const apiBase = config.public.apiBase as string

  // ─── Helpers ───────────────────────────────────────────────────────────────

  async function refreshPendingCount(): Promise<void> {
    pendingCommandCount.value = await db.getCommandQueueCount('PENDING')
  }

  async function applyCommandToDb(cmd: AppliedCommandDTO): Promise<void> {
    const { commandType, entityId, payload } = cmd

    switch (commandType) {
      case 'CONTAINER_CREATE':
      case 'CONTAINER_UPDATE': {
        const container = payload as unknown as Container
        if (container.id) {
          await db.upsertContainer(container)
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
            const parentContainerId = payload.parentContainerId as UUID | null
            await db.upsertContainer({ ...existing, parentContainerId })
          }
        }
        break
      }
      case 'ITEM_CREATE':
      case 'ITEM_UPDATE': {
        const item = payload as unknown as Item
        if (item.id) {
          await db.upsertItem(item)
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
            const containerId = payload.containerId as UUID | null
            await db.upsertItem({ ...existing, containerId })
          }
        }
        break
      }
      case 'IMAGE_UPLOAD': {
        const image = payload as unknown as Image
        if (image.id) {
          await db.upsertImage(image)
        }
        break
      }
      case 'IMAGE_DELETE': {
        if (entityId) await db.deleteImage(entityId)
        break
      }
      case 'IMAGE_SET_PRIMARY': {
        // Update isPrimary flag — would need to unset others
        break
      }
    }
  }

  async function uploadPendingImages(entityType: 'item' | 'container', entityId: UUID): Promise<void> {
    const pending = await db.getPendingImagesForEntity(entityType, entityId)
    if (pending.length === 0) return

    for (const img of pending) {
      try {
        const form = new FormData()
        form.append('file', img.blob, img.filename)
        form.append('isPrimary', String(img.isPrimary))
        const res = await fetch(`${apiBase}/api/v1/${entityType}s/${entityId}/images`, {
          method: 'POST',
          body: form
        })
        if (res.ok && img.id !== undefined) {
          await db.deletePendingImage(img.id)
        }
      } catch { /* will retry on next gallery open */ }
    }
  }

  async function applyResultToDb(result: CommandResultDTO): Promise<void> {
    if (result.status !== 'APPLIED' || !result.snapshot) return

    const { entityType, snapshot, entityId } = result

    if (entityType === 'CONTAINER') {
      await db.upsertContainer(snapshot as Container)
      // Upload any pending images queued for this entity
      if (entityId) await uploadPendingImages('container', entityId)
    } else if (entityType === 'ITEM') {
      await db.upsertItem(snapshot as Item)
      if (entityId) await uploadPendingImages('item', entityId)
    } else if (entityType === 'IMAGE') {
      await db.upsertImage(snapshot as Image)
    }
  }

  // ─── initialSync ───────────────────────────────────────────────────────────

  async function initialSync(): Promise<void> {
    if (isSyncing.value) return
    isSyncing.value = true
    syncProgress.value = { current: 0, total: 2 }

    try {
      const [containersRes, itemsRes] = await Promise.all([
        fetch(`${apiBase}/api/v1/containers`),
        fetch(`${apiBase}/api/v1/items`)
      ])

      if (!containersRes.ok || !itemsRes.ok) {
        throw new Error('Initial sync failed: API error')
      }

      const containers: Container[] = await containersRes.json()
      syncProgress.value = { current: 1, total: 2 }

      const items: Item[] = await itemsRes.json()
      syncProgress.value = { current: 2, total: 2 }

      await db.upsertContainers(containers)
      await db.upsertItems(items)

      const now = new Date()
      await db.setSyncMeta('lastSyncAt', now.toISOString())
      lastSyncAt.value = now

      // Determine highest server sequence
      const allCommands = await fetchCommandsSince('2000-01-01T00:00:00Z')
      if (allCommands.length > 0) {
        const maxSeq = Math.max(...allCommands.map(c => c.serverSequence))
        await db.setSyncMeta('lastServerSequence', String(maxSeq))
      }
    } finally {
      isSyncing.value = false
      syncProgress.value = null
    }
  }

  // ─── deltaSync ─────────────────────────────────────────────────────────────

  async function fetchCommandsSince(since: string): Promise<AppliedCommandDTO[]> {
    const res = await fetch(`${apiBase}/commands?since=${encodeURIComponent(since)}`)
    if (!res.ok) throw new Error(`GET /commands failed: ${res.status}`)
    return res.json()
  }

  async function deltaSync(): Promise<void> {
    if (isSyncing.value) return
    isSyncing.value = true
    syncProgress.value = null

    try {
      const lastSyncAtStr = await db.getSyncMeta('lastSyncAt')
      const since = lastSyncAtStr ?? '2000-01-01T00:00:00Z'

      const commands = await fetchCommandsSince(since)

      syncProgress.value = { current: 0, total: commands.length }
      let processed = 0

      for (const cmd of commands) {
        await applyCommandToDb(cmd)
        processed++
        syncProgress.value = { current: processed, total: commands.length }
      }

      const now = new Date()
      await db.setSyncMeta('lastSyncAt', now.toISOString())
      lastSyncAt.value = now

      if (commands.length > 0) {
        const maxSeq = Math.max(...commands.map(c => c.serverSequence ?? 0))
        await db.setSyncMeta('lastServerSequence', String(maxSeq))
      }
    } finally {
      isSyncing.value = false
      syncProgress.value = null
    }
  }

  // ─── flushQueue ────────────────────────────────────────────────────────────

  const BATCH_SIZE = 50

  async function flushQueue(): Promise<void> {
    if (isFlushing.value) return
    isFlushing.value = true

    try {
      const pending = await db.getPendingCommands()
      if (pending.length === 0) return

      // Mark all as SENT before sending
      for (const cmd of pending) {
        await db.updateCommandStatus(cmd.commandId, 'SENT')
      }

      // Process in batches
      for (let i = 0; i < pending.length; i += BATCH_SIZE) {
        const batch = pending.slice(i, i + BATCH_SIZE)
        const payload = batch.map(entry => ({
          commandId: entry.commandId,
          commandType: entry.commandType,
          payloadVersion: 1 as const,
          payload: entry.payload,
          entityId: entry.entityId ?? undefined,
          issuedAt: entry.createdAt
        }))

        let results: CommandResultDTO[]

        try {
          const res = await fetch(`${apiBase}/commands`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })

          if (!res.ok) {
            for (const cmd of batch) {
              await db.updateCommandStatus(cmd.commandId, 'FAILED', {
                error: `HTTP ${res.status}`
              })
            }
            continue
          }

          results = await res.json()
        } catch {
          // Network error — revert to PENDING so retry is possible
          for (const cmd of batch) {
            await db.updateCommandStatus(cmd.commandId, 'PENDING')
          }
          continue
        }

        // Map results back by commandId
        const resultMap = new Map(results.map(r => [r.commandId, r]))

        for (const cmd of batch) {
          const result = resultMap.get(cmd.commandId)
          if (!result) continue

          if (result.status === 'APPLIED') {
            const serverId = result.entityId ?? cmd.entityId
            await db.updateCommandStatus(cmd.commandId, 'APPLIED', {
              entityId: serverId
            })
            // Sync the server snapshot; if server assigned a different ID than the
            // client-generated one, remove the stale optimistic entity to prevent duplicates
            await applyResultToDb(result)
            if (serverId && cmd.entityId && serverId !== cmd.entityId) {
              if (cmd.commandType === 'CONTAINER_CREATE') {
                await db.deleteContainer(cmd.entityId)
              } else if (cmd.commandType === 'ITEM_CREATE') {
                await db.deleteItem(cmd.entityId)
              }
            }
          } else if (result.status === 'CONFLICT') {
            await db.updateCommandStatus(cmd.commandId, 'CONFLICT', {
              conflictInfo: result.conflictInfo ?? undefined,
              error: result.error ?? undefined
            })
          } else {
            await db.updateCommandStatus(cmd.commandId, 'FAILED', {
              error: result.error ?? undefined
            })
            // Roll back failed CREATE — server rejected our UUID
            if (cmd.commandType === 'ITEM_CREATE' && cmd.entityId) {
              await db.deleteItem(cmd.entityId)
            }
            if (cmd.commandType === 'CONTAINER_CREATE' && cmd.entityId) {
              await db.deleteContainer(cmd.entityId)
            }
          }
        }
      }

      await refreshPendingCount()
    } finally {
      isFlushing.value = false
    }
  }

  // ─── Bootstrap ─────────────────────────────────────────────────────────────

  async function bootstrap(): Promise<void> {
    const stored = await db.getSyncMeta('lastSyncAt')
    if (stored) {
      lastSyncAt.value = new Date(stored)
    }

    await refreshPendingCount()

    const empty = await db.isDbEmpty()
    if (empty) {
      await initialSync()
    } else {
      await deltaSync()
    }
  }

  return {
    isSyncing,
    syncProgress,
    lastSyncAt,
    pendingCommandCount: computed(() => pendingCommandCount.value),
    initialSync,
    deltaSync,
    flushQueue,
    bootstrap,
    refreshPendingCount
  }
}
