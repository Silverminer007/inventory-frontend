<script setup lang="ts">
const { isOnline, isSyncing, totalUnsynced, syncingCount, lastSyncAt, showIndicator } = useSync()

function formatLastSync(date: Date): string {
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  if (isToday) return `${hh}:${mm}`
  const dd = String(date.getDate()).padStart(2, '0')
  const mo = String(date.getMonth() + 1).padStart(2, '0')
  return `${dd}.${mo} ${hh}:${mm}`
}
</script>

<template>
  <ClientOnly>
    <div
      v-if="showIndicator"
      class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium"
      :class="isOnline ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'"
    >
      <!-- Offline states -->
      <template v-if="!isOnline">
        <UIcon name="i-lucide-wifi-off" class="shrink-0" />
        <span v-if="totalUnsynced > 0">Offline ({{ totalUnsynced }} changes unsynced)</span>
        <span v-else>Offline</span>
        <span v-if="lastSyncAt" class="ml-auto text-xs opacity-70">{{ formatLastSync(lastSyncAt) }}</span>
      </template>

      <!-- Online + syncing / pending -->
      <template v-else>
        <UIcon name="i-lucide-loader-circle" class="shrink-0 animate-spin" />
        <span v-if="syncingCount > 0">Syncing {{ syncingCount }}…</span>
        <span v-else>Uploading changes ({{ totalUnsynced }} pending)</span>
      </template>
    </div>
  </ClientOnly>
</template>
