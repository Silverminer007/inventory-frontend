<script setup lang="ts">
  import { ref } from 'vue'
  import { useCommands } from '~/composables/useCommands'
  import type { Category } from '~/types/inventory'

  const props = defineProps<{
    category: Category
  }>()

  const emit = defineEmits<{
    updated: [category: Category]
    deleted: []
    close: []
  }>()

  const commands = useCommands()

  const name = ref(props.category.name)
  const shortCode = ref(props.category.shortCode)
  const description = ref(props.category.description ?? '')
  const isSubmitting = ref(false)
  const isDeleting = ref(false)
  const error = ref<string | null>(null)
  const showDeleteConfirm = ref(false)

  async function submit() {
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
      const updated = await commands.executeCommand<Category>(
        'CATEGORY_UPDATE',
        {
          name: name.value.trim(),
          shortCode: shortCode.value.trim().toUpperCase(),
          description: description.value.trim() || null,
        },
        props.category.id,
      )
      if (!updated) throw new Error('Kategorie konnte nicht aktualisiert werden')
      emit('updated', updated)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Fehler beim Aktualisieren'
    } finally {
      isSubmitting.value = false
    }
  }

  async function confirmDelete() {
    isDeleting.value = true
    try {
      await commands.executeCommand('CATEGORY_DELETE', {}, props.category.id)
      emit('deleted')
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Löschen fehlgeschlagen'
      isDeleting.value = false
      showDeleteConfirm.value = false
    }
  }
</script>

<template>
  <BottomSheet title="Kategorie bearbeiten" @close="emit('close')">
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

      <!-- Short Code -->
      <div>
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Kürzel *
        </label>
        <input
          v-model="shortCode"
          type="text"
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
          class="search-input resize-none"
          style="padding-left: 0.875rem; padding-right: 0.875rem"
        />
      </div>

      <!-- Save -->
      <button
        type="submit"
        class="btn btn-primary w-full"
        :disabled="isSubmitting || !name.trim() || !shortCode.trim()"
      >
        <LoadingSpinner v-if="isSubmitting" size="sm" />
        <Icon v-else icon="mdi:content-save-outline" class="w-4 h-4" />
        Speichern
      </button>

      <div style="height: 1px; background: var(--color-border)" />

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

  <ConfirmSheet
    v-if="showDeleteConfirm"
    title="Kategorie löschen?"
    :description="`'${category.name}' wird dauerhaft gelöscht.`"
    confirm-label="Löschen"
    :danger="true"
    @confirm="confirmDelete"
    @cancel="showDeleteConfirm = false"
  />
</template>
