<script setup lang="ts">
import { ref, computed, onMounted, resolveComponent } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDatabase } from '~/composables/useDatabase'
import { useSync } from '~/composables/useSync'
import { useImages } from '~/composables/useImages'
import { containerConfig, getBreadcrumb, getAddableChildTypes } from '~/utils/containerUtils'
import type { Container, LocalItem, Image } from '~/types/inventory'
import type { ContainerType } from '~/utils/containerUtils'
import type { PrintSize } from '~/components/PrintSizeSelector.vue'

const route = useRoute()
const router = useRouter()
const db = useDatabase()
const sync = useSync()
const imgLoader = useImages()

const NuxtLink = resolveComponent('NuxtLink')

const id = computed(() => Number(route.params.id))
const container = ref<Container | null>(null)
const allContainers = ref<Container[]>([])
const children = ref<Container[]>([])
const items = ref<LocalItem[]>([])
const images = ref<Image[]>([])
const error = ref<string | null>(null)
const isLoading = ref(true)

const primaryImage = computed(() => images.value.find(i => i.isPrimary) ?? images.value[0] ?? null)

// ─── Multi-select ─────────────────────────────────────────────────────────────
const isSelecting = ref(false)
const selectedContainerIds = ref<number[]>([])
const selectedItemIds = ref<number[]>([])
const showPrintSize = ref(false)

const totalSelected = computed(() => selectedContainerIds.value.length + selectedItemIds.value.length)

function toggleContainer(cId: number) {
  const idx = selectedContainerIds.value.indexOf(cId)
  if (idx === -1) {
    selectedContainerIds.value = [...selectedContainerIds.value, cId]
  } else {
    selectedContainerIds.value = selectedContainerIds.value.filter(x => x !== cId)
  }
}

function toggleItem(iId: number) {
  const idx = selectedItemIds.value.indexOf(iId)
  if (idx === -1) {
    selectedItemIds.value = [...selectedItemIds.value, iId]
  } else {
    selectedItemIds.value = selectedItemIds.value.filter(x => x !== iId)
  }
}

function openPrint(size: PrintSize) {
  showPrintSize.value = false
  const params = new URLSearchParams({ size })
  if (selectedContainerIds.value.length > 0) {
    params.set('containers', selectedContainerIds.value.join(','))
  }
  if (selectedItemIds.value.length > 0) {
    params.set('items', selectedItemIds.value.join(','))
  }
  window.open(
    `/print?${params.toString()}`,
    '_blank',
    'width=1000,height=750,menubar=no,toolbar=no,location=no'
  )
}

// ─── Sheets ───────────────────────────────────────────────────────────────────
const showActionSheet = ref(false)
const showEditSheet = ref(false)
const showAddContainerSheet = ref(false)
const addingContainerType = ref<ContainerType>('SHELF')
const showAddItemSheet = ref(false)
const showGallery = ref(false)
const showQr = ref(false)
const viewerIndex = ref<number | null>(null)

const addableChildTypes = computed<ContainerType[]>(() =>
  container.value ? getAddableChildTypes(container.value.containerType as ContainerType) : []
)

// ─── Breadcrumb ───────────────────────────────────────────────────────────────
const breadcrumb = computed(() =>
  container.value ? getBreadcrumb(container.value.id, allContainers.value) : []
)

const containerCfg = computed(() =>
  container.value
    ? containerConfig[container.value.containerType as ContainerType] ?? null
    : null
)

// ─── Data Loading ─────────────────────────────────────────────────────────────
async function loadData() {
  isLoading.value = true
  error.value = null
  try {
    allContainers.value = await db.getAllContainers()
    container.value = allContainers.value.find(c => c.id === id.value) ?? null

    if (!container.value) {
      // Try to sync once
      await sync.deltaSync()
      allContainers.value = await db.getAllContainers()
      container.value = allContainers.value.find(c => c.id === id.value) ?? null
    }

    if (container.value) {
      children.value = allContainers.value.filter(c => c.parentContainerId === id.value)
      items.value = await db.getItemsByContainer(id.value)
      images.value = await imgLoader.loadImagesForContainer(id.value)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Unbekannter Fehler'
  } finally {
    isLoading.value = false
  }
}

function childLabel(c: Container): string {
  const childCount = allContainers.value.filter(x => x.parentContainerId === c.id).length
  const itemCount = c.itemCount ?? 0
  const parts: string[] = []
  if (childCount > 0) {
    const type = c.containerType === 'ROOM' ? 'Regal' : 'Kiste'
    parts.push(`${childCount} ${type}${childCount !== 1 ? (c.containerType === 'ROOM' ? 'e' : 'n') : ''}`)
  }
  if (itemCount > 0) parts.push(`${itemCount} Item${itemCount !== 1 ? 's' : ''}`)
  return parts.join(' · ') || 'Leer'
}

const tagColorMap: Record<string, string> = {
  LLM: 'purple',
  RULE: 'slate',
  MANUAL: 'blue'
}

function onChildContainerCreated(c: Container) {
  showAddContainerSheet.value = false
  showActionSheet.value = false
  children.value = [...children.value, c]
  allContainers.value = [...allContainers.value, c]
}

function onItemCreated() {
  showAddItemSheet.value = false
  showActionSheet.value = false
  loadData()
}

async function onGalleryUpdated() {
  images.value = await imgLoader.refreshImagesForContainer(id.value)
}

function onContainerUpdated(updated: Container) {
  showEditSheet.value = false
  container.value = updated
  allContainers.value = allContainers.value.map(c => c.id === updated.id ? updated : c)
}

onMounted(loadData)
</script>

<template>
  <div>
    <!-- Loading -->
    <div v-if="isLoading" class="flex justify-center py-16">
      <LoadingSpinner size="lg" />
    </div>

    <!-- Not Found -->
    <EmptyState
      v-else-if="!container"
      icon="mdi:package-variant-closed-remove"
      title="Container nicht gefunden"
      description="Dieser Lagerort existiert nicht oder wurde gelöscht."
      action-label="Zurück"
      @action="router.back()"
    />

    <template v-else>
      <!-- ─── Breadcrumb ───────────────────────────────────────────────────── -->
      <nav
        class="flex items-center gap-1 px-4 pt-3 pb-1 overflow-x-auto"
        aria-label="Breadcrumb"
      >
        <NuxtLink to="/" class="text-sm shrink-0" style="color: var(--color-text-muted)">
          Übersicht
        </NuxtLink>
        <template v-for="(crumb, i) in breadcrumb" :key="crumb.id">
          <Icon icon="mdi:chevron-right" class="w-4 h-4 shrink-0" style="color: var(--color-text-muted)" />
          <NuxtLink
            v-if="i < breadcrumb.length - 1"
            :to="`/containers/${crumb.id}`"
            class="text-sm truncate max-w-[120px] shrink-0"
            style="color: var(--color-text-muted)"
          >
            {{ crumb.name }}
          </NuxtLink>
          <span
            v-else
            class="text-sm font-semibold truncate max-w-[150px] shrink-0"
            style="color: var(--color-text-primary)"
          >
            {{ crumb.name }}
          </span>
        </template>
      </nav>

      <!-- Error -->
      <div v-if="error" class="px-4 pb-2">
        <ErrorBanner :message="error" @dismiss="error = null" />
      </div>

      <!-- ─── Container Header ────────────────────────────────────────────── -->
      <div class="px-4 py-3 flex items-start gap-4">
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          style="background: var(--color-surface-2)"
        >
          <Icon
            :icon="containerCfg?.icon ?? 'mdi:cube-outline'"
            class="w-7 h-7"
            style="color: var(--color-accent)"
          />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-center gap-2 flex-wrap">
            <h1 class="text-xl font-bold" style="color: var(--color-text-primary)">
              {{ container.name }}
            </h1>
            <Badge :variant="containerCfg?.color as 'blue' | 'green' | 'amber' ?? 'default'">
              {{ containerCfg?.label }}
            </Badge>
          </div>
          <p v-if="container.description" class="text-sm mt-0.5" style="color: var(--color-text-secondary)">
            {{ container.description }}
          </p>
          <p v-if="container.position" class="text-xs mt-0.5" style="color: var(--color-text-muted)">
            <Icon icon="mdi:map-marker-outline" class="w-3.5 h-3.5 inline" />
            {{ container.position }}
          </p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            class="btn btn-ghost p-2"
            aria-label="QR-Code"
            @click="showQr = true"
          >
            <Icon icon="mdi:qrcode" class="w-5 h-5" />
          </button>
          <button
            class="btn btn-ghost p-2"
            aria-label="Bearbeiten"
            @click="showEditSheet = true"
          >
            <Icon icon="mdi:pencil-outline" class="w-5 h-5" />
          </button>
          <button
            class="btn btn-ghost text-sm px-2 py-1"
            style="color: var(--color-accent)"
            @click="isSelecting ? (isSelecting = false, selectedContainerIds = [], selectedItemIds = []) : (isSelecting = true)"
          >
            {{ isSelecting ? 'Fertig' : 'Auswählen' }}
          </button>
        </div>
      </div>

      <!-- ─── Primary Image ────────────────────────────────────────────────── -->
      <div v-if="primaryImage" class="px-4 mb-4">
        <img
          :src="primaryImage.url"
          :alt="container.name"
          class="w-full rounded-2xl object-cover cursor-pointer"
          style="max-height: 220px"
          @click="viewerIndex = images.indexOf(primaryImage)"
        />
      </div>

      <!-- ─── Image Thumbnails ──────────────────────────────────────────────── -->
      <div class="mb-4">
        <div class="flex gap-3 overflow-x-auto px-4 pb-2 scroll-smooth">
          <div
            v-for="(img, i) in images"
            :key="img.id"
            class="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden cursor-pointer"
            :style="img.isPrimary ? 'outline: 2px solid var(--color-accent); outline-offset: 2px' : ''"
            @click="viewerIndex = i"
          >
            <img :src="img.url" :alt="img.filename" class="w-full h-full object-cover" />
          </div>
          <button
            class="shrink-0 w-20 h-20 rounded-xl flex flex-col items-center justify-center gap-1"
            style="background: var(--color-surface-2); color: var(--color-text-muted); border: 2px dashed var(--color-border)"
            aria-label="Bild hinzufügen"
            @click="showGallery = true"
          >
            <Icon icon="mdi:camera-plus-outline" class="w-5 h-5" />
            <span class="text-xs">{{ images.length === 0 ? 'Fotos' : 'Mehr' }}</span>
          </button>
        </div>
      </div>

      <!-- ─── Unterkontainer ──────────────────────────────────────────────── -->
      <section v-if="children.length > 0" class="px-4 mb-4">
        <h2 class="text-xs font-semibold uppercase tracking-wide mb-2" style="color: var(--color-text-muted)">
          {{ container.containerType === 'ROOM' ? 'Regale' : 'Kisten' }}
          <span style="color: var(--color-text-muted)">{{ children.length }}</span>
        </h2>
        <div class="space-y-2">
          <component
            :is="isSelecting ? 'div' : NuxtLink"
            v-for="child in children"
            :key="child.id"
            :to="isSelecting ? undefined : `/containers/${child.id}`"
            class="card flex items-center gap-4 relative"
            :class="[isSelecting ? 'cursor-pointer' : 'active:opacity-70 transition-opacity']"
            :style="isSelecting && selectedContainerIds.includes(child.id) ? 'outline: 2px solid var(--color-accent); outline-offset: 2px' : ''"
            @click="isSelecting ? toggleContainer(child.id) : undefined"
          >
            <!-- Checkbox overlay -->
            <div
              v-if="isSelecting"
              class="absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center"
              :style="selectedContainerIds.includes(child.id)
                ? 'background: var(--color-accent); border-color: var(--color-accent)'
                : 'background: var(--color-surface-0); border-color: var(--color-border)'"
            >
              <Icon v-if="selectedContainerIds.includes(child.id)" icon="mdi:check" class="w-4 h-4 text-white" />
            </div>

            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style="background: var(--color-surface-2)"
            >
              <Icon
                :icon="containerConfig[child.containerType as ContainerType]?.icon ?? 'mdi:cube-outline'"
                class="w-5 h-5"
                style="color: var(--color-accent)"
              />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate" style="color: var(--color-text-primary)">
                {{ child.name }}
              </p>
              <p class="text-sm truncate" style="color: var(--color-text-muted)">
                {{ childLabel(child) }}
              </p>
            </div>
            <Icon icon="mdi:chevron-right" class="w-5 h-5 shrink-0" style="color: var(--color-text-muted)" />
          </component>
        </div>
      </section>

      <!-- ─── Items ───────────────────────────────────────────────────────── -->
      <section class="px-4 mb-4">
        <h2 class="text-xs font-semibold uppercase tracking-wide mb-2" style="color: var(--color-text-muted)">
          Items <span>{{ items.length }}</span>
        </h2>

        <div v-if="items.length > 0" class="space-y-2">
          <component
            :is="isSelecting ? 'div' : NuxtLink"
            v-for="item in items"
            :key="item.id"
            :to="isSelecting ? undefined : `/items/${item.id}`"
            class="card flex items-center gap-4 relative"
            :class="[isSelecting ? 'cursor-pointer' : 'active:opacity-70 transition-opacity']"
            :style="isSelecting && selectedItemIds.includes(item.id) ? 'outline: 2px solid var(--color-accent); outline-offset: 2px' : ''"
            @click="isSelecting ? toggleItem(item.id) : undefined"
          >
            <!-- Checkbox overlay -->
            <div
              v-if="isSelecting"
              class="absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center"
              :style="selectedItemIds.includes(item.id)
                ? 'background: var(--color-accent); border-color: var(--color-accent)'
                : 'background: var(--color-surface-0); border-color: var(--color-border)'"
            >
              <Icon v-if="selectedItemIds.includes(item.id)" icon="mdi:check" class="w-4 h-4 text-white" />
            </div>

            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style="background: var(--color-surface-2)"
            >
              <Icon icon="mdi:cube-outline" class="w-5 h-5" style="color: var(--color-text-muted)" />
            </div>
            <div class="flex-1 min-w-0">
              <p class="font-medium truncate" style="color: var(--color-text-primary)">
                {{ item.name }}
              </p>
              <div v-if="item.tags && item.tags.length > 0" class="flex flex-wrap gap-1 mt-1">
                <Badge
                  v-for="tag in item.tags.slice(0, 3)"
                  :key="tag"
                  variant="default"
                >
                  {{ tag }}
                </Badge>
                <span v-if="item.tags.length > 3" class="text-xs" style="color: var(--color-text-muted)">
                  +{{ item.tags.length - 3 }}
                </span>
              </div>
              <p class="text-xs mt-0.5" style="color: var(--color-text-muted)">
                Anzahl: {{ item.quantity }}
              </p>
            </div>
            <Icon icon="mdi:chevron-right" class="w-5 h-5 shrink-0" style="color: var(--color-text-muted)" />
          </component>
        </div>

        <EmptyState
          v-else
          icon="mdi:cube-outline"
          title="Keine Items"
          description="Noch keine Items in diesem Lagerort."
        />
      </section>

      <!-- ─── FAB ─────────────────────────────────────────────────────────── -->
      <button
        class="fixed bottom-20 right-4 z-10 w-14 h-14 rounded-2xl shadow-lg flex items-center justify-center lg:bottom-6"
        style="background: var(--color-accent)"
        aria-label="Hinzufügen"
        data-testid="fab"
        @click="showActionSheet = true"
      >
        <Icon icon="mdi:plus" class="w-7 h-7 text-white" />
      </button>

      <!-- ─── Action Sheet ─────────────────────────────────────────────────── -->
      <BottomSheet v-if="showActionSheet" title="Hinzufügen" @close="showActionSheet = false">
        <div class="space-y-2">
          <button
            v-for="type in addableChildTypes"
            :key="type"
            class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-colors"
            style="background: var(--color-surface-2)"
            @click="addingContainerType = type; showActionSheet = false; showAddContainerSheet = true"
          >
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center"
              style="background: var(--color-surface-0)"
            >
              <Icon :icon="containerConfig[type].icon" class="w-5 h-5" style="color: var(--color-accent)" />
            </div>
            <div>
              <p class="font-medium" style="color: var(--color-text-primary)">
                {{ containerConfig[type].label }} hinzufügen
              </p>
              <p class="text-xs" style="color: var(--color-text-muted)">
                Neuen Lagerort anlegen
              </p>
            </div>
          </button>

          <button
            class="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-left transition-colors"
            style="background: var(--color-surface-2)"
            @click="showActionSheet = false; showAddItemSheet = true"
          >
            <div
              class="w-10 h-10 rounded-xl flex items-center justify-center"
              style="background: var(--color-surface-0)"
            >
              <Icon icon="mdi:cube-outline" class="w-5 h-5" style="color: var(--color-accent)" />
            </div>
            <div>
              <p class="font-medium" style="color: var(--color-text-primary)">Item hinzufügen</p>
              <p class="text-xs" style="color: var(--color-text-muted)">
                Neues Item in diesem Lagerort
              </p>
            </div>
          </button>
        </div>
      </BottomSheet>

      <!-- ─── Add Container Sheet ───────────────────────────────────────────── -->
      <ContainerForm
        v-if="showAddContainerSheet"
        :forced-type="addingContainerType"
        :parent-container-id="id"
        @created="onChildContainerCreated"
        @close="showAddContainerSheet = false"
      />

      <!-- ─── Add Item Sheet ────────────────────────────────────────────────── -->
      <ItemForm
        v-if="showAddItemSheet"
        :container-id="id"
        @created="onItemCreated"
        @close="showAddItemSheet = false"
      />

      <!-- ─── Image Viewer ─────────────────────────────────────────────────── -->
      <ImageViewer
        v-if="viewerIndex !== null && images.length > 0"
        :images="images"
        :initial-index="viewerIndex"
        @close="viewerIndex = null"
      />

      <!-- ─── Image Gallery ────────────────────────────────────────────────── -->
      <ImageGallery
        v-if="showGallery && container"
        :images="images"
        entity-type="container"
        :entity-id="container.id"
        @updated="onGalleryUpdated"
        @close="showGallery = false"
      />

      <!-- ─── QR Sheet ─────────────────────────────────────────────────────── -->
      <QrSheet
        v-if="showQr && container"
        entity-type="container"
        :entity-id="container.id"
        :name="container.name"
        @close="showQr = false"
      />

      <!-- ─── Edit Sheet ────────────────────────────────────────────────────── -->
      <ContainerEditForm
        v-if="showEditSheet && container"
        :container="container"
        @updated="onContainerUpdated"
        @deleted="router.back()"
        @close="showEditSheet = false"
      />

      <!-- ─── Selection bar ────────────────────────────────────────────────── -->
      <div
        v-if="isSelecting && totalSelected > 0"
        class="fixed bottom-20 left-0 right-0 z-20 mx-4 lg:bottom-6"
      >
        <div
          class="flex items-center gap-3 px-4 py-3 rounded-2xl shadow-lg"
          style="background: var(--color-surface-1); border: 1px solid var(--color-border)"
        >
          <span class="flex-1 text-sm font-medium" style="color: var(--color-text-primary)">
            {{ totalSelected }} ausgewählt
          </span>
          <button
            class="btn btn-ghost text-sm px-3 py-1.5"
            style="color: var(--color-accent)"
            :disabled="totalSelected === 0"
            @click="showPrintSize = true"
          >
            Drucken
          </button>
          <button
            class="btn btn-ghost text-sm px-3 py-1.5"
            style="color: var(--color-text-muted)"
            @click="isSelecting = false; selectedContainerIds = []; selectedItemIds = []"
          >
            Abbrechen
          </button>
        </div>
      </div>

      <!-- ─── Print size selector ──────────────────────────────────────────── -->
      <PrintSizeSelector
        v-if="showPrintSize"
        @select="openPrint"
        @close="showPrintSize = false"
      />
    </template>
  </div>
</template>
