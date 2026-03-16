import type { SyncQueueEntry } from '~/types/offline'

// Module-level — shared across all callers
const entries = ref<SyncQueueEntry[]>([])
const isOnline = ref(true)
const lastSyncAt = ref<Date | null>(null)
let initialized = false
let pollTimer: ReturnType<typeof setInterval> | null = null

const pendingCount = computed(() => entries.value.filter(e => e.status === 'pending').length)
const syncingCount = computed(() => entries.value.filter(e => e.status === 'syncing').length)
const failedCount = computed(() => entries.value.filter(e => e.status === 'failed').length)
const isSyncing = computed(() => syncingCount.value > 0)
const totalUnsynced = computed(() => pendingCount.value + syncingCount.value + failedCount.value)
const showIndicator = computed(() => !isOnline.value || isSyncing.value || totalUnsynced.value > 0)

export function useSync() {
  if (import.meta.client && !initialized) {
    initialized = true

    const stored = localStorage.getItem('lastSyncAt')
    if (stored) lastSyncAt.value = new Date(stored)

    isOnline.value = navigator.onLine
    window.addEventListener('online', () => { isOnline.value = true })
    window.addEventListener('offline', () => { isOnline.value = false })

    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        const type = event.data?.type
        if (type === 'SYNC_ENTRY_SUCCESS') {
          lastSyncAt.value = new Date()
          localStorage.setItem('lastSyncAt', lastSyncAt.value.toISOString())
        }
        if (['SYNC_ENTRY_SUCCESS', 'SYNC_ENTRY_FAILED', 'SYNC_COMPLETE'].includes(type)) {
          refresh()
        }
      })
    }

    refresh()
    pollTimer = setInterval(refresh, 5000)
  }

  async function refresh() {
    const { getAllSyncEntries } = useOfflineDb()
    entries.value = await getAllSyncEntries()
  }

  return { isOnline, isSyncing, pendingCount, syncingCount, failedCount, totalUnsynced, lastSyncAt, showIndicator, refresh }
}
