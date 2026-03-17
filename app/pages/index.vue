<script setup lang="ts">
import { ref, onMounted, resolveComponent } from 'vue'
import { useSync } from '~/composables/useSync'
import { useDatabase } from '~/composables/useDatabase'
import { containerConfig } from '~/utils/containerUtils'
import type { Container } from '~/types/inventory'
import type { PrintSize } from '~/components/PrintSizeSelector.vue'

const db = useDatabase()
const sync = useSync()
const NuxtLink = resolveComponent('NuxtLink')

// ─── Multi-select ─────────────────────────────────────────────────────────────
const isSelecting = ref(false)
const selectedIds = ref<number[]>([])
const showPrintSize = ref(false)

function toggleSelect(id: number) {
  const idx = selectedIds.value.indexOf(id)
  if (idx === -1) {
    selectedIds.value = [...selectedIds.value, id]
  } else {
    selectedIds.value = selectedIds.value.filter(x => x !== id)
  }
}

function openPrint(size: PrintSize) {
  showPrintSize.value = false
  const ids = selectedIds.value.join(',')
  window.open(
    `/print?containers=${ids}&size=${size}`,
    '_blank',
    'width=1000,height=750,menubar=no,toolbar=no,location=no'
  )
}

const roots = ref<Container[]>([])
const allContainers = ref<Container[]>([])
const error = ref<string | null>(null)
const isRefreshing = ref(false)
const showAddSheet = ref(false)

// ─── Pull-to-refresh ─────────────────────────────────────────────────────────

let touchStartY = 0
let isPulling = false
const pullDistance = ref(0)
const PULL_THRESHOLD = 72

function onTouchStart(e: TouchEvent) {
  const scrollEl = (e.currentTarget as HTMLElement)
  if (scrollEl.scrollTop > 0) return
  touchStartY = e.touches[0]?.clientY ?? 0
  isPulling = true
}

function onTouchMove(e: TouchEvent) {
  if (!isPulling) return
  const dy = (e.touches[0]?.clientY ?? 0) - touchStartY
  if (dy > 0) {
    pullDistance.value = Math.min(dy * 0.5, PULL_THRESHOLD + 20)
  }
}

async function onTouchEnd() {
  if (pullDistance.value >= PULL_THRESHOLD) {
    await refresh()
  }
  pullDistance.value = 0
  isPulling = false
}

// ─── Data Loading ─────────────────────────────────────────────────────────────

async function loadData() {
  try {
    allContainers.value = await db.getAllContainers()
    roots.value = allContainers.value.filter(
      c => c.parentContainerId === null || c.parentContainerId === undefined
    )
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unbekannter Fehler'
  }
}

async function refresh() {
  isRefreshing.value = true
  try {
    await sync.deltaSync()
    await loadData()
  } finally {
    isRefreshing.value = false
  }
}

function childCount(container: Container): { containers: number; items: number } {
  const containers = allContainers.value.filter(c => c.parentContainerId === container.id).length
  const items = container.itemCount ?? 0
  return { containers, items }
}

function childLabel(container: Container): string {
  const { containers, items } = childCount(container)
  const cfg = containerConfig[container.containerType as keyof typeof containerConfig]
  const parts: string[] = []

  if (containers > 0) {
    const childType = container.containerType === 'ROOM' ? 'Regal' : 'Kiste'
    parts.push(`${containers} ${childType}${containers !== 1 ? (container.containerType === 'ROOM' ? 'e' : 'n') : ''}`)
  }
  if (items > 0) {
    parts.push(`${items} Item${items !== 1 ? 's' : ''}`)
  }
  if (parts.length === 0) {
    return cfg ? `Leere${container.containerType === 'ROOM' ? 'r Raum' : container.containerType === 'SHELF' ? 's Regal' : ' Kiste'}` : 'Leer'
  }
  return parts.join(' · ')
}

function onRoomCreated(container: Container) {
  showAddSheet.value = false
  roots.value = [...roots.value, container]
  allContainers.value = [...allContainers.value, container]
}

onMounted(loadData)
</script>

<template>
  <div
    class="relative"
    @touchstart.passive="onTouchStart"
    @touchmove.passive="onTouchMove"
    @touchend.passive="onTouchEnd"
  >
    <!-- Pull-to-refresh indicator -->
    <div
      class="flex items-center justify-center overflow-hidden transition-all duration-200"
      :style="{ height: pullDistance > 0 ? `${pullDistance}px` : '0px' }"
    >
      <LoadingSpinner v-if="isRefreshing || pullDistance >= 72" size="sm" />
      <Icon v-else icon="mdi:arrow-down" class="w-5 h-5" style="color: var(--color-text-muted)" />
    </div>

    <!-- Page header -->
    <div class="px-4 pt-4 pb-2 flex items-start justify-between gap-2">
      <div>
        <h1 class="text-xl font-bold" style="color: var(--color-text-primary)">Lagerorte</h1>
        <p class="text-sm" style="color: var(--color-text-muted)">
          {{ roots.length }} {{ roots.length === 1 ? 'Raum' : 'Räume' }}
        </p>
      </div>
      <button
        v-if="roots.length > 0"
        class="btn btn-ghost text-sm px-3 py-1.5 shrink-0"
        style="color: var(--color-accent)"
        @click="isSelecting ? (isSelecting = false, selectedIds = []) : (isSelecting = true)"
      >
        {{ isSelecting ? 'Fertig' : 'Auswählen' }}
      </button>
    </div>

    <!-- Error -->
    <div v-if="error" class="px-4 pb-2">
      <ErrorBanner :message="error" @dismiss="error = null" />
    </div>

    <!-- Refreshing overlay -->
    <div v-if="isRefreshing" class="flex justify-center py-2">
      <LoadingSpinner size="sm" />
    </div>

    <!-- Container list -->
    <div v-if="roots.length > 0" class="px-4 space-y-2 pb-4">
      <component
        :is="isSelecting ? 'div' : NuxtLink"
        v-for="container in roots"
        :key="container.id"
        :to="isSelecting ? undefined : `/containers/${container.id}`"
        class="card flex items-center gap-4 relative"
        :class="[
          isSelecting ? 'cursor-pointer' : 'active:opacity-70 transition-opacity',
        ]"
        :style="isSelecting && selectedIds.includes(container.id) ? 'outline: 2px solid var(--color-accent); outline-offset: 2px' : ''"
        @click="isSelecting ? toggleSelect(container.id) : undefined"
      >
        <!-- Checkbox overlay when selecting -->
        <div
          v-if="isSelecting"
          class="absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center"
          :style="selectedIds.includes(container.id)
            ? 'background: var(--color-accent); border-color: var(--color-accent)'
            : 'background: var(--color-surface-0); border-color: var(--color-border)'"
        >
          <Icon v-if="selectedIds.includes(container.id)" icon="mdi:check" class="w-4 h-4 text-white" />
        </div>

        <!-- Icon -->
        <div
          class="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style="background: var(--color-surface-2)"
        >
          <Icon
            :icon="containerConfig[container.containerType as keyof typeof containerConfig]?.icon ?? 'mdi:cube-outline'"
            class="w-6 h-6"
            style="color: var(--color-accent)"
          />
        </div>

        <!-- Info -->
        <div class="flex-1 min-w-0">
          <p class="font-semibold truncate" style="color: var(--color-text-primary)">
            {{ container.name }}
          </p>
          <p class="text-sm truncate" style="color: var(--color-text-muted)">
            {{ childLabel(container) }}
          </p>
        </div>

        <!-- Chevron -->
        <Icon icon="mdi:chevron-right" class="w-5 h-5 shrink-0" style="color: var(--color-text-muted)" />
      </component>
    </div>

    <!-- Empty state -->
    <EmptyState
      v-else-if="!isRefreshing"
      icon="mdi:home-outline"
      title="Noch keine Räume"
      description="Füge deinen ersten Lagerraum hinzu."
      action-label="Raum hinzufügen"
      @action="showAddSheet = true"
    />

    <!-- FAB: Raum hinzufügen -->
    <button
      v-if="roots.length > 0"
      class="fixed bottom-20 right-4 z-10 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center lg:bottom-6"
      style="background: var(--color-accent)"
      aria-label="Raum hinzufügen"
      data-testid="fab"
      @click="showAddSheet = true"
    >
      <Icon icon="mdi:plus" class="w-7 h-7 text-white" />
    </button>

    <!-- Add Room Sheet -->
    <ContainerForm
      v-if="showAddSheet"
      forced-type="ROOM"
      @created="onRoomCreated"
      @close="showAddSheet = false"
    />

    <!-- Selection bar -->
    <div
      v-if="isSelecting && selectedIds.length > 0"
      class="fixed bottom-20 left-0 right-0 z-20 mx-4 lg:bottom-6"
    >
      <div
        class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg"
        style="background: var(--color-surface-1); border: 1px solid var(--color-border)"
      >
        <span class="flex-1 text-sm font-medium" style="color: var(--color-text-primary)">
          {{ selectedIds.length }} ausgewählt
        </span>
        <button
          class="btn btn-ghost text-sm px-3 py-1.5"
          style="color: var(--color-accent)"
          :disabled="selectedIds.length === 0"
          @click="showPrintSize = true"
        >
          Drucken
        </button>
        <button
          class="btn btn-ghost text-sm px-3 py-1.5"
          style="color: var(--color-text-muted)"
          @click="isSelecting = false; selectedIds = []"
        >
          Abbrechen
        </button>
      </div>
    </div>

    <!-- Print size selector -->
    <PrintSizeSelector
      v-if="showPrintSize"
      @select="openPrint"
      @close="showPrintSize = false"
    />
  </div>
</template>
