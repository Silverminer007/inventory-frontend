import { ref } from 'vue'
import { useDatabase } from '~/composables/useDatabase'
import { useSync } from '~/composables/useSync'

export function useCacheManager() {
  const { db } = useDatabase()
  const sync = useSync()

  const isClearing = ref(false)
  const clearError = ref<string | null>(null)

  async function clearAndResync(): Promise<void> {
    isClearing.value = true
    clearError.value = null
    try {
      // Clear all Dexie tables
      await Promise.all([
        db.containers.clear(),
        db.items.clear(),
        db.images.clear(),
        db.commandQueue.clear(),
        db.syncMeta.clear()
      ])

      // Clear all service worker caches
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }

      // Full re-sync from server
      await sync.initialSync()
    } catch (e) {
      clearError.value = e instanceof Error ? e.message : 'Fehler beim Zurücksetzen'
      throw e
    } finally {
      isClearing.value = false
    }
  }

  return { clearAndResync, isClearing, clearError }
}
