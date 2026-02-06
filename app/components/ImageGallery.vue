<script setup lang="ts">
import type { ImageDTO } from '~/types'

const props = defineProps<{
  entityType: 'items' | 'containers'
  entityId: number
}>()

const toast = useToast()
const { getImages, uploadImage, deleteImage } = useImages()

const images = ref<ImageDTO[]>([])
const loading = ref(true)
const uploading = ref(false)
const deletingId = ref<number | null>(null)
const showDeleteConfirm = ref(false)
const imageToDelete = ref<ImageDTO | null>(null)

const fileInput = ref<HTMLInputElement | null>(null)

const sortedImages = computed(() => {
  return [...images.value].sort((a, b) => {
    if (a.isPrimary && !b.isPrimary) return -1
    if (!a.isPrimary && b.isPrimary) return 1
    return new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  })
})

async function loadImages() {
  loading.value = true
  try {
    images.value = await getImages(props.entityType, props.entityId)
  } catch {
    toast.add({ title: 'Fehler', description: 'Bilder konnten nicht geladen werden', color: 'error' })
  } finally {
    loading.value = false
  }
}

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return

  uploading.value = true
  try {
    const isPrimary = images.value.length === 0
    await uploadImage(props.entityType, props.entityId, file, isPrimary)
    await loadImages()
    toast.add({ title: 'Hochgeladen', description: 'Bild wurde hochgeladen', color: 'success' })
  } catch {
    toast.add({ title: 'Fehler', description: 'Upload fehlgeschlagen', color: 'error' })
  } finally {
    uploading.value = false
    input.value = ''
  }
}

function confirmDelete(image: ImageDTO) {
  imageToDelete.value = image
  showDeleteConfirm.value = true
}

async function handleDelete() {
  if (!imageToDelete.value) return

  deletingId.value = imageToDelete.value.id
  try {
    await deleteImage(imageToDelete.value.id)
    await loadImages()
    toast.add({ title: 'Geloescht', description: 'Bild wurde geloescht', color: 'success' })
  } catch {
    toast.add({ title: 'Fehler', description: 'Loeschen fehlgeschlagen', color: 'error' })
  } finally {
    deletingId.value = null
    showDeleteConfirm.value = false
    imageToDelete.value = null
  }
}

async function setPrimary(image: ImageDTO) {
  uploading.value = true
  try {
    const response = await $fetch<Blob>(image.url, { responseType: 'blob' })
    const file = new File([response], image.filename, { type: image.contentType })
    await uploadImage(props.entityType, props.entityId, file, true)
    await loadImages()
    toast.add({ title: 'Aktualisiert', description: 'Hauptbild wurde gesetzt', color: 'success' })
  } catch {
    toast.add({ title: 'Fehler', description: 'Hauptbild setzen fehlgeschlagen', color: 'error' })
  } finally {
    uploading.value = false
  }
}

onMounted(loadImages)
</script>

<template>
  <div class="mb-6">
    <div class="flex items-center justify-between mb-3">
      <h2 class="font-semibold text-lg">Bilder</h2>
      <div class="flex gap-2">
        <UButton
          icon="i-lucide-camera"
          size="sm"
          color="primary"
          variant="soft"
          :loading="uploading"
          class="sm:hidden"
          @click="triggerUpload"
        />
        <UButton
          icon="i-lucide-upload"
          label="Hochladen"
          size="sm"
          color="primary"
          variant="soft"
          :loading="uploading"
          @click="triggerUpload"
        />
      </div>
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        @change="handleFileSelect"
      >
    </div>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-3 gap-2">
      <USkeleton v-for="i in 3" :key="i" class="aspect-square rounded-lg" />
    </div>

    <!-- Empty state -->
    <div v-else-if="!images.length" class="text-center py-8 text-muted">
      <UIcon name="i-lucide-image" class="text-3xl mb-2" />
      <p>Keine Bilder</p>
    </div>

    <!-- Image grid -->
    <div v-else class="grid grid-cols-3 gap-2">
      <div
        v-for="image in sortedImages"
        :key="image.id"
        class="group relative aspect-square rounded-lg overflow-hidden border border-default"
        :class="{ 'col-span-2 row-span-2': image.isPrimary }"
      >
        <img
          :src="image.url"
          :alt="image.filename"
          class="w-full h-full object-cover"
        >
        <div v-if="image.isPrimary" class="absolute top-1 left-1">
          <UBadge label="Haupt" color="primary" size="xs" />
        </div>
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-end justify-end p-1 opacity-0 group-hover:opacity-100">
          <div class="flex gap-1">
            <UButton
              v-if="!image.isPrimary"
              icon="i-lucide-star"
              size="xs"
              color="neutral"
              variant="solid"
              title="Als Hauptbild setzen"
              @click="setPrimary(image)"
            />
            <UButton
              icon="i-lucide-trash-2"
              size="xs"
              color="error"
              variant="solid"
              :loading="deletingId === image.id"
              title="Loeschen"
              @click="confirmDelete(image)"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- Delete Confirmation -->
    <UModal v-model:open="showDeleteConfirm">
      <template #content>
        <div class="p-6">
          <h3 class="text-lg font-semibold mb-2">Bild loeschen?</h3>
          <p class="text-muted mb-4">
            <strong>{{ imageToDelete?.filename }}</strong> wird unwiderruflich geloescht.
          </p>
          <div class="flex justify-end gap-2">
            <UButton label="Abbrechen" color="neutral" variant="outline" @click="showDeleteConfirm = false" />
            <UButton label="Loeschen" color="error" :loading="deletingId !== null" @click="handleDelete" />
          </div>
        </div>
      </template>
    </UModal>
  </div>
</template>
