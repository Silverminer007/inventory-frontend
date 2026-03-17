<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useCommands } from '~/composables/useCommands'
import { useDatabase } from '~/composables/useDatabase'
import type { LocalItem } from '~/types/inventory'
import type { UUID } from '~/utils/uuid'

const props = defineProps<{
  containerId?: UUID
}>()

const emit = defineEmits<{
  created: [item: LocalItem]
  close: []
}>()

const commands = useCommands()
const db = useDatabase()
const config = useRuntimeConfig()
const apiBase = config.public.apiBase as string

const step = ref<1 | 2>(1)
const nameInput = ref<HTMLInputElement | null>(null)

// Step 1 fields
const name = ref('')
const description = ref('')
const quantity = ref(1)
const barcode = ref('')
const containerId = ref<UUID | undefined>(props.containerId)
const containerName = ref<string | null>(null)
const selectedFiles = ref<File[]>([])
const filePreviews = ref<string[]>([])
const showContainerPicker = ref(false)

// Step 2 fields
const tags = ref<string[]>([])
const tagInput = ref('')
const suggestedTags = ref<string[]>([])
const isLoadingSuggestions = ref(false)

const isSubmitting = ref(false)
const error = ref<string | null>(null)
const showScanner = ref(false)

onMounted(() => { nameInput.value?.focus() })

watch(containerId, async (id) => {
  if (!id) { containerName.value = null; return }
  const c = await db.getContainer(id)
  containerName.value = c?.name ?? `#${id}`
}, { immediate: true })

async function goToStep2() {
  if (!name.value.trim()) { error.value = 'Name ist erforderlich'; return }
  error.value = null
  step.value = 2
  isLoadingSuggestions.value = true
  try {
    const res = await fetch(`${apiBase}/api/v1/items/tags/suggest?item=${encodeURIComponent(name.value.trim())}`)
    if (res.ok) {
      suggestedTags.value = await res.json() as string[]
    }
  } catch { /* offline or error — skip suggestions */ } finally {
    isLoadingSuggestions.value = false
  }
}

function toggleTag(tag: string) {
  const idx = tags.value.indexOf(tag)
  if (idx >= 0) tags.value.splice(idx, 1)
  else tags.value.push(tag)
}

function addCustomTag() {
  const t = tagInput.value.trim()
  if (t && !tags.value.includes(t)) tags.value.push(t)
  tagInput.value = ''
}

function removeTag(tag: string) {
  tags.value = tags.value.filter(t => t !== tag)
}

function onFilesSelected(e: Event) {
  const input = e.target as HTMLInputElement
  if (!input.files) return
  for (const file of Array.from(input.files)) {
    selectedFiles.value.push(file)
    filePreviews.value.push(URL.createObjectURL(file))
  }
  input.value = ''
}

function removeFile(index: number) {
  URL.revokeObjectURL(filePreviews.value[index] ?? '')
  selectedFiles.value.splice(index, 1)
  filePreviews.value.splice(index, 1)
}

async function submit() {
  isSubmitting.value = true
  error.value = null
  try {
    const payload: Record<string, unknown> = {
      name: name.value.trim(),
      quantity: quantity.value,
      ...(description.value && { description: description.value.trim() }),
      ...(barcode.value && { barcode: barcode.value.trim() }),
      ...(containerId.value !== undefined && { containerId: containerId.value }),
      ...(tags.value.length > 0 && { tags: [...tags.value] })
    }
    const item = await commands.executeCommand<LocalItem>('ITEM_CREATE', payload)
    if (!item) throw new Error('Item konnte nicht erstellt werden')

    // Queue images — either direct upload (real ID + online) or pending queue
    if (selectedFiles.value.length > 0) {
      await queueImages(item.id)
    }
    emit('created', item)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Fehler beim Erstellen'
    step.value = 1
  } finally {
    isSubmitting.value = false
  }
}

async function queueImages(itemId: UUID) {
  const isOnline = typeof navigator !== 'undefined' && navigator.onLine

  for (const file of selectedFiles.value) {
    if (isOnline) {
      try {
        const form = new FormData()
        form.append('file', file)
        form.append('isPrimary', 'false')
        const res = await fetch(`${apiBase}/api/v1/items/${itemId}/images`, { method: 'POST', body: form })
        if (res.ok) continue
      } catch { /* fall through to pending queue */ }
    }
    // Store locally — will be uploaded by ImageGallery or sync when item is resolved
    await db.addPendingImage({
      entityType: 'item',
      entityId: itemId,
      blob: file,
      filename: file.name,
      isPrimary: false,
      createdAt: new Date().toISOString()
    })
  }
}

onUnmounted(() => {
  for (const url of filePreviews.value) URL.revokeObjectURL(url)
})
</script>

<template>
  <BottomSheet title="Item anlegen" @close="emit('close')">
    <!-- Step 1: Grunddaten -->
    <form v-if="step === 1" class="space-y-4" @submit.prevent="goToStep2">
      <ErrorBanner v-if="error" :message="error" @dismiss="error = null" />

      <!-- Name -->
      <div>
        <label for="item-name" class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Name *
        </label>
        <input
          id="item-name"
          ref="nameInput"
          v-model="name"
          type="text"
          placeholder="z.B. Schraubenzieher, Kabel…"
          class="search-input"
          style="padding-left: 0.875rem; padding-right: 0.875rem"
          required
        />
      </div>

      <!-- Description -->
      <div>
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Beschreibung <span style="color: var(--color-text-muted)">(optional)</span>
        </label>
        <textarea
          v-model="description"
          rows="2"
          placeholder="Kurze Beschreibung…"
          class="search-input resize-none"
          style="padding-left: 0.875rem; padding-right: 0.875rem"
        />
      </div>

      <!-- Quantity + Barcode row -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
            Menge
          </label>
          <input
            v-model.number="quantity"
            type="number"
            min="0"
            class="search-input"
            style="padding-left: 0.875rem; padding-right: 0.875rem"
          />
        </div>
        <div>
          <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
            Barcode <span style="color: var(--color-text-muted)">(opt.)</span>
          </label>
          <div class="flex gap-2">
            <input
              v-model="barcode"
              type="text"
              placeholder="EAN / QR"
              class="search-input flex-1"
              style="padding-left: 0.875rem; padding-right: 0.875rem"
            />
            <button
              type="button"
              class="btn btn-secondary px-3 shrink-0"
              title="Barcode scannen"
              @click="showScanner = true"
            >
              <Icon icon="mdi:barcode-scan" class="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Container picker -->
      <div>
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Lagerort <span style="color: var(--color-text-muted)">(optional)</span>
        </label>
        <button
          type="button"
          class="search-input w-full text-left flex items-center justify-between"
          style="padding-left: 0.875rem; padding-right: 0.875rem"
          @click="showContainerPicker = true"
        >
          <span :style="containerName ? 'color: var(--color-text-primary)' : 'color: var(--color-text-muted)'">
            {{ containerName ?? 'Lagerort wählen…' }}
          </span>
          <Icon icon="mdi:chevron-right" class="w-4 h-4 shrink-0" style="color: var(--color-text-muted)" />
        </button>
      </div>

      <!-- Image Upload -->
      <div>
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Fotos <span style="color: var(--color-text-muted)">(optional)</span>
        </label>
        <div class="flex gap-2 flex-wrap">
          <div
            v-for="(preview, i) in filePreviews"
            :key="i"
            class="relative w-16 h-16 rounded-xl overflow-hidden shrink-0"
          >
            <img :src="preview" class="w-full h-full object-cover" alt="" />
            <button
              type="button"
              class="absolute top-0.5 right-0.5 w-5 h-5 rounded-full flex items-center justify-center"
              style="background: rgba(0,0,0,0.6)"
              @click="removeFile(i)"
            >
              <Icon icon="mdi:close" class="w-3 h-3 text-white" />
            </button>
          </div>
          <label
            class="w-16 h-16 rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer shrink-0"
            style="background: var(--color-surface-2); border: 2px dashed var(--color-border)"
          >
            <Icon icon="mdi:plus" class="w-5 h-5" style="color: var(--color-text-muted)" />
            <span class="text-[10px]" style="color: var(--color-text-muted)">Foto</span>
            <input type="file" accept="image/*" multiple class="sr-only" @change="onFilesSelected" />
          </label>
        </div>
      </div>

      <button type="submit" class="btn btn-primary w-full" :disabled="!name.trim()">
        Weiter
        <Icon icon="mdi:arrow-right" class="w-4 h-4" />
      </button>
    </form>

    <!-- Step 2: Tags -->
    <div v-else class="space-y-4">
      <ErrorBanner v-if="error" :message="error" @dismiss="error = null" />

      <button type="button" class="flex items-center gap-1 text-sm" style="color: var(--color-text-muted)" @click="step = 1">
        <Icon icon="mdi:arrow-left" class="w-4 h-4" />
        Zurück
      </button>

      <p class="text-sm" style="color: var(--color-text-secondary)">
        Tags für <strong style="color: var(--color-text-primary)">{{ name }}</strong>
      </p>

      <!-- Custom tag input -->
      <div class="flex gap-2">
        <input
          v-model="tagInput"
          type="text"
          placeholder="Tag eingeben…"
          class="search-input flex-1"
          style="padding-left: 0.875rem; padding-right: 0.875rem"
          @keydown.enter.prevent="addCustomTag"
        />
        <button
          type="button"
          class="btn btn-secondary px-3"
          :disabled="!tagInput.trim()"
          @click="addCustomTag"
        >
          <Icon icon="mdi:plus" class="w-4 h-4" />
        </button>
      </div>

      <!-- Selected tags -->
      <div v-if="tags.length > 0" data-testid="selected-tags" class="flex flex-wrap gap-2">
        <button
          v-for="tag in tags"
          :key="tag"
          type="button"
          class="flex items-center gap-1 px-2.5 py-1 rounded-full text-sm font-medium"
          style="background: var(--color-nav-active-bg); color: var(--color-nav-active-text)"
          @click="removeTag(tag)"
        >
          {{ tag }}
          <Icon icon="mdi:close" class="w-3 h-3" />
        </button>
      </div>

      <!-- Suggested tags -->
      <div v-if="isLoadingSuggestions" class="flex justify-center py-4">
        <LoadingSpinner size="sm" />
      </div>
      <div v-else-if="suggestedTags.length > 0">
        <p class="text-xs font-semibold uppercase tracking-wide mb-2" style="color: var(--color-text-muted)">
          Vorschläge
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="tag in suggestedTags"
            :key="tag"
            type="button"
            class="px-2.5 py-1 rounded-full text-sm transition-colors"
            :style="tags.includes(tag)
              ? 'background: var(--color-nav-active-bg); color: var(--color-nav-active-text)'
              : 'background: var(--color-surface-2); color: var(--color-text-secondary)'"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
      </div>

      <button
        type="button"
        class="btn btn-primary w-full"
        :disabled="isSubmitting"
        @click="submit"
      >
        <LoadingSpinner v-if="isSubmitting" size="sm" />
        <Icon v-else icon="mdi:plus" class="w-4 h-4" />
        Item anlegen
      </button>
    </div>
  </BottomSheet>

  <ContainerPicker
    v-if="showContainerPicker"
    @select="containerId = $event; showContainerPicker = false"
    @close="showContainerPicker = false"
  />

  <BarcodeScanner
    v-if="showScanner"
    @detected="barcode = $event; showScanner = false"
    @close="showScanner = false"
  />
</template>
