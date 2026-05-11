<script setup lang="ts">
  import { ref, onMounted } from 'vue'
  import { useCommands } from '~/composables/useCommands'
  import type { Category } from '~/types/inventory'

  const emit = defineEmits<{
    created: [category: Category]
    close: []
  }>()

  const commands = useCommands()

  const nameInput = ref<HTMLInputElement | null>(null)
  const name = ref('')
  const shortCode = ref('')
  const description = ref('')
  const isSubmitting = ref(false)
  const error = ref<string | null>(null)

  onMounted(() => {
    nameInput.value?.focus()
  })

  async function submit() {
    if (isSubmitting.value) return
    if (!name.value.trim()) {
      error.value = 'Name ist erforderlich'
      return
    }
    if (!shortCode.value.trim()) {
      error.value = 'Kürzel ist erforderlich'
      return
    }
    isSubmitting.value = true
    error.value = null
    try {
      const category = await commands.executeCommand<Category>('CATEGORY_CREATE', {
        name: name.value.trim(),
        shortCode: shortCode.value.trim().toUpperCase(),
        ...(description.value && { description: description.value.trim() }),
      })
      if (!category) throw new Error('Kategorie konnte nicht erstellt werden')
      emit('created', category)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Fehler beim Erstellen'
    } finally {
      isSubmitting.value = false
    }
  }
</script>

<template>
  <BottomSheet title="Kategorie anlegen" @close="emit('close')">
    <form class="space-y-4" @submit.prevent="submit">
      <ErrorBanner v-if="error" :message="error" @dismiss="error = null" />

      <!-- Name -->
      <div>
        <label
          for="category-name"
          class="block text-sm font-medium mb-1.5"
          style="color: var(--color-text-secondary)"
        >
          Name *
        </label>
        <input
          id="category-name"
          ref="nameInput"
          v-model="name"
          type="text"
          placeholder="z.B. Werkzeug, Elektronik…"
          class="search-input"
          style="padding-left: 0.875rem; padding-right: 0.875rem"
          required
        />
      </div>

      <!-- Short Code -->
      <div>
        <label
          for="category-shortcode"
          class="block text-sm font-medium mb-1.5"
          style="color: var(--color-text-secondary)"
        >
          Kürzel *
        </label>
        <input
          id="category-shortcode"
          v-model="shortCode"
          type="text"
          placeholder="z.B. WZ, EL…"
          maxlength="10"
          class="search-input"
          style="padding-left: 0.875rem; padding-right: 0.875rem; text-transform: uppercase"
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

      <!-- Submit -->
      <button
        type="submit"
        class="btn btn-primary w-full"
        :disabled="isSubmitting || !name.trim() || !shortCode.trim()"
      >
        <LoadingSpinner v-if="isSubmitting" size="sm" />
        <Icon v-else icon="mdi:plus" class="w-4 h-4" />
        Kategorie anlegen
      </button>
    </form>
  </BottomSheet>
</template>
