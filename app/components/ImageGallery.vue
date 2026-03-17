<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { Image } from '~/types/inventory'
import { useDatabase } from '~/composables/useDatabase'

const props = defineProps<{
  images: Image[]
  entityType: 'item' | 'container'
  entityId: string
}>()

const emit = defineEmits<{
  updated: []
  close: []
}>()

const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string
const db = useDatabase()

const isUploading = ref(false)
const isDeletingId = ref<string | null>(null)
const isSettingPrimaryId = ref<string | null>(null)
const error = ref<string | null>(null)
const viewerIndex = ref<number | null>(null)

interface PendingEntry {
  id: number
  previewUrl: string
  filename: string
  isUploading: boolean
}

const pendingEntries = ref<PendingEntry[]>([])

async function loadPendingImages() {
  const imgs = await db.getPendingImagesForEntity(props.entityType, props.entityId)
  pendingEntries.value = imgs.map(img => ({
    id: img.id!,
    previewUrl: URL.createObjectURL(img.blob),
    filename: img.filename,
    isUploading: false
  }))
}

async function tryUploadPending() {
  if (!navigator.onLine) return
  const imgs = await db.getPendingImagesForEntity(props.entityType, props.entityId)
  for (const img of imgs) {
    const entry = pendingEntries.value.find(e => e.id === img.id)
    if (entry) entry.isUploading = true
    try {
      const form = new FormData()
      form.append('file', img.blob, img.filename)
      form.append('isPrimary', String(img.isPrimary))
      const res = await fetch(
        `${apiBase}/api/v1/${props.entityType}s/${props.entityId}/images`,
        { method: 'POST', body: form }
      )
      if (res.ok && img.id !== undefined) {
        await db.deletePendingImage(img.id)
        const url = pendingEntries.value.find(e => e.id === img.id)?.previewUrl
        if (url) URL.revokeObjectURL(url)
        pendingEntries.value = pendingEntries.value.filter(e => e.id !== img.id)
        emit('updated')
      } else if (entry) {
        entry.isUploading = false
      }
    } catch {
      if (entry) entry.isUploading = false
    }
  }
}

async function uploadFiles(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files?.length) return

  const offline = typeof navigator !== 'undefined' && !navigator.onLine

  if (offline) {
    // Store locally for later upload
    for (const file of Array.from(input.files)) {
      try {
        const id = await db.addPendingImage({
          entityType: props.entityType,
          entityId: props.entityId,
          blob: file,
          filename: file.name,
          isPrimary: false,
          createdAt: new Date().toISOString()
        })
        pendingEntries.value.push({
          id,
          previewUrl: URL.createObjectURL(file),
          filename: file.name,
          isUploading: false
        })
      } catch (err) {
        error.value = 'Bild konnte nicht lokal gespeichert werden'
      }
    }
    input.value = ''
    return
  }

  isUploading.value = true
  error.value = null
  try {
    for (const file of Array.from(input.files)) {
      const form = new FormData()
      form.append('file', file)
      form.append('isPrimary', 'false')
      const res = await fetch(
        `${apiBase}/api/v1/${props.entityType}s/${props.entityId}/images`,
        { method: 'POST', body: form }
      )
      if (!res.ok) {
        // Fall back to local storage
        const id = await db.addPendingImage({
          entityType: props.entityType,
          entityId: props.entityId,
          blob: file,
          filename: file.name,
          isPrimary: false,
          createdAt: new Date().toISOString()
        })
        pendingEntries.value.push({
          id,
          previewUrl: URL.createObjectURL(file),
          filename: file.name,
          isUploading: false
        })
      }
    }
    emit('updated')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Upload fehlgeschlagen'
  } finally {
    isUploading.value = false
    input.value = ''
  }
}

async function setPrimary(img: Image) {
  isSettingPrimaryId.value = img.id
  error.value = null
  try {
    const res = await fetch(`${apiBase}/api/v1/images/${img.id}/set-primary`, { method: 'POST' })
    if (!res.ok) throw new Error('Fehler beim Setzen des Hauptbildes')
    emit('updated')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Fehler'
  } finally {
    isSettingPrimaryId.value = null
  }
}

async function deleteImage(img: Image) {
  isDeletingId.value = img.id
  error.value = null
  try {
    const res = await fetch(`${apiBase}/api/v1/images/${img.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error('Löschen fehlgeschlagen')
    emit('updated')
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'Fehler beim Löschen'
  } finally {
    isDeletingId.value = null
  }
}

function onOnline() {
  tryUploadPending()
}

onMounted(async () => {
  await loadPendingImages()
  await tryUploadPending()
  window.addEventListener('online', onOnline)
})

onUnmounted(() => {
  window.removeEventListener('online', onOnline)
  for (const entry of pendingEntries.value) {
    URL.revokeObjectURL(entry.previewUrl)
  }
})
</script>

<template>
  <BottomSheet title="Bilder" @close="emit('close')">
    <ErrorBanner v-if="error" :message="error" class="mb-3" @dismiss="error = null" />

    <div class="grid grid-cols-3 gap-2">
      <!-- Existing server images -->
      <div
        v-for="(img, i) in images"
        :key="img.id"
        class="relative aspect-square rounded-xl overflow-hidden cursor-pointer"
        :style="img.isPrimary ? 'outline: 2px solid var(--color-accent); outline-offset: 2px' : ''"
        @click="viewerIndex = i"
      >
        <img :src="img.url" :alt="img.filename" class="w-full h-full object-cover" />

        <!-- Primary badge -->
        <div
          v-if="img.isPrimary"
          class="absolute bottom-1 left-1 rounded-full px-1.5 py-0.5 text-[9px] font-bold text-white"
          style="background: var(--color-accent)"
        >
          Haupt
        </div>

        <!-- Action buttons -->
        <div class="absolute top-1 right-1 flex flex-col gap-1">
          <button
            v-if="!img.isPrimary"
            class="w-6 h-6 rounded-full flex items-center justify-center"
            style="background: rgba(0,0,0,0.65)"
            title="Als Hauptbild setzen"
            :disabled="isSettingPrimaryId === img.id"
            @click="setPrimary(img)"
          >
            <LoadingSpinner v-if="isSettingPrimaryId === img.id" size="sm" />
            <Icon v-else icon="mdi:star-outline" class="w-3.5 h-3.5 text-white" />
          </button>
          <button
            class="w-6 h-6 rounded-full flex items-center justify-center"
            style="background: rgba(0,0,0,0.65)"
            title="Bild löschen"
            :disabled="isDeletingId === img.id"
            @click="deleteImage(img)"
          >
            <LoadingSpinner v-if="isDeletingId === img.id" size="sm" />
            <Icon v-else icon="mdi:trash-can-outline" class="w-3.5 h-3.5 text-white" />
          </button>
        </div>
      </div>

      <!-- Pending (locally stored) images -->
      <div
        v-for="pending in pendingEntries"
        :key="`pending-${pending.id}`"
        class="relative aspect-square rounded-xl overflow-hidden"
        style="outline: 2px dashed var(--color-text-muted); outline-offset: 2px"
      >
        <img :src="pending.previewUrl" :alt="pending.filename" class="w-full h-full object-cover opacity-60" />
        <div class="absolute inset-0 flex items-center justify-center" style="background: rgba(0,0,0,0.25)">
          <LoadingSpinner v-if="pending.isUploading" size="sm" />
          <Icon v-else icon="mdi:cloud-upload-outline" class="w-6 h-6 text-white" />
        </div>
      </div>

      <!-- Upload tile -->
      <label
        class="aspect-square rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer"
        style="background: var(--color-surface-2); border: 2px dashed var(--color-border)"
      >
        <LoadingSpinner v-if="isUploading" />
        <template v-else>
          <Icon icon="mdi:plus" class="w-6 h-6" style="color: var(--color-text-muted)" />
          <span class="text-xs" style="color: var(--color-text-muted)">Foto</span>
        </template>
        <input
          type="file"
          accept="image/*"
          multiple
          class="sr-only"
          :disabled="isUploading"
          @change="uploadFiles"
        />
      </label>
    </div>

    <p v-if="images.length === 0 && pendingEntries.length === 0 && !isUploading" class="py-4 text-center text-sm" style="color: var(--color-text-muted)">
      Noch keine Bilder vorhanden
    </p>

    <!-- Pending notice -->
    <p
      v-if="pendingEntries.length > 0"
      class="mt-3 text-xs text-center"
      style="color: var(--color-text-muted)"
    >
      {{ pendingEntries.length }} Bild{{ pendingEntries.length !== 1 ? 'er' : '' }} warten auf Upload
    </p>
  </BottomSheet>

  <ImageViewer
    v-if="viewerIndex !== null && images.length > 0"
    :images="images"
    :initial-index="viewerIndex"
    @close="viewerIndex = null"
  />
</template>
