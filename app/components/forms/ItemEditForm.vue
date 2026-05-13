<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useCommands } from '~/composables/useCommands'
  import { useDatabase } from '~/composables/useDatabase'
  import type { CategoryInfo, LocalItem } from '~/types/inventory'

  const props = defineProps<{
    item: LocalItem
  }>()

  const emit = defineEmits<{
    updated: [item: LocalItem]
    deleted: []
    close: []
  }>()

  const commands = useCommands()
  const db = useDatabase()
  const router = useRouter()

  const name = ref(props.item.name)
  const description = ref(props.item.description ?? '')
  const quantity = ref(props.item.quantity)
  const barcode = ref(props.item.barcode ?? '')
  const tags = ref<string[]>([...(props.item.tags ?? [])])
  const selectedCategory = ref<CategoryInfo | null>(props.item.category ?? null)
  const tagInput = ref('')
  const isSubmitting = ref(false)
  const isDeleting = ref(false)
  const error = ref<string | null>(null)
  const showMoveSheet = ref(false)
  const showDeleteConfirm = ref(false)
  const showScanner = ref(false)
  const selectedFiles = ref<File[]>([])
  const filePreviews = ref<string[]>([])

  function addCustomTag() {
    const t = tagInput.value.trim()
    if (t && !tags.value.includes(t)) tags.value.push(t)
    tagInput.value = ''
  }

  function removeTag(tag: string) {
    tags.value = tags.value.filter((t) => t !== tag)
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
    if (!name.value.trim()) {
      error.value = 'Name ist erforderlich'
      return
    }
    isSubmitting.value = true
    error.value = null
    try {
      const payload: Record<string, unknown> = {
        name: name.value.trim(),
        quantity: quantity.value,
        description: description.value.trim() || null,
        barcode: barcode.value.trim() || null,
        tags: [...tags.value],
        category: selectedCategory.value ? { id: selectedCategory.value.id } : null,
      }
      const updated = await commands.executeCommand<LocalItem>(
        'ITEM_UPDATE',
        payload,
        props.item.id,
      )
      if (!updated) throw new Error('Item konnte nicht aktualisiert werden')

      if (selectedFiles.value.length > 0) {
        await queueImages(props.item.id)
      }
      emit('updated', updated)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Fehler beim Aktualisieren'
    } finally {
      isSubmitting.value = false
    }
  }

  async function queueImages(itemId: string) {
    const isOnline = typeof navigator !== 'undefined' && navigator.onLine
    for (const file of selectedFiles.value) {
      if (isOnline) {
        try {
          const form = new FormData()
          form.append('file', file)
          form.append('isPrimary', 'false')
          const res = await fetch(`/api/v1/items/${itemId}/images`, {
            method: 'POST',
            body: form,
          })
          if (res.ok) continue
        } catch {
          /* fall through */
        }
      }
      await db.addPendingImage({
        entityType: 'item',
        entityId: itemId,
        blob: file,
        filename: file.name,
        isPrimary: false,
        createdAt: new Date().toISOString(),
      })
    }
  }

  async function onMove(newContainerId: string) {
    showMoveSheet.value = false
    isSubmitting.value = true
    error.value = null
    try {
      const moved = await commands.executeCommand<LocalItem>(
        'ITEM_MOVE',
        { containerId: newContainerId },
        props.item.id,
      )
      if (!moved) throw new Error('Verschieben fehlgeschlagen')
      emit('updated', moved)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Verschieben fehlgeschlagen'
      isSubmitting.value = false
    }
  }

  function onBarcodeDetected(code: string) {
    barcode.value = code
    showScanner.value = false
  }

  async function confirmDelete() {
    isDeleting.value = true
    try {
      await commands.executeCommand('ITEM_DELETE', {}, props.item.id)
      emit('deleted')
      router.back()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Löschen fehlgeschlagen'
      isDeleting.value = false
      showDeleteConfirm.value = false
    }
  }
</script>

<template>
  <BottomSheet title="Item bearbeiten" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <ErrorBanner v-if="error" :message="error" @dismiss="error = null" />

      <!-- Name -->
      <div>
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Name *
        </label>
        <input
          v-model="name"
          type="text"
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
          class="search-input resize-none"
          style="padding-left: 0.875rem; padding-right: 0.875rem"
        />
      </div>

      <!-- Quantity + Barcode -->
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label
            class="block text-sm font-medium mb-1.5"
            style="color: var(--color-text-secondary)"
          >
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
          <label
            class="block text-sm font-medium mb-1.5"
            style="color: var(--color-text-secondary)"
          >
            Barcode <span style="color: var(--color-text-muted)">(opt.)</span>
          </label>
          <div class="flex gap-2">
            <input
              v-model="barcode"
              type="text"
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

      <!-- Tags -->
      <div>
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Tags
        </label>
        <div class="flex gap-2 mb-2">
          <input
            v-model="tagInput"
            type="text"
            placeholder="Tag hinzufügen…"
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
        <div v-if="tags.length > 0" class="flex flex-wrap gap-2">
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
      </div>

      <!-- Category -->
      <CategoryPickerButton v-model="selectedCategory" />

      <!-- Image Upload -->
      <div>
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Fotos hinzufügen <span style="color: var(--color-text-muted)">(optional)</span>
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
              style="background: rgba(0, 0, 0, 0.6)"
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
            <input
              type="file"
              accept="image/*"
              multiple
              class="sr-only"
              @change="onFilesSelected"
            />
          </label>
        </div>
      </div>

      <!-- Save -->
      <button type="submit" class="btn btn-primary w-full" :disabled="isSubmitting || !name.trim()">
        <LoadingSpinner v-if="isSubmitting" size="sm" />
        <Icon v-else icon="mdi:content-save-outline" class="w-4 h-4" />
        Speichern
      </button>

      <div style="height: 1px; background: var(--color-border)" />

      <!-- Move -->
      <button type="button" class="btn btn-secondary w-full" @click="showMoveSheet = true">
        <Icon icon="mdi:arrow-right-bold-box-outline" class="w-4 h-4" />
        Verschieben
      </button>

      <!-- Delete -->
      <button
        type="button"
        class="btn btn-danger w-full"
        :disabled="isDeleting"
        @click="showDeleteConfirm = true"
      >
        <LoadingSpinner v-if="isDeleting" size="sm" />
        <Icon v-else icon="mdi:trash-can-outline" class="w-4 h-4" />
        Löschen
      </button>
    </form>
  </BottomSheet>

  <ContainerPicker
    v-if="showMoveSheet"
    title="Neuen Lagerort wählen"
    @select="onMove"
    @close="showMoveSheet = false"
  />

  <BarcodeScanner v-if="showScanner" @detected="onBarcodeDetected" @close="showScanner = false" />

  <ConfirmSheet
    v-if="showDeleteConfirm"
    title="Item löschen?"
    :description="`'${item.name}' wird dauerhaft gelöscht.`"
    confirm-label="Löschen"
    :danger="true"
    @confirm="confirmDelete"
    @cancel="showDeleteConfirm = false"
  />
</template>
