<script setup lang="ts">
  import { ref, onMounted, computed } from 'vue'
  import { useRouter } from 'vue-router'
  import { useDatabase } from '~/composables/useDatabase'
  import { useSync } from '~/composables/useSync'
  import { useCacheManager } from '~/composables/useCacheManager'

  const router = useRouter()
  const { db } = useDatabase()
  const sync = useSync()
  const cache = useCacheManager()
  const config = useRuntimeConfig()

  const stats = ref({ containers: 0, items: 0, images: 0, pending: 0 })
  const isSyncing = ref(false)
  const syncError = ref<string | null>(null)
  const showClearConfirm = ref(false)
  const confirmedDataLoss = ref(false)

  async function loadStats() {
    const [containers, items, images, pending] = await Promise.all([
      db.containers.count(),
      db.items.count(),
      db.images.count(),
      db.commandQueue.where('status').equals('PENDING').count(),
    ])
    stats.value = { containers, items, images, pending }
  }

  async function forceSync() {
    isSyncing.value = true
    syncError.value = null
    try {
      await sync.deltaSync()
      await loadStats()
    } catch (e) {
      syncError.value = e instanceof Error ? e.message : 'Sync fehlgeschlagen'
    } finally {
      isSyncing.value = false
    }
  }

  function openClearConfirm() {
    confirmedDataLoss.value = false
    showClearConfirm.value = true
  }

  async function executeClear() {
    showClearConfirm.value = false
    try {
      await cache.clearAndResync()
      router.replace('/')
    } catch {
      // clearError is set inside useCacheManager
    }
  }

  const canConfirmClear = computed(() => stats.value.pending === 0 || confirmedDataLoss.value)

  function formatLastSync(date: Date | null): string {
    if (!date) return 'Noch nie'
    const diff = Math.floor((Date.now() - date.getTime()) / 1000)
    if (diff < 60) return 'Gerade eben'
    if (diff < 3600) return `vor ${Math.floor(diff / 60)} Min.`
    if (diff < 86400) return `vor ${Math.floor(diff / 3600)} Std.`
    return `vor ${Math.floor(diff / 86400)} Tagen`
  }

  onMounted(loadStats)
</script>

<template>
  <div class="max-w-xl mx-auto px-4 py-6 space-y-6">
    <!-- Back header -->
    <div class="flex items-center gap-3">
      <button class="btn btn-ghost p-2 -ml-2" @click="router.back()">
        <Icon icon="mdi:arrow-left" class="w-5 h-5" />
      </button>
      <h1 class="text-xl font-bold" style="color: var(--color-text-primary)">Einstellungen</h1>
    </div>

    <!-- ─── Sync ──────────────────────────────────────────────────────────── -->
    <section class="card space-y-3">
      <h2
        class="text-sm font-semibold uppercase tracking-wide"
        style="color: var(--color-text-muted)"
      >
        Synchronisation
      </h2>

      <div class="flex items-center justify-between">
        <span class="text-sm" style="color: var(--color-text-secondary)">Letzter Sync</span>
        <span class="text-sm font-medium" style="color: var(--color-text-primary)">
          {{ formatLastSync(sync.lastSyncAt.value) }}
        </span>
      </div>

      <div class="flex items-center justify-between">
        <span class="text-sm" style="color: var(--color-text-secondary)">Ausstehend</span>
        <span class="text-sm font-medium" style="color: var(--color-text-primary)">
          {{ sync.pendingCommandCount.value }} Änderung{{
            sync.pendingCommandCount.value !== 1 ? 'en' : ''
          }}
        </span>
      </div>

      <ErrorBanner v-if="syncError" :message="syncError" @dismiss="syncError = null" />

      <button
        class="btn btn-secondary w-full"
        :disabled="isSyncing || sync.isSyncing.value"
        @click="forceSync"
      >
        <LoadingSpinner v-if="isSyncing || sync.isSyncing.value" size="sm" />
        <Icon v-else icon="mdi:sync" class="w-4 h-4" />
        Jetzt synchronisieren
      </button>
    </section>

    <!-- ─── Cache ─────────────────────────────────────────────────────────── -->
    <section class="card space-y-3">
      <h2
        class="text-sm font-semibold uppercase tracking-wide"
        style="color: var(--color-text-muted)"
      >
        Lokaler Cache
      </h2>

      <div class="space-y-2 text-sm" style="color: var(--color-text-secondary)">
        <div class="flex justify-between">
          <span>Container</span>
          <span
            data-testid="container-count"
            class="font-medium tabular-nums"
            style="color: var(--color-text-primary)"
          >
            {{ stats.containers }}
          </span>
        </div>
        <div class="flex justify-between">
          <span>Items</span>
          <span
            data-testid="item-count"
            class="font-medium tabular-nums"
            style="color: var(--color-text-primary)"
          >
            {{ stats.items }}
          </span>
        </div>
        <div class="flex justify-between">
          <span>Bilder (Metadaten)</span>
          <span
            data-testid="image-count"
            class="font-medium tabular-nums"
            style="color: var(--color-text-primary)"
          >
            {{ stats.images }}
          </span>
        </div>
        <div class="flex justify-between">
          <span>Ausstehende Commands</span>
          <span
            data-testid="pending-count"
            class="font-medium tabular-nums"
            style="color: var(--color-text-primary)"
          >
            {{ stats.pending }}
          </span>
        </div>
      </div>

      <ErrorBanner
        v-if="cache.clearError.value"
        :message="cache.clearError.value"
        @dismiss="cache.clearError.value = null"
      />

      <button class="btn btn-danger w-full" @click="openClearConfirm">
        <Icon icon="mdi:delete-sweep-outline" class="w-4 h-4" />
        Cache leeren &amp; neu laden
      </button>
    </section>

    <!-- ─── App Info ───────────────────────────────────────────────────────── -->
    <section class="card space-y-2">
      <h2
        class="text-sm font-semibold uppercase tracking-wide"
        style="color: var(--color-text-muted)"
      >
        App-Info
      </h2>
      <div class="flex justify-between text-sm">
        <span style="color: var(--color-text-secondary)">Version</span>
        <span style="color: var(--color-text-primary)">1.0.0</span>
      </div>
      <div class="flex justify-between text-sm">
        <span style="color: var(--color-text-secondary)">Backend</span>
        <span
          class="font-mono text-xs truncate max-w-[180px]"
          style="color: var(--color-text-primary)"
        >
          {{ (config.public as { apiBase: string }).apiBase }}
        </span>
      </div>
    </section>
  </div>

  <!-- ─── Clear Confirm Sheet ──────────────────────────────────────────────── -->
  <BottomSheet v-if="showClearConfirm" title="Cache leeren?" @close="showClearConfirm = false">
    <div class="space-y-4">
      <p class="text-sm" style="color: var(--color-text-secondary)">
        Alle lokalen Daten werden gelöscht und neu vom Server geladen. Online-Verbindung ist
        erforderlich.
      </p>

      <!-- Pending warning (only when there are unsent changes) -->
      <div
        v-if="stats.pending > 0"
        class="rounded-xl p-4 space-y-3"
        style="background: var(--color-danger-bg); border: 1px solid var(--color-danger-border)"
      >
        <p class="text-sm font-semibold" style="color: var(--color-danger-text)">
          Du hast {{ stats.pending }} ungesendete Änderung{{ stats.pending !== 1 ? 'en' : '' }}.
          Diese gehen beim Leeren verloren.
        </p>
        <label class="flex items-start gap-3 cursor-pointer">
          <input v-model="confirmedDataLoss" type="checkbox" class="mt-0.5 shrink-0" />
          <span class="text-sm" style="color: var(--color-danger-text)">
            Ich verstehe, dass meine Änderungen verloren gehen
          </span>
        </label>
      </div>

      <button class="btn btn-danger w-full" :disabled="!canConfirmClear" @click="executeClear">
        Cache leeren &amp; neu laden
      </button>
      <button class="btn btn-secondary w-full" @click="showClearConfirm = false">Abbrechen</button>
    </div>
  </BottomSheet>

  <!-- ─── Fullscreen clearing overlay ─────────────────────────────────────── -->
  <Teleport to="body">
    <div
      v-if="cache.isClearing.value"
      class="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5"
      style="background: var(--color-surface-0)"
    >
      <LoadingSpinner size="lg" />
      <div class="text-center space-y-1">
        <p class="text-base font-semibold" style="color: var(--color-text-primary)">
          Daten werden neu geladen…
        </p>
        <p class="text-sm" style="color: var(--color-text-muted)">Bitte warten</p>
      </div>
    </div>
  </Teleport>
</template>
