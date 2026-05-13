<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue'
  import { useCommands } from '~/composables/useCommands'
  import { containerConfig, type ContainerType } from '~/utils/containerUtils'
  import type { CategoryInfo, Container } from '~/types/inventory'
  import type { UUID } from '~/utils/uuid'
  import { generateBoxName } from '~/utils/boxNames'

  const props = defineProps<{
    parentContainerId?: UUID
    forcedType?: ContainerType
  }>()

  const emit = defineEmits<{
    created: [container: Container]
    close: []
  }>()

  const commands = useCommands()

  const nameInput = ref<HTMLInputElement | null>(null)
  const name = ref('')
  const description = ref('')
  const position = ref('')
  const selectedType = ref<ContainerType>(props.forcedType ?? 'ROOM')
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)
  const selectedFiles = ref<File[]>([])
  const filePreviews = ref<string[]>([])

  onMounted(() => {
    nameInput.value?.focus()
  })

  const selectedCategory = ref<CategoryInfo | null>(null)

  const isBox = computed(() => selectedType.value === 'BOX')

  watch(selectedCategory, (cat) => {
    if (isBox.value && cat) {
      name.value = generateBoxName(cat.shortCode)
    }
  })

  watch(selectedType, (type) => {
    if (type === 'BOX' && selectedCategory.value) {
      name.value = generateBoxName(selectedCategory.value.shortCode)
    }
  })

  function regenerateName() {
    if (selectedCategory.value) {
      name.value = generateBoxName(selectedCategory.value.shortCode)
    }
  }

  const containerTypes: ContainerType[] = ['ROOM', 'SHELF', 'BOX']

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
    if (isSubmitting.value) return
    if (!name.value.trim()) {
      error.value = 'Name ist erforderlich'
      return
    }
    isSubmitting.value = true
    error.value = null

    try {
      const payload: Record<string, unknown> = {
        name: name.value.trim(),
        containerType: selectedType.value,
        ...(description.value && { description: description.value.trim() }),
        ...(position.value && { position: position.value.trim() }),
        ...(props.parentContainerId !== undefined && {
          parentContainerId: props.parentContainerId,
        }),
        ...(selectedCategory.value && { categoryId: selectedCategory.value.id }),
      }

      const container = await commands.executeCommand<Container>('CONTAINER_CREATE', payload)
      if (!container) throw new Error('Container konnte nicht erstellt werden')

      if (selectedFiles.value.length > 0 && container.id) {
        await uploadImages(container.id)
      }

      emit('created', container)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Fehler beim Erstellen'
    } finally {
      isSubmitting.value = false
    }
  }

  async function uploadImages(containerId: UUID) {
    for (const file of selectedFiles.value) {
      const form = new FormData()
      form.append('file', file)
      form.append('isPrimary', 'false')
      try {
        await fetch(`/api/v1/containers/${containerId}/images`, {
          method: 'POST',
          body: form,
        })
      } catch {
        /* non-fatal */
      }
    }
  }
</script>

<template>
  <BottomSheet title="Container anlegen" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <ErrorBanner v-if="error" :message="error" @dismiss="error = null" />

      <!-- Category (BOX: top, required) -->
      <CategoryPickerButton v-if="isBox" v-model="selectedCategory" :required="isBox" />

      <!-- Name (BOX: with regenerate button) -->
      <div v-if="isBox">
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Name *
        </label>
        <div class="flex gap-2">
          <input
            ref="nameInput"
            v-model="name"
            type="text"
            placeholder="Kategorie wählen für Auto-Name…"
            class="search-input flex-1"
            style="padding-left: 0.875rem; padding-right: 0.875rem"
            required
          />
          <button
            type="button"
            class="btn btn-secondary shrink-0"
            :disabled="!selectedCategory"
            title="Neu generieren"
            @click="regenerateName"
          >
            <Icon icon="mdi:refresh" class="w-4 h-4" />
          </button>
        </div>
      </div>

      <!-- Name (ROOM/SHELF: plain) -->
      <div v-if="!isBox">
        <label
          for="container-name"
          class="block text-sm font-medium mb-1.5"
          style="color: var(--color-text-secondary)"
        >
          Name *
        </label>
        <input
          id="container-name"
          ref="nameInput"
          v-model="name"
          type="text"
          placeholder="z.B. Keller, Werkzeug-Regal…"
          class="search-input"
          style="padding-left: 0.875rem; padding-right: 0.875rem"
          required
        />
      </div>

      <!-- Type (hidden when forcedType is set) -->
      <div v-if="!forcedType">
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Typ
        </label>
        <div class="grid grid-cols-3 gap-2">
          <button
            v-for="type in containerTypes"
            :key="type"
            type="button"
            class="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition-colors"
            :style="
              selectedType === type
                ? 'border-color: var(--color-accent); background: var(--color-nav-active-bg)'
                : 'border-color: var(--color-border); background: var(--color-surface-2)'
            "
            @click="selectedType = type"
          >
            <Icon
              :icon="containerConfig[type].icon"
              class="w-6 h-6"
              :style="
                selectedType === type
                  ? 'color: var(--color-accent)'
                  : 'color: var(--color-text-muted)'
              "
            />
            <span
              class="text-xs font-medium"
              :style="
                selectedType === type
                  ? 'color: var(--color-nav-active-text)'
                  : 'color: var(--color-text-secondary)'
              "
            >
              {{ containerConfig[type].label }}
            </span>
          </button>
        </div>
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

      <!-- Category (ROOM/SHELF: bottom, optional) -->
      <CategoryPickerButton v-if="!isBox" v-model="selectedCategory" />

      <!-- Position -->
      <div>
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Position <span style="color: var(--color-text-muted)">(optional)</span>
        </label>
        <input
          v-model="position"
          type="text"
          placeholder="z.B. Nordwand, Erdgeschoss…"
          class="search-input"
          style="padding-left: 0.875rem; padding-right: 0.875rem"
        />
      </div>

      <!-- Image Upload -->
      <div>
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Fotos <span style="color: var(--color-text-muted)">(optional)</span>
        </label>
        <div class="flex gap-2 flex-wrap">
          <!-- Thumbnails -->
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
          <!-- Add button -->
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

      <!-- Submit -->
      <button
        type="submit"
        class="btn btn-primary w-full"
        :disabled="isSubmitting || !name.trim() || (selectedType === 'BOX' && !selectedCategory)"
      >
        <LoadingSpinner v-if="isSubmitting" size="sm" />
        <Icon v-else icon="mdi:plus" class="w-4 h-4" />
        {{ containerConfig[selectedType]?.label ?? 'Container' }} anlegen
      </button>
    </form>
  </BottomSheet>
</template>
