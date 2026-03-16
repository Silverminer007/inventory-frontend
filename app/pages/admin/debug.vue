<script setup lang="ts">
import type { SyncQueueEntry } from '~/types/offline'

const { getAllSyncEntries, updateSyncEntryStatus, clearSyncQueue } = useOfflineDb()

const entries = ref<SyncQueueEntry[]>([])
const isOnline = ref(true)
let refreshInterval: ReturnType<typeof setInterval> | null = null

async function loadEntries() {
  entries.value = await getAllSyncEntries()
}

async function triggerSync() {
  if (!navigator.serviceWorker) return
  const registration = await navigator.serviceWorker.ready
  registration.active?.postMessage({ type: 'TRIGGER_SYNC' })
}

async function retryFailed() {
  const failed = entries.value.filter(e => e.status === 'failed')
  for (const entry of failed) {
    if (entry.id !== undefined) {
      await updateSyncEntryStatus(entry.id, 'pending')
    }
  }
  await loadEntries()
  await triggerSync()
}

async function handleClearQueue() {
  await clearSyncQueue()
  await loadEntries()
}

function onSwMessage(event: MessageEvent) {
  const type = event.data?.type
  if (type === 'SYNC_ENTRY_SUCCESS' || type === 'SYNC_ENTRY_FAILED' || type === 'SYNC_COMPLETE') {
    loadEntries()
  }
}

function statusColor(status: SyncQueueEntry['status']) {
  if (status === 'pending') return 'warning'
  if (status === 'syncing') return 'primary'
  return 'error'
}

function operationColor(op: SyncQueueEntry['operation']) {
  if (op === 'create') return 'success'
  if (op === 'delete') return 'error'
  if (op === 'move') return 'secondary'
  return 'neutral'
}

function formatTimestamp(ts: Date) {
  return new Date(ts).toLocaleString()
}

if (import.meta.client) {
  onMounted(async () => {
    isOnline.value = navigator.onLine
    window.addEventListener('online', () => { isOnline.value = true })
    window.addEventListener('offline', () => { isOnline.value = false })

    await loadEntries()
    refreshInterval = setInterval(loadEntries, 3000)

    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', onSwMessage)
    }
  })

  onUnmounted(() => {
    if (refreshInterval) clearInterval(refreshInterval)
    if (navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener('message', onSwMessage)
    }
  })
}
</script>

<template>
  <div class="p-4 md:p-6 max-w-4xl mx-auto">
    <!-- Header -->
    <div class="flex flex-wrap items-center gap-3 mb-6">
      <h1 class="text-2xl font-bold flex-1">Sync Debug</h1>
      <UBadge :color="isOnline ? 'success' : 'error'" variant="subtle">
        {{ isOnline ? 'Online' : 'Offline' }}
      </UBadge>
      <UButton icon="i-lucide-refresh-cw" variant="outline" size="sm" @click="loadEntries">
        Refresh
      </UButton>
      <UButton icon="i-lucide-play" size="sm" @click="triggerSync">
        Trigger Sync
      </UButton>
      <UButton icon="i-lucide-rotate-ccw" color="warning" variant="outline" size="sm" @click="retryFailed">
        Retry Failed
      </UButton>
      <UButton icon="i-lucide-trash-2" color="error" variant="outline" size="sm" @click="handleClearQueue">
        Clear Queue
      </UButton>
    </div>

    <!-- Queue -->
    <div v-if="entries.length === 0" class="text-muted text-sm py-12 text-center border border-dashed border-default rounded-lg">
      Sync queue is empty
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="entry in entries"
        :key="entry.id"
        class="border border-default rounded-lg p-4 bg-default space-y-2"
      >
        <div class="flex flex-wrap items-center gap-2">
          <UBadge :color="statusColor(entry.status)" variant="subtle" size="sm">
            {{ entry.status }}
          </UBadge>
          <UBadge :color="operationColor(entry.operation)" variant="outline" size="sm">
            {{ entry.operation }}
          </UBadge>
          <span class="text-sm font-medium">{{ entry.entityType }} #{{ entry.entityId }}</span>
          <span class="text-xs text-muted ml-auto">{{ formatTimestamp(entry.timestamp) }}</span>
        </div>
        <div class="flex items-center gap-4 text-xs text-muted">
          <span>Retries: {{ entry.retryCount }}</span>
          <span v-if="entry.payload?.path">{{ entry.payload.method ?? 'GET' }} {{ entry.payload.path }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
