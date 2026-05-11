<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue'
  import { useRoute, useRouter } from 'vue-router'
  import { useDatabase } from '~/composables/useDatabase'
  import { useImages } from '~/composables/useImages'
  import { useCommands } from '~/composables/useCommands'
  import { useSync } from '~/composables/useSync'
  import { getBreadcrumb } from '~/utils/containerUtils'
  import type { LocalItem, Image } from '~/types/inventory'

  const route = useRoute()
  const router = useRouter()
  const db = useDatabase()
  const imgLoader = useImages()
  const commands = useCommands()
  const sync = useSync()

  const id = computed(() => route.params.id as string)
  const item = ref<LocalItem | null>(null)
  const allContainers = ref<Awaited<ReturnType<typeof db.getAllContainers>>>([])

  const images = ref<Image[]>([])
  const error = ref<string | null>(null)
  const isLoading = ref(true)

  const showEditSheet = ref(false)
  const showGallery = ref(false)
  const showDeleteConfirm = ref(false)
  const showQr = ref(false)
  const viewerIndex = ref<number | null>(null)
  const isDeleting = ref(false)

  // ─── Breadcrumb ───────────────────────────────────────────────────────────────
  const breadcrumb = computed(() => {
    if (!item.value?.containerId) return []
    return getBreadcrumb(item.value.containerId, allContainers.value)
  })

  // ─── Tag display config ───────────────────────────────────────────────────────
  const tagIcons: Record<string, string> = {
    LLM: 'mdi:creation-outline',
    RULE: 'mdi:cog-outline',
    MANUAL: 'mdi:pencil-outline',
  }
  const tagVariants: Record<string, 'purple' | 'slate' | 'blue'> = {
    LLM: 'purple',
    RULE: 'slate',
    MANUAL: 'blue',
  }

  // ─── Primary image ────────────────────────────────────────────────────────────
  const primaryImage = computed(
    () => images.value.find((i) => i.isPrimary) ?? images.value[0] ?? null,
  )

  // ─── Load data ────────────────────────────────────────────────────────────────
  async function loadData() {
    isLoading.value = true
    error.value = null
    try {
      item.value = (await db.getItem(id.value)) ?? null

      if (!item.value) {
        await sync.deltaSync()
        item.value = (await db.getItem(id.value)) ?? null
      }

      if (item.value) {
        allContainers.value = await db.getAllContainers()
        images.value = await imgLoader.loadImagesForItem(id.value)
      }
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Unbekannter Fehler'
    } finally {
      isLoading.value = false
    }
  }

  // ─── After edit ───────────────────────────────────────────────────────────────
  async function onItemUpdated(updated: LocalItem) {
    showEditSheet.value = false
    item.value = updated
  }

  async function onGalleryUpdated() {
    images.value = await imgLoader.refreshImagesForItem(id.value)
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────
  async function confirmDelete() {
    if (!item.value) return
    isDeleting.value = true
    try {
      await commands.executeCommand('ITEM_DELETE', {}, item.value.id)
      router.back()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Löschen fehlgeschlagen'
      isDeleting.value = false
      showDeleteConfirm.value = false
    }
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
      v-else-if="!item"
      icon="mdi:cube-off-outline"
      title="Item nicht gefunden"
      description="Dieses Item existiert nicht oder wurde gelöscht."
      action-label="Zurück"
      @action="router.back()"
    />

    <template v-else>
      <!-- ─── Breadcrumb ───────────────────────────────────────────────────── -->
      <nav class="flex items-center gap-1 px-4 pt-3 pb-1 overflow-x-auto" aria-label="Breadcrumb">
        <NuxtLink to="/" class="text-sm shrink-0" style="color: var(--color-text-muted)">
          Übersicht
        </NuxtLink>
        <template v-for="crumb in breadcrumb" :key="crumb.id">
          <Icon
            icon="mdi:chevron-right"
            class="w-4 h-4 shrink-0"
            style="color: var(--color-text-muted)"
          />
          <NuxtLink
            :to="`/containers/${crumb.id}`"
            class="text-sm truncate max-w-[100px] shrink-0"
            style="color: var(--color-text-muted)"
          >
            {{ crumb.name }}
          </NuxtLink>
        </template>
        <Icon
          icon="mdi:chevron-right"
          class="w-4 h-4 shrink-0"
          style="color: var(--color-text-muted)"
        />
        <span
          class="text-sm font-semibold shrink-0 truncate max-w-[150px]"
          style="color: var(--color-text-primary)"
        >
          {{ item.name }}
        </span>
      </nav>

      <!-- Error -->
      <div v-if="error" class="px-4 pb-2">
        <ErrorBanner :message="error" @dismiss="error = null" />
      </div>

      <!-- ─── Header ──────────────────────────────────────────────────────── -->
      <div class="px-4 py-3 flex items-start justify-between gap-3">
        <h1 class="text-2xl font-bold leading-tight" style="color: var(--color-text-primary)">
          {{ item.name }}
        </h1>
        <div class="flex items-center gap-1 shrink-0 mt-0.5">
          <button class="btn btn-ghost p-2" aria-label="QR-Code" @click="showQr = true">
            <Icon icon="mdi:qrcode" class="w-5 h-5" />
          </button>
          <button class="btn btn-ghost p-2" aria-label="Bearbeiten" @click="showEditSheet = true">
            <Icon icon="mdi:pencil-outline" class="w-5 h-5" />
          </button>
        </div>
      </div>

      <!-- ─── Primary Image ────────────────────────────────────────────────── -->
      <div v-if="primaryImage" class="px-4 mb-4">
        <img
          :src="primaryImage.url"
          :alt="item.name"
          class="w-full rounded-2xl object-cover cursor-pointer"
          style="max-height: 280px"
          @click="viewerIndex = images.indexOf(primaryImage)"
        />
      </div>

      <!-- ─── Info ─────────────────────────────────────────────────────────── -->
      <div class="px-4 space-y-4 mb-4">
        <!-- Description -->
        <p
          v-if="item.description"
          class="text-base leading-relaxed"
          style="color: var(--color-text-secondary)"
        >
          {{ item.description }}
        </p>

        <!-- Meta row -->
        <div class="flex flex-wrap gap-4">
          <div class="flex items-center gap-2">
            <Icon icon="mdi:counter" class="w-4 h-4" style="color: var(--color-text-muted)" />
            <span class="text-sm" style="color: var(--color-text-secondary)">
              Menge: <strong style="color: var(--color-text-primary)">{{ item.quantity }}</strong>
            </span>
          </div>
          <div v-if="item.barcode" class="flex items-center gap-2">
            <Icon icon="mdi:barcode" class="w-4 h-4" style="color: var(--color-text-muted)" />
            <span class="text-sm font-mono" style="color: var(--color-text-secondary)">
              {{ item.barcode }}
            </span>
          </div>
          <div v-if="item.category" class="flex items-center gap-2">
            <Icon icon="mdi:shape-outline" class="w-4 h-4" style="color: var(--color-text-muted)" />
            <Badge variant="purple">{{ item.category.name }}</Badge>
          </div>
        </div>

        <!-- Tags -->
        <div v-if="item.tags && item.tags.length > 0">
          <p
            class="text-xs font-semibold uppercase tracking-wide mb-2"
            style="color: var(--color-text-muted)"
          >
            Tags
          </p>
          <div class="flex flex-wrap gap-2">
            <Badge v-for="tag in item.tags" :key="tag" variant="default" size="md">
              {{ tag }}
            </Badge>
          </div>
        </div>

        <!-- Enriched tags (if local tagType info exists) -->
        <div v-if="item.enrichedTags && item.enrichedTags.length > 0">
          <p
            class="text-xs font-semibold uppercase tracking-wide mb-2"
            style="color: var(--color-text-muted)"
          >
            Tags
          </p>
          <div class="flex flex-wrap gap-2">
            <Badge
              v-for="t in item.enrichedTags"
              :key="t.tag"
              :variant="tagVariants[t.tagType] ?? 'default'"
              size="md"
            >
              <Icon :icon="tagIcons[t.tagType] ?? 'mdi:tag-outline'" class="w-3 h-3" />
              {{ t.tag }}
            </Badge>
          </div>
        </div>
      </div>

      <!-- ─── Image Gallery (thumbnails) ───────────────────────────────────── -->
      <div v-if="images.length > 0" class="mb-4">
        <div class="px-4 mb-2 flex items-center justify-between">
          <p
            class="text-xs font-semibold uppercase tracking-wide"
            style="color: var(--color-text-muted)"
          >
            Bilder ({{ images.length }})
          </p>
        </div>
        <div class="flex gap-3 overflow-x-auto px-4 pb-2 scroll-smooth">
          <div
            v-for="(img, i) in images"
            :key="img.id"
            class="relative shrink-0 w-24 h-24 rounded-xl overflow-hidden cursor-pointer"
            :style="
              img.isPrimary ? 'outline: 2px solid var(--color-accent); outline-offset: 2px' : ''
            "
            @click="viewerIndex = i"
          >
            <img :src="img.url" :alt="img.filename" class="w-full h-full object-cover" />
            <div
              v-if="img.isPrimary"
              class="absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
              style="background: var(--color-accent)"
            >
              Haupt
            </div>
          </div>
          <!-- Add image button -->
          <button
            class="shrink-0 w-24 h-24 rounded-xl flex flex-col items-center justify-center gap-1"
            style="
              background: var(--color-surface-2);
              color: var(--color-text-muted);
              border: 2px dashed var(--color-border);
            "
            aria-label="Bild hinzufügen"
            @click="showGallery = true"
          >
            <Icon icon="mdi:plus" class="w-6 h-6" />
            <span class="text-xs">Foto</span>
          </button>
        </div>
      </div>

      <!-- No images: just the add button -->
      <div v-else class="px-4 mb-4">
        <button
          class="w-full h-24 rounded-xl flex flex-col items-center justify-center gap-2"
          style="
            background: var(--color-surface-2);
            color: var(--color-text-muted);
            border: 2px dashed var(--color-border);
          "
          @click="showGallery = true"
        >
          <Icon icon="mdi:camera-plus-outline" class="w-6 h-6" />
          <span class="text-sm">Fotos hinzufügen</span>
        </button>
      </div>

      <!-- Spacer for sticky bottom bar (nav h-16 + action bar ~h-16 = h-32) -->
      <div class="h-32" />

      <!-- ─── Sticky Bottom Actions ─────────────────────────────────────────── -->
      <div
        class="fixed bottom-16 left-0 right-0 z-10 flex gap-3 px-4 py-3 lg:relative lg:bottom-auto"
        style="
          background: var(--color-surface-0);
          border-top: 1px solid var(--color-border);
          padding-bottom: calc(0.75rem + env(safe-area-inset-bottom, 0px));
        "
      >
        <button class="btn btn-secondary flex-1" @click="showEditSheet = true">
          <Icon icon="mdi:pencil-outline" class="w-4 h-4" />
          Bearbeiten
        </button>
        <button class="btn btn-danger flex-1" @click="showDeleteConfirm = true">
          <Icon icon="mdi:trash-can-outline" class="w-4 h-4" />
          Löschen
        </button>
      </div>

      <!-- ─── Delete Confirmation ──────────────────────────────────────────── -->
      <ConfirmSheet
        v-if="showDeleteConfirm"
        title="Item löschen?"
        :description="`'${item.name}' wird dauerhaft gelöscht.`"
        confirm-label="Löschen"
        :danger="true"
        @confirm="confirmDelete"
        @cancel="showDeleteConfirm = false"
      />

      <!-- ─── Edit Sheet ────────────────────────────────────────────────────── -->
      <ItemEditForm
        v-if="showEditSheet && item"
        :item="item"
        @updated="onItemUpdated"
        @deleted="router.back()"
        @close="showEditSheet = false"
      />

      <!-- ─── Image Gallery ─────────────────────────────────────────────────── -->
      <ImageGallery
        v-if="showGallery && item"
        :images="images"
        entity-type="item"
        :entity-id="item.id"
        @updated="onGalleryUpdated"
        @close="showGallery = false"
      />

      <!-- ─── Image Viewer ─────────────────────────────────────────────────── -->
      <ImageViewer
        v-if="viewerIndex !== null && images.length > 0"
        :images="images"
        :initial-index="viewerIndex"
        @close="viewerIndex = null"
      />

      <!-- ─── QR Sheet ────────────────────────────────────────────────────────── -->
      <QrSheet
        v-if="showQr && item"
        entity-type="item"
        :entity-id="item.id"
        :name="item.name"
        @close="showQr = false"
      />
    </template>
  </div>
</template>
