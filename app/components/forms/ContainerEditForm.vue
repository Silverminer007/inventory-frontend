<script setup lang="ts">
  import { ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useCommands } from '~/composables/useCommands'
  import { containerConfig, type ContainerType } from '~/utils/containerUtils'
  import type { Container } from '~/types/inventory'

  const props = defineProps<{
    container: Container
  }>()

  const emit = defineEmits<{
    updated: [container: Container]
    deleted: []
    close: []
  }>()

  const commands = useCommands()
  const router = useRouter()

  const name = ref(props.container.name)
  const description = ref(props.container.description ?? '')
  const position = ref(props.container.position ?? '')
  const isSubmitting = ref(false)
  const isDeleting = ref(false)
  const error = ref<string | null>(null)
  const showMoveSheet = ref(false)
  const showDeleteConfirm = ref(false)

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
        description: description.value.trim() || null,
        position: position.value.trim() || null,
      }
      const updated = await commands.executeCommand<Container>(
        'CONTAINER_UPDATE',
        payload,
        props.container.id,
      )
      if (!updated) throw new Error('Container konnte nicht aktualisiert werden')
      emit('updated', updated)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Fehler beim Aktualisieren'
    } finally {
      isSubmitting.value = false
    }
  }

  async function onMove(newParentId: string) {
    showMoveSheet.value = false
    isSubmitting.value = true
    error.value = null
    try {
      const moved = await commands.executeCommand<Container>(
        'CONTAINER_MOVE',
        { parentContainerId: newParentId },
        props.container.id,
      )
      if (!moved) throw new Error('Verschieben fehlgeschlagen')
      emit('updated', moved)
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Verschieben fehlgeschlagen'
      isSubmitting.value = false
    }
  }

  async function confirmDelete() {
    isDeleting.value = true
    try {
      await commands.executeCommand('CONTAINER_DELETE', {}, props.container.id)
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
  <BottomSheet title="Container bearbeiten" @close="emit('close')">
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

      <!-- Type (read-only) -->
      <div class="flex items-center gap-2">
        <Icon
          :icon="containerConfig[container.containerType as ContainerType].icon"
          class="w-4 h-4"
          style="color: var(--color-text-muted)"
        />
        <span class="text-sm" style="color: var(--color-text-muted)">
          {{ containerConfig[container.containerType as ContainerType].label }}
        </span>
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

      <!-- Position -->
      <div>
        <label class="block text-sm font-medium mb-1.5" style="color: var(--color-text-secondary)">
          Position <span style="color: var(--color-text-muted)">(optional)</span>
        </label>
        <input
          v-model="position"
          type="text"
          class="search-input"
          style="padding-left: 0.875rem; padding-right: 0.875rem"
        />
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
    :exclude-id="container.id"
    title="Neuen Übercontainer wählen"
    @select="onMove"
    @close="showMoveSheet = false"
  />

  <ConfirmSheet
    v-if="showDeleteConfirm"
    title="Container löschen?"
    :description="`'${container.name}' und alle Inhalte werden dauerhaft gelöscht.`"
    confirm-label="Löschen"
    :danger="true"
    @confirm="confirmDelete"
    @cancel="showDeleteConfirm = false"
  />
</template>
