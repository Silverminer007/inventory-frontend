<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useSync } from '~/composables/useSync'
  import { useDatabase } from '~/composables/useDatabase'

  const sync = useSync()
  const db = useDatabase()
  const showSheet = ref(false)
  const isOnline = ref(true)
  const recentCommands = ref<Awaited<ReturnType<typeof db.getRecentCommands>>>([])

  onMounted(async () => {
    isOnline.value = navigator.onLine
    window.addEventListener('online', () => {
      isOnline.value = true
    })
    window.addEventListener('offline', () => {
      isOnline.value = false
    })
    recentCommands.value = await db.getRecentCommands(5)
  })

  async function openSheet() {
    showSheet.value = true
    recentCommands.value = await db.getRecentCommands(5)
  }

  async function forceSync() {
    await sync.deltaSync()
    await sync.flushQueue()
    recentCommands.value = await db.getRecentCommands(5)
  }

  const dotStyle = computed(() => {
    if (sync.isSyncing.value)
      return 'background: var(--color-warning); animation: pulse-dot 1.2s infinite'
    if (!isOnline.value) return 'background: var(--color-text-muted)'
    return 'background: var(--color-success)'
  })

  const lastSyncLabel = computed(() => {
    const d = sync.lastSyncAt.value
    if (!d) return 'Noch kein Sync'
    const diff = Date.now() - d.getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Gerade eben'
    if (mins < 60) return `vor ${mins} Minute${mins === 1 ? '' : 'n'}`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `vor ${hours} Stunde${hours === 1 ? '' : 'n'}`
    return d.toLocaleDateString('de-DE')
  })

  const statusLabelMap: Record<string, string> = {
    PENDING: 'Ausstehend',
    SENT: 'Gesendet',
    APPLIED: 'Angewendet',
    FAILED: 'Fehlgeschlagen',
    CONFLICT: 'Konflikt',
  }
  type BadgeVariant = 'amber' | 'blue' | 'green' | 'red' | 'default'
  const statusVariantMap: Record<string, BadgeVariant> = {
    PENDING: 'amber',
    SENT: 'blue',
    APPLIED: 'green',
    FAILED: 'red',
    CONFLICT: 'red',
  }
  function statusVariant(status: string): BadgeVariant {
    return statusVariantMap[status] ?? 'default'
  }
</script>

<template>
  <!-- ─── Status Dot + Badge ──────────────────────────────────────────────────── -->
  <button
    class="relative flex items-center gap-1.5 p-2 rounded-lg"
    style="color: var(--color-text-secondary)"
    aria-label="Sync-Status"
    data-testid="sync-status"
    :data-status="sync.isSyncing.value ? 'syncing' : isOnline ? 'online' : 'offline'"
    @click="openSheet"
  >
    <span class="w-2.5 h-2.5 rounded-full" :style="dotStyle" />
    <span
      v-if="sync.pendingCommandCount.value > 0"
      class="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] rounded-full text-[10px] font-bold flex items-center justify-center text-white"
      style="background: var(--color-accent)"
    >
      {{ sync.pendingCommandCount.value > 99 ? '99+' : sync.pendingCommandCount.value }}
    </span>
  </button>

  <!-- ─── Sync Detail Sheet ─────────────────────────────────────────────────── -->
  <BottomSheet v-if="showSheet" title="Synchronisation" @close="showSheet = false">
    <div class="space-y-4">
      <!-- Status Row -->
      <div
        class="flex items-center gap-3 p-3 rounded-xl"
        style="background: var(--color-surface-2)"
      >
        <span class="w-3 h-3 rounded-full" :style="dotStyle" />
        <div class="flex-1">
          <p class="text-sm font-medium" style="color: var(--color-text-primary)">
            {{ isOnline ? 'Online' : 'Offline' }}
          </p>
          <p class="text-xs" style="color: var(--color-text-muted)">
            Letzter Sync: {{ lastSyncLabel }}
          </p>
        </div>
        <Badge v-if="sync.pendingCommandCount.value > 0" variant="amber">
          {{ sync.pendingCommandCount.value }} ausstehend
        </Badge>
      </div>

      <!-- Progress Bar (while syncing) -->
      <div v-if="sync.isSyncing.value" class="space-y-1.5">
        <div class="flex justify-between text-xs" style="color: var(--color-text-muted)">
          <span>Synchronisiere…</span>
          <span v-if="sync.syncProgress.value">
            {{ sync.syncProgress.value.current }}/{{ sync.syncProgress.value.total }}
          </span>
        </div>
        <div class="h-1.5 rounded-full overflow-hidden" style="background: var(--color-surface-2)">
          <div
            class="h-full rounded-full transition-all duration-300"
            style="background: var(--color-accent)"
            :style="{
              width: sync.syncProgress.value
                ? `${(sync.syncProgress.value.current / sync.syncProgress.value.total) * 100}%`
                : '100%',
              animation: !sync.syncProgress.value ? 'pulse-dot 1.5s infinite' : 'none',
            }"
          />
        </div>
      </div>

      <!-- Sync Button -->
      <button
        class="btn btn-secondary w-full"
        :disabled="sync.isSyncing.value || !isOnline"
        @click="forceSync"
      >
        <LoadingSpinner v-if="sync.isSyncing.value" size="sm" />
        <Icon v-else icon="mdi:sync" class="w-4 h-4" />
        Jetzt synchronisieren
      </button>

      <!-- Recent Commands -->
      <div v-if="recentCommands.length > 0">
        <h4
          class="text-xs font-semibold uppercase tracking-wide mb-2"
          style="color: var(--color-text-muted)"
        >
          Letzte Aktionen
        </h4>
        <div class="space-y-2">
          <div
            v-for="cmd in recentCommands"
            :key="cmd.commandId"
            class="flex items-center gap-3 py-2"
            style="border-bottom: 1px solid var(--color-border)"
          >
            <div class="flex-1 min-w-0">
              <p class="text-sm truncate" style="color: var(--color-text-primary)">
                {{ cmd.commandType.replace(/_/g, ' ') }}
              </p>
              <p class="text-xs" style="color: var(--color-text-muted)">
                {{
                  new Date(cmd.createdAt).toLocaleTimeString('de-DE', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                }}
              </p>
            </div>
            <Badge :variant="statusVariant(cmd.status)">
              {{ statusLabelMap[cmd.status] ?? cmd.status }}
            </Badge>
          </div>
        </div>
      </div>
    </div>
  </BottomSheet>
</template>
